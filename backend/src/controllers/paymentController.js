import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import BookingRequest from '../models/BookingRequest.js';
import FinanceSetting from '../models/FinanceSetting.js';
import Notification from '../models/Notification.js';
import { emitNotification } from '../socket.js';
import { logFromRequest } from '../services/activityService.js';
import { rupeesToPaise, formatPaise } from '../services/money.js';
import { provider, publicConfig, activeProviderName } from '../services/paymentProviderService.js';
import {
  quote, transition, postSettlementEntries, postReversalEntries,
  toPaymentDTO, newPaymentReference
} from '../services/paymentService.js';
import { getCompanyTotals } from '../services/ledgerService.js';
import { areConnected } from '../services/connectionService.js';

/**
 * Company-facing payments, plus the cash settlement actions the freelancer
 * performs. Booking status and payment status are kept strictly separate -
 * nothing here writes to a BookingRequest.
 *
 * Authorisation is by ownership on every route: a payment is only ever visible
 * to its own company, its own freelancer, or an admin.
 */

const idOf = (req) => req.user.id || req.user._id;

const notify = async (recipientId, role, type, title, message) => {
  try {
    const n = await Notification.create({
      recipient_id: recipientId, recipient_role: role, type, title, message
    });
    emitNotification(recipientId, n);
  } catch (error) {
    // A notification failure must never roll back a financial action.
    console.error('payment notification failed:', error.message);
  }
};

/**
 * GET /api/payments/config
 *
 * Publishable checkout configuration. publicConfig() deliberately omits every
 * secret - only the provider name and the publishable key id are returned.
 */
export const getPaymentConfig = async (req, res) => {
  try {
    const settings = await FinanceSetting.current();
    res.json({
      success: true,
      data: {
        ...publicConfig(),
        fee_bps: settings.fee_bps,
        min_withdrawal_paise: settings.min_withdrawal_paise
      }
    });
  } catch (error) {
    console.error('getPaymentConfig error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load payment settings.' });
  }
};

/**
 * POST /api/payments
 *
 * Creates a payment. Companies only, for a freelancer they are connected to.
 * `method: 'online'` also opens a provider order; `method: 'cash'` starts the
 * offline settlement flow at CASH_PENDING.
 */
export const createPayment = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only companies can make payments.' });
    }

    const companyId = idOf(req);
    const { freelancer_id, booking_request_id, requirement_id, method, note } = req.body;

    if (!['online', 'cash'].includes(method)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Choose Online or Cash.' });
    }
    if (!mongoose.isValidObjectId(freelancer_id)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Select a professional.' });
    }

    const amount = rupeesToPaise(req.body.amount);
    if (!amount.ok) return res.status(400).json({ code: 'VALIDATION_ERROR', message: amount.message });

    const freelancer = await User.findOne({ _id: freelancer_id, role: 'freelancer' }).select('name').lean();
    if (!freelancer) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Professional not found.' });
    }

    // Money may only move between parties who already have a relationship.
    if (!(await areConnected(companyId, freelancer_id))) {
      return res.status(403).json({
        code: 'NOT_CONNECTED',
        message: 'You can only pay a professional you are connected with.'
      });
    }

    if (booking_request_id) {
      const booking = await BookingRequest.findOne({
        _id: booking_request_id, company_id: companyId, freelancer_id
      }).select('_id').lean();
      if (!booking) {
        return res.status(400).json({ code: 'INVALID_BOOKING', message: 'That booking does not belong to you.' });
      }
    }

    const split = await quote(amount.paise);

    // Idempotency: the same key from the same company returns the original
    // payment instead of creating a second one.
    const idempotencyKey = (req.get('Idempotency-Key') || req.body.idempotency_key || '').trim() || null;
    if (idempotencyKey) {
      const existing = await Payment.findOne({ company_id: companyId, idempotency_key: idempotencyKey });
      if (existing) {
        return res.status(200).json({ success: true, idempotent_replay: true, data: toPaymentDTO(existing) });
      }
    }

    const doc = {
      reference: newPaymentReference(),
      company_id: companyId,
      freelancer_id,
      booking_request_id: booking_request_id || undefined,
      requirement_id: requirement_id || undefined,
      method,
      status: method === 'cash' ? 'CASH_PENDING' : 'INITIATED',
      amount_paise: split.gross,
      fee_paise: split.fee,
      net_paise: split.net,
      fee_bps_applied: split.fee_bps,
      currency: split.currency,
      idempotency_key: idempotencyKey,
      note: note ? String(note).slice(0, 500) : undefined
    };

    let checkout = null;
    if (method === 'online') {
      try {
        const order = await provider().createOrder({
          amountPaise: split.gross,
          reference: doc.reference,
          notes: { company_id: String(companyId), freelancer_id: String(freelancer_id) }
        });
        doc.provider = activeProviderName();
        doc.provider_order_id = order.order_id;
        doc.status = 'PENDING';
        checkout = { ...publicConfig(), order_id: order.order_id, amount_paise: order.amount_paise };
      } catch (error) {
        console.error('createOrder failed:', error.message);
        return res.status(502).json({
          code: 'PROVIDER_ERROR',
          message: 'Could not reach the payment provider. Please try again.'
        });
      }
    }

    let payment;
    try {
      payment = await Payment.create(doc);
    } catch (error) {
      if (error?.code === 11000 && idempotencyKey) {
        const existing = await Payment.findOne({ company_id: companyId, idempotency_key: idempotencyKey });
        if (existing) return res.status(200).json({ success: true, idempotent_replay: true, data: toPaymentDTO(existing) });
      }
      throw error;
    }

    if (method === 'cash') {
      await notify(
        freelancer_id, 'freelancer', 'payment_cash_pending', 'Cash payment recorded',
        `A company marked ${formatPaise(payment.amount_paise)} as a cash payment. Confirm once you receive it.`
      );
    }

    await logFromRequest(req, {
      eventType: 'payment.initiated',
      category: 'payments',
      title: method === 'cash' ? 'Cash payment created' : 'Payment initiated',
      description: `${formatPaise(payment.amount_paise)} to ${freelancer.name}`,
      target: { type: 'payment', id: payment._id, label: payment.reference },
      metadata: { method, reference: payment.reference, amount_paise: payment.amount_paise }
    });

    res.status(201).json({ success: true, data: toPaymentDTO(payment), checkout });
  } catch (error) {
    console.error('createPayment error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not start this payment.' });
  }
};

/**
 * POST /api/payments/:id/verify
 *
 * Server-side verification of the checkout handshake. A browser saying
 * "payment succeeded" is never trusted: the signature is recomputed here with
 * the key secret, and only then does the payment settle. The webhook is the
 * second, authoritative confirmation.
 */
export const verifyPayment = async (req, res) => {
  try {
    const payment = await findOwnPayment(req, req.params.id);
    if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    if (payment.method !== 'online') {
      return res.status(400).json({ code: 'NOT_ONLINE', message: 'This is a cash payment.' });
    }
    if (payment.status === 'SUCCESS') {
      return res.json({ success: true, already: true, data: toPaymentDTO(payment) });
    }

    const { provider_payment_id, signature } = req.body;
    if (!provider_payment_id || !signature) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Missing payment confirmation.' });
    }

    const valid = provider().verifyCheckoutSignature({
      orderId: payment.provider_order_id,
      paymentId: provider_payment_id,
      signature
    });

    if (!valid) {
      await transition(payment, 'FAILED', { failure_reason: 'Signature verification failed' });
      await logFromRequest(req, {
        eventType: 'payment.failed',
        category: 'payments',
        severity: 'warning',
        title: 'Payment verification failed',
        description: `Signature mismatch on ${payment.reference}`,
        target: { type: 'payment', id: payment._id, label: payment.reference },
        metadata: { reference: payment.reference }
      });
      return res.status(400).json({ code: 'VERIFICATION_FAILED', message: 'We could not verify this payment.' });
    }

    const moved = await transition(payment, 'SUCCESS', { provider_payment_id });
    if (!moved.ok) return res.status(409).json(moved);

    await settleAndNotify(moved.payment, req);
    res.json({ success: true, data: toPaymentDTO(moved.payment) });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not verify this payment.' });
  }
};

/** Shared settlement side-effects: ledger, notifications, audit. */
export const settleAndNotify = async (payment, req = null) => {
  await postSettlementEntries(payment, { available: true });

  await notify(
    payment.freelancer_id, 'freelancer', 'payment_received', 'Payment received',
    `${formatPaise(payment.net_paise)} has been credited to your earnings.`
  );
  await notify(
    payment.company_id, 'company', 'payment_successful', 'Payment successful',
    `Your payment of ${formatPaise(payment.amount_paise)} was successful.`
  );

  if (req) {
    await logFromRequest(req, {
      eventType: 'payment.succeeded',
      category: 'payments',
      severity: 'success',
      title: 'Payment successful',
      description: `${formatPaise(payment.amount_paise)} settled`,
      target: { type: 'payment', id: payment._id, label: payment.reference },
      metadata: {
        reference: payment.reference,
        method: payment.method,
        amount_paise: payment.amount_paise,
        fee_paise: payment.fee_paise
      }
    });
  }
};

/** A payment the caller is actually a party to. */
const findOwnPayment = async (req, id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const userId = idOf(req);
  const query = { _id: id };
  if (req.user.role === 'company') query.company_id = userId;
  else if (req.user.role === 'freelancer') query.freelancer_id = userId;
  else if (req.user.role !== 'admin') return null;
  return Payment.findOne(query);
};

/** GET /api/payments - the caller's own payments, filtered and paginated. */
export const listPayments = async (req, res) => {
  try {
    const userId = idOf(req);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const query = req.user.role === 'company' ? { company_id: userId } : { freelancer_id: userId };
    if (['online', 'cash'].includes(req.query.method)) query.method = req.query.method;
    if (req.query.status) {
      const wanted = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
      if (wanted.length) query.status = { $in: wanted };
    }

    const [rows, total] = await Promise.all([
      Payment.find(query)
        .populate('company_id', 'name')
        .populate('freelancer_id', 'name profession')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query)
    ]);

    const data = rows.map((p) => toPaymentDTO(p, {
      includeParties: {
        company: p.company_id ? { id: String(p.company_id._id), name: p.company_id.name } : null,
        freelancer: p.freelancer_id
          ? { id: String(p.freelancer_id._id), name: p.freelancer_id.name, profession: p.freelancer_id.profession || null }
          : null
      }
    }));

    const totals = req.user.role === 'company' ? await getCompanyTotals(userId) : null;
    res.json({ success: true, data, totals, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('listPayments error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load payments.' });
  }
};

/** GET /api/payments/:id */
export const getPayment = async (req, res) => {
  try {
    const payment = await findOwnPayment(req, req.params.id);
    if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });

    const [company, freelancer] = await Promise.all([
      User.findById(payment.company_id).select('name').lean(),
      User.findById(payment.freelancer_id).select('name profession').lean()
    ]);

    res.json({
      success: true,
      data: toPaymentDTO(payment, {
        includeParties: {
          company: company ? { id: String(company._id), name: company.name } : null,
          freelancer: freelancer ? { id: String(freelancer._id), name: freelancer.name, profession: freelancer.profession || null } : null
        }
      })
    });
  } catch (error) {
    console.error('getPayment error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load this payment.' });
  }
};

/* ------------------------------------------------------------------ */
/* Cash settlement - freelancer actions                                */
/* ------------------------------------------------------------------ */

/** POST /api/payments/:id/cash-confirm */
export const confirmCash = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the professional can confirm a cash payment.' });
    }
    const payment = await findOwnPayment(req, req.params.id);
    if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    if (payment.method !== 'cash') {
      return res.status(400).json({ code: 'NOT_CASH', message: 'This is not a cash payment.' });
    }

    const moved = await transition(payment, 'CASH_CONFIRMED', {
      cash_confirmed_by: idOf(req),
      cash_confirmed_at: new Date()
    });
    if (!moved.ok) return res.status(409).json(moved);

    await postSettlementEntries(moved.payment, { available: true });
    await notify(
      moved.payment.company_id, 'company', 'payment_cash_confirmed', 'Cash payment confirmed',
      `The professional confirmed receiving ${formatPaise(moved.payment.amount_paise)} in cash.`
    );
    await logFromRequest(req, {
      eventType: 'payment.cash_confirmed',
      category: 'payments',
      severity: 'success',
      title: 'Cash payment confirmed',
      description: `${formatPaise(moved.payment.amount_paise)} confirmed received`,
      target: { type: 'payment', id: moved.payment._id, label: moved.payment.reference },
      metadata: { reference: moved.payment.reference, amount_paise: moved.payment.amount_paise }
    });

    res.json({ success: true, data: toPaymentDTO(moved.payment) });
  } catch (error) {
    console.error('confirmCash error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not confirm this payment.' });
  }
};

/** POST /api/payments/:id/cash-dispute */
export const disputeCash = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the professional can dispute a cash payment.' });
    }
    const payment = await findOwnPayment(req, req.params.id);
    if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    if (payment.method !== 'cash') {
      return res.status(400).json({ code: 'NOT_CASH', message: 'This is not a cash payment.' });
    }

    const reason = String(req.body.reason || '').trim().slice(0, 500);
    if (!reason) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Tell us what went wrong.' });
    }

    const moved = await transition(payment, 'CASH_DISPUTED', { dispute_reason: reason });
    if (!moved.ok) return res.status(409).json(moved);

    // Nothing settles while a dispute is open, so no ledger entry is posted.
    await notify(
      moved.payment.company_id, 'company', 'payment_cash_disputed', 'Cash payment disputed',
      `The professional disputed the ${formatPaise(moved.payment.amount_paise)} cash payment. Our team will review it.`
    );

    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    for (const admin of admins) {
      await notify(
        admin._id, 'admin', 'payment_cash_disputed', 'Cash payment disputed',
        `A ${formatPaise(moved.payment.amount_paise)} cash payment needs review.`
      );
    }

    await logFromRequest(req, {
      eventType: 'payment.cash_disputed',
      category: 'payments',
      severity: 'warning',
      title: 'Cash payment disputed',
      description: `${formatPaise(moved.payment.amount_paise)} disputed`,
      target: { type: 'payment', id: moved.payment._id, label: moved.payment.reference },
      metadata: { reference: moved.payment.reference, reason }
    });

    res.json({ success: true, data: toPaymentDTO(moved.payment) });
  } catch (error) {
    console.error('disputeCash error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not raise this dispute.' });
  }
};

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

/** POST /api/payments/:id/refund - company requests, provider executes. */
export const requestRefund = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the paying company can request a refund.' });
    }
    const payment = await findOwnPayment(req, req.params.id);
    if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });

    const reason = String(req.body.reason || '').trim().slice(0, 500) || 'Refund requested';
    const target = payment.method === 'cash' ? 'CASH_REFUND_REQUESTED' : 'REFUND_REQUESTED';

    const moved = await transition(payment, target, { refund_reason: reason });
    if (!moved.ok) return res.status(409).json(moved);

    await logFromRequest(req, {
      eventType: 'payment.refund_requested',
      category: 'payments',
      title: 'Refund requested',
      description: `${formatPaise(payment.amount_paise)} - ${reason}`,
      target: { type: 'payment', id: payment._id, label: payment.reference },
      metadata: { reference: payment.reference, method: payment.method }
    });

    // A cash refund cannot be executed by an API - it is settled by hand and
    // confirmed by an admin, so we never pretend money moved.
    if (payment.method === 'cash') {
      return res.json({
        success: true,
        data: toPaymentDTO(moved.payment),
        message: 'Cash refunds are settled directly and confirmed by our team.'
      });
    }

    const processing = await transition(moved.payment, 'REFUND_PROCESSING');
    if (!processing.ok) return res.status(409).json(processing);

    try {
      const refund = await provider().createRefund({
        paymentId: processing.payment.provider_payment_id,
        amountPaise: processing.payment.amount_paise
      });
      const done = await transition(processing.payment, 'REFUNDED', { provider_refund_id: refund.refund_id });
      if (done.ok) {
        await postReversalEntries(done.payment, { reason: 'Refund' });
        await notify(
          done.payment.company_id, 'company', 'payment_refunded', 'Refund completed',
          `${formatPaise(done.payment.amount_paise)} has been refunded.`
        );
        await notify(
          done.payment.freelancer_id, 'freelancer', 'payment_reversed', 'Payment reversed',
          `A payment of ${formatPaise(done.payment.net_paise)} was refunded to the company.`
        );
        return res.json({ success: true, data: toPaymentDTO(done.payment) });
      }
      return res.status(409).json(done);
    } catch (error) {
      console.error('refund failed:', error.message);
      await transition(processing.payment, 'REFUND_FAILED', { failure_reason: 'Provider refund failed' });
      return res.status(502).json({ code: 'REFUND_FAILED', message: 'The refund could not be completed.' });
    }
  } catch (error) {
    console.error('requestRefund error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not process this refund.' });
  }
};

export default {
  getPaymentConfig,
  createPayment,
  verifyPayment,
  listPayments,
  getPayment,
  confirmCash,
  disputeCash,
  requestRefund,
  settleAndNotify
};
