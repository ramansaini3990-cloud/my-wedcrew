import rateLimit from 'express-rate-limit';

/**
 * Rate limiters.
 *
 * All limits are configurable from the environment so they can be tightened in
 * production without a code change. The defaults below are the documented
 * baseline.
 *
 * THE WEBHOOK IS NEVER RATE LIMITED. Razorpay retries failed deliveries in
 * bursts, and a throttled webhook means a payment that settled with the
 * provider is never settled in our ledger. That exclusion is enforced twice:
 *
 *   1. by ORDER  - app.js mounts POST /api/payments/webhook before any limiter,
 *                  so the request never reaches one; and
 *   2. by SKIP   - `skipWebhook` below, so a future reordering of app.js cannot
 *                  silently start throttling it.
 *
 * Belt and braces on purpose: the failure mode is lost money, not a slow page.
 */

const WEBHOOK_PATH = '/api/payments/webhook';

/** True for the provider webhook, whatever it is mounted under. */
const isWebhook = (req) => {
  // originalUrl is the full path regardless of where a router was mounted.
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return path === WEBHOOK_PATH;
};

const intFromEnv = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const WINDOW_MS = intFromEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000); // 15 minutes

/**
 * Rejection payload. Matches the shape used by corsErrorHandler and the rest
 * of the codebase: { success, error, message }.
 */
const jsonHandler = (req, res) =>
  res.status(429).json({
    success: false,
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a few minutes and try again.',
  });

const base = {
  windowMs: WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  skip: isWebhook,
};

/**
 * Login and registration. Deliberately strict: this is the credential-stuffing
 * surface. Counts failed AND successful attempts, so a working login is not a
 * way to reset the counter.
 */
export const authLimiter = rateLimit({
  ...base,
  limit: intFromEnv('RATE_LIMIT_AUTH_MAX', 10),
});

/**
 * Payment creation, verification, refunds and withdrawal requests. Every one
 * of these can move money or open a provider order.
 */
export const paymentLimiter = rateLimit({
  ...base,
  limit: intFromEnv('RATE_LIMIT_PAYMENT_MAX', 20),
});

/** Broad backstop across the whole API. Generous enough not to affect real use. */
export const apiLimiter = rateLimit({
  ...base,
  limit: intFromEnv('RATE_LIMIT_API_MAX', 300),
});

export default { authLimiter, paymentLimiter, apiLimiter };
