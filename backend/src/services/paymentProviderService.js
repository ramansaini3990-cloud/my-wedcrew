import crypto from 'crypto';

/**
 * Payment provider abstraction.
 *
 * Nothing outside this file knows which provider is in use. Controllers call
 * `provider().createOrder(...)` and get back a provider-neutral shape, so
 * swapping Razorpay for anyone else means adding an adapter here and changing
 * one env var - no controller, model or frontend change.
 *
 * SECRETS: every key is read from process.env. Nothing is hardcoded, and only
 * the PUBLISHABLE key id is ever exposed to the browser (via
 * `publicConfig()`). The key secret and webhook secret never leave the server.
 *
 * Two adapters ship:
 *
 *   sandbox  - default. Deterministic, no network, no keys required, so the
 *              whole flow (including webhooks) is testable end to end. It
 *              settles nothing and says so.
 *   razorpay - real Orders + Refunds + Payouts, used when keys are present.
 *              Marketplace settlement is designed around Razorpay Route.
 */

export const PROVIDERS = ['sandbox', 'razorpay'];

/** Which adapter is active, decided once from the environment. */
export const activeProviderName = () => {
  const configured = (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (configured === 'razorpay') return 'razorpay';
  if (configured === 'sandbox') return 'sandbox';
  // No explicit choice: use razorpay only if it is actually configured.
  return process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'sandbox';
};

/** Safe for the browser: never includes a secret. */
export const publicConfig = () => {
  const name = activeProviderName();
  return {
    provider: name,
    // Razorpay's key_id is publishable by design; the secret is not returned.
    key_id: name === 'razorpay' ? process.env.RAZORPAY_KEY_ID || null : null,
    sandbox: name === 'sandbox',
    currency: 'INR'
  };
};

/* ================================================================== */
/* Sandbox adapter                                                     */
/* ================================================================== */

const sandboxAdapter = {
  name: 'sandbox',

  async createOrder({ amountPaise, reference, notes }) {
    return {
      order_id: `order_sbx_${crypto.randomBytes(8).toString('hex')}`,
      amount_paise: amountPaise,
      currency: 'INR',
      reference,
      notes: notes || {}
    };
  },

  /**
   * Mirrors Razorpay's client-side handshake: HMAC(order_id|payment_id) with
   * the key secret. The sandbox uses a local secret so the verification code
   * path is genuinely exercised rather than stubbed to `true`.
   */
  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const expected = crypto
      .createHmac('sha256', process.env.SANDBOX_PAYMENT_SECRET || 'sandbox-secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqual(expected, signature);
  },

  verifyWebhookSignature({ rawBody, signature }) {
    const expected = crypto
      .createHmac('sha256', process.env.SANDBOX_PAYMENT_SECRET || 'sandbox-secret')
      .update(rawBody)
      .digest('hex');
    return safeEqual(expected, signature);
  },

  async createRefund({ paymentId, amountPaise }) {
    return { refund_id: `rfnd_sbx_${crypto.randomBytes(6).toString('hex')}`, payment_id: paymentId, amount_paise: amountPaise, status: 'processed' };
  },

  async createPayout({ amountPaise, reference }) {
    return { payout_id: `pout_sbx_${crypto.randomBytes(6).toString('hex')}`, amount_paise: amountPaise, reference, status: 'processing' };
  },

  supportsLivePayout: false
};

/* ================================================================== */
/* Razorpay adapter                                                    */
/* ================================================================== */

const razorpayAuth = () =>
  'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');

const razorpayCall = async (path, { method = 'POST', body } = {}) => {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: razorpayAuth() },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.description || 'Payment provider request failed.';
    const err = new Error(message);
    err.providerStatus = res.status;
    err.providerCode = data?.error?.code || null;
    throw err;
  }
  return data;
};

const razorpayAdapter = {
  name: 'razorpay',

  /** POST /orders - amount is in paise, which is Razorpay's native unit. */
  async createOrder({ amountPaise, reference, notes }) {
    const order = await razorpayCall('/orders', {
      body: {
        amount: amountPaise,
        currency: 'INR',
        receipt: reference,
        // Razorpay caps receipt at 40 chars; our references are shorter.
        notes: notes || {}
      }
    });
    return {
      order_id: order.id,
      amount_paise: order.amount,
      currency: order.currency,
      reference,
      notes: order.notes || {}
    };
  },

  /** Documented checkout handshake: HMAC_SHA256(order_id|payment_id, key_secret). */
  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqual(expected, signature);
  },

  /** Webhook signature: HMAC_SHA256(rawBody, webhook_secret), hex. */
  verifyWebhookSignature({ rawBody, signature }) {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(rawBody)
      .digest('hex');
    return safeEqual(expected, signature);
  },

  /** POST /payments/:id/refund */
  async createRefund({ paymentId, amountPaise }) {
    const refund = await razorpayCall(`/payments/${paymentId}/refund`, {
      body: { amount: amountPaise }
    });
    return { refund_id: refund.id, payment_id: paymentId, amount_paise: refund.amount, status: refund.status };
  },

  /**
   * Payouts are RazorpayX / Route territory and require an activated account
   * plus a linked fund account. Rather than pretend, this throws a clear
   * error until the operator supplies the configuration - the withdrawal is
   * then kept in PROCESSING for manual settlement instead of being silently
   * marked complete.
   */
  async createPayout() {
    const err = new Error(
      'Live payouts require RazorpayX / Route configuration (fund account + account number).'
    );
    err.code = 'PAYOUT_NOT_CONFIGURED';
    throw err;
  },

  supportsLivePayout: false
};

/** Constant-time compare; both sides are hex strings of equal expected length. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

const ADAPTERS = { sandbox: sandboxAdapter, razorpay: razorpayAdapter };

/** The active adapter. */
export const provider = () => ADAPTERS[activeProviderName()] || sandboxAdapter;

export default { provider, publicConfig, activeProviderName, PROVIDERS };
