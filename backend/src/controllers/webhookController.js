import Payment from '../models/Payment.js';
import WebhookEvent from '../models/WebhookEvent.js';
import { provider, activeProviderName } from '../services/paymentProviderService.js';
import { transition, postReversalEntries } from '../services/paymentService.js';
import { settleAndNotify } from './paymentController.js';

/**
 * Payment provider webhooks.
 *
 * This is the AUTHORITATIVE confirmation of a payment - the browser redirect
 * is only a hint. Three properties matter:
 *
 *   1. SIGNATURE. The raw request body is HMAC-verified against the webhook
 *      secret before anything is read from it. An unsigned or mis-signed
 *      request is recorded and rejected without touching a payment.
 *
 *   2. IDEMPOTENCY. Providers retry until they get a 2xx, so the same event
 *      arrives repeatedly. The unique (provider, event_id) index means the
 *      second delivery cannot re-apply a financial effect; we return 200 so
 *      the provider stops retrying.
 *
 *   3. NO EXCEPTIONS ESCAPE. A 5xx makes the provider retry forever. Handler
 *      failures are recorded on the event row and still answered 200 unless
 *      the signature itself was bad.
 *
 * The route is mounted with a raw body parser (see app.js) because JSON
 * re-serialisation would change the bytes the signature was computed over.
 */

/** Digs the payment/order id out of a provider payload, defensively. */
const extractIds = (payload) => {
  const entity = payload?.payload?.payment?.entity || payload?.payload?.refund?.entity || {};
  return {
    providerPaymentId: entity.id || payload?.payment_id || null,
    providerOrderId: entity.order_id || payload?.order_id || null,
    errorDescription: entity.error_description || null
  };
};

/** POST /api/payments/webhook */
export const handleWebhook = async (req, res) => {
  const providerName = activeProviderName();

  // req.body is a Buffer here - see the raw parser in app.js.
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const signature =
    req.get('x-razorpay-signature') || req.get('x-webhook-signature') || req.get('x-signature') || '';

  let signatureValid = false;
  try {
    signatureValid = provider().verifyWebhookSignature({ rawBody, signature });
  } catch {
    signatureValid = false;
  }

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ code: 'BAD_PAYLOAD', message: 'Malformed webhook body.' });
  }

  const eventType = payload?.event || payload?.type || 'unknown';
  // Providers do not always send an explicit id; fall back to something stable
  // for this delivery so the uniqueness guarantee still applies.
  const eventId =
    payload?.id ||
    req.get('x-razorpay-event-id') ||
    `${eventType}:${extractIds(payload).providerPaymentId || 'na'}`;

  if (!signatureValid) {
    // Recorded for audit, then refused. Nothing financial happens.
    await WebhookEvent.create({
      provider: providerName, event_id: `invalid:${eventId}:${Date.now()}`, event_type: eventType,
      signature_valid: false, processed: false, process_error: 'Invalid signature'
    }).catch(() => {});
    return res.status(400).json({ code: 'INVALID_SIGNATURE', message: 'Signature verification failed.' });
  }

  // The idempotency gate.
  let event;
  try {
    event = await WebhookEvent.create({
      provider: providerName, event_id: eventId, event_type: eventType,
      signature_valid: true, processed: false, payload
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Already seen. Acknowledge so the provider stops retrying.
      return res.status(200).json({ success: true, duplicate: true });
    }
    console.error('webhook record failed:', error.message);
    return res.status(200).json({ success: true, recorded: false });
  }

  try {
    const { providerPaymentId, providerOrderId, errorDescription } = extractIds(payload);
    const payment = providerOrderId || providerPaymentId
      ? await Payment.findOne({
          $or: [
            ...(providerOrderId ? [{ provider_order_id: providerOrderId }] : []),
            ...(providerPaymentId ? [{ provider_payment_id: providerPaymentId }] : [])
          ]
        })
      : null;

    if (!payment) {
      await WebhookEvent.updateOne({ _id: event._id }, { $set: { processed: true, process_error: 'No matching payment' } });
      return res.status(200).json({ success: true, matched: false });
    }

    switch (eventType) {
      case 'payment.captured':
      case 'payment.authorized': {
        if (payment.status !== 'SUCCESS') {
          const moved = await transition(payment, 'SUCCESS', { provider_payment_id: providerPaymentId });
          if (moved.ok) await settleAndNotify(moved.payment);
        }
        break;
      }
      case 'payment.failed': {
        if (!['SUCCESS', 'REFUNDED'].includes(payment.status)) {
          await transition(payment, 'FAILED', {
            provider_payment_id: providerPaymentId,
            failure_reason: (errorDescription || 'Payment failed').slice(0, 300)
          });
        }
        break;
      }
      case 'refund.processed':
      case 'refund.created': {
        if (payment.status === 'REFUND_PROCESSING' || payment.status === 'REFUND_REQUESTED') {
          const target = payment.status === 'REFUND_REQUESTED' ? 'REFUND_PROCESSING' : 'REFUNDED';
          const moved = await transition(payment, target);
          if (moved.ok && target === 'REFUNDED') await postReversalEntries(moved.payment, { reason: 'Refund' });
        }
        break;
      }
      default:
        // Unhandled event types are recorded and acknowledged, not errors.
        break;
    }

    await WebhookEvent.updateOne(
      { _id: event._id },
      { $set: { processed: true, payment_id: payment._id } }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('webhook processing error:', error);
    await WebhookEvent.updateOne(
      { _id: event._id },
      { $set: { processed: false, process_error: String(error.message).slice(0, 300) } }
    ).catch(() => {});
    // Still 200: the event is recorded, and a retry storm helps nobody.
    return res.status(200).json({ success: false, recorded: true });
  }
};

export default { handleWebhook };
