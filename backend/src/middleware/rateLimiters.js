import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

/**
 * Rate limiters.
 *
 * THE PRINCIPLE
 * These exist to stop abuse that COSTS SOMETHING - a credential guessing run,
 * a script filling the disk, a burst of provider orders, a mailbox flooded via
 * our sending quota. They are not a meter on how much a signed-in customer may
 * use the product they are paying for.
 *
 * The previous shape got that backwards. A single flat 300/15min across all of
 * /api meant a freelancer adding Instagram links to their portfolio - an
 * ordinary JSON write that touches no disk, no money and no third party - was
 * throttled alongside genuine abuse, and the failure looked like a broken
 * embed rather than a limit.
 *
 * WHAT DECIDES A BUCKET
 * Whether the operation consumes DISK, MONEY or a THIRD-PARTY QUOTA - never
 * which controller it happens to live in. POST /api/gallery/upload writes a
 * file of up to 100MB and is limited; POST /api/gallery stores a URL string
 * and is not, even though they are neighbours in the same router.
 *
 * KEYING
 * Where the caller proves who they are, the bucket is theirs alone. Keying
 * everything by IP meant three colleagues behind one office NAT shared one
 * budget, and one of them exhausting it locked out the others.
 *
 * THE WEBHOOK IS NEVER RATE LIMITED. Razorpay retries failed deliveries in
 * bursts, and a throttled webhook means a payment that settled with the
 * provider is never settled in our ledger. That exclusion is enforced twice:
 *
 *   1. by ORDER  - app.js mounts POST /api/payments/webhook before any limiter,
 *                  so the request never reaches one; and
 *   2. by SKIP   - `isWebhook` below, so a future reordering of app.js cannot
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

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * The caller's user id, but only if they can PROVE it.
 *
 * The signature is verified rather than the header merely inspected -
 * otherwise anyone could send `Authorization: Bearer anything` and promote
 * themselves into the generous authenticated bucket. Verifying an HMAC costs
 * microseconds; this runs before the route's own `protect`, which re-verifies
 * properly and remains the actual authorisation.
 */
const verifiedUserId = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return payload?.id ? String(payload.id) : null;
  } catch {
    return null;
  }
};

/** IPv6-safe IP key. express-rate-limit's helper collapses a /56 prefix. */
const ipKey = (req) => `ip:${ipKeyGenerator(req.ip || '')}`;

/** A signed-in caller gets their own budget; everyone else shares by IP. */
const userOrIpKey = (req) => {
  const id = verifiedUserId(req);
  return id ? `user:${id}` : ipKey(req);
};

/* ------------------------------------------------------------------ */
/* Rejection payload                                                   */
/* ------------------------------------------------------------------ */

const humanise = (seconds) => {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

/**
 * A 429 that says what actually happened and when it clears.
 *
 * The old message was "Too many requests. Please wait a few minutes and try
 * again." - which minutes? It was not even obviously a rate limit, so a
 * throttled gallery write read as a broken Instagram embed. The reset time is
 * already tracked by the limiter, so there is no reason to withhold it.
 */
const makeHandler = (scope) => (req, res) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfter = resetTime
    ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
    : Math.ceil(WINDOW_MS / 1000);

  res.set('Retry-After', String(retryAfter));

  res.status(429).json({
    success: false,
    error: 'RATE_LIMITED',
    code: 'RATE_LIMITED',
    scope,
    retry_after_seconds: retryAfter,
    reset_at: resetTime ? new Date(resetTime).toISOString() : null,
    message: `Too many attempts. This is a temporary limit — you can try again in ${humanise(retryAfter)}.`
  });
};

const base = (scope) => ({
  windowMs: WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(scope),
  skip: isWebhook
});

/* ------------------------------------------------------------------ */
/* Buckets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Broad backstop across the whole API.
 *
 * Two ceilings, because the two populations are not comparable. An anonymous
 * caller is a scraping surface and keeps the old 300. A caller holding a valid
 * token gets a ceiling only a script would reach - a heavy dashboard session
 * (dashboard load, every tab, searches, filters, a batch of gallery edits)
 * measures in the low hundreds of requests.
 */
export const apiLimiter = rateLimit({
  ...base('api'),
  limit: (req) =>
    verifiedUserId(req)
      ? intFromEnv('RATE_LIMIT_API_AUTHED_MAX', 5000)
      : intFromEnv('RATE_LIMIT_API_MAX', 300),
  keyGenerator: userOrIpKey
});

/**
 * Credential endpoints: login, register, email verification, password change
 * and reset. Strict because this faces the open internet, but no longer so
 * strict that a person signing up, mistyping once and retrying is locked out.
 */
export const authLimiter = rateLimit({
  ...base('auth'),
  limit: intFromEnv('RATE_LIMIT_AUTH_MAX', 30),
  keyGenerator: userOrIpKey
});

/**
 * Failed logins PER ACCOUNT, which is the defence that actually matters:
 * an attacker guessing one password rotates IPs, and authLimiter above cannot
 * see that. Keyed on the submitted address, so it behaves identically whether
 * or not that account exists and cannot be used to probe for one.
 *
 * Only genuine credential failures count (401). A correct password that is
 * refused for another reason - an unverified email answers 403 - must not
 * burn the budget, or a user stuck on verification would lock themselves out
 * of the account they are trying to confirm.
 *
 * Nothing is locked permanently; the window simply expires.
 */
export const loginAccountLimiter = rateLimit({
  ...base('login_account'),
  limit: intFromEnv('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 8),
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? `login:${email}` : ipKey(req);
  }
});

/**
 * Anything that puts a message in somebody's inbox: verification resends and
 * password-reset requests.
 *
 * The cost here is a third-party sending quota and a stranger's attention -
 * an unthrottled reset endpoint is a way to mail-bomb someone else's address.
 * Keyed by the TARGET address, so one attacker cannot spread the load across
 * IPs, with an IP fallback when no address was supplied.
 *
 * These endpoints also carry their own 60-second per-account cooldown in the
 * controller; this is the outer bound on top of it.
 */
export const emailLimiter = rateLimit({
  ...base('email'),
  limit: intFromEnv('RATE_LIMIT_EMAIL_MAX', 6),
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? `mail:${email}` : ipKey(req);
  }
});

/**
 * Payment creation, verification, refunds and withdrawal requests. Every one
 * of these can move money or open a provider order.
 *
 * Raised from 20: a company settling a crew of a dozen, or an admin working
 * through a finance queue, exceeded that in a single sitting - and so did
 * re-running the payment E2E suite, which is how the old limit was found.
 */
export const paymentLimiter = rateLimit({
  ...base('payment'),
  limit: intFromEnv('RATE_LIMIT_PAYMENT_MAX', 60),
  keyGenerator: userOrIpKey
});

/**
 * Portfolio media UPLOAD only - the one route in the API that accepts a
 * multipart file and writes up to 100MB to local disk.
 *
 * Deliberately NOT applied to POST /api/gallery, which stores a YouTube or
 * Instagram URL and costs nothing. Grouping those two together because they
 * share a router is what throttled ordinary portfolio editing.
 *
 * A rate limit is the wrong tool for total storage - that wants a per-account
 * quota. This only stops a script hammering the endpoint; a freelancer
 * uploading a portfolio in one batch stays well inside it.
 */
export const uploadLimiter = rateLimit({
  ...base('upload'),
  limit: intFromEnv('RATE_LIMIT_UPLOAD_MAX', 60),
  keyGenerator: userOrIpKey
});

export default {
  apiLimiter,
  authLimiter,
  loginAccountLimiter,
  emailLimiter,
  paymentLimiter,
  uploadLimiter
};
