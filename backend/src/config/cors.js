/**
 * CORS origin policy — single authority for both Express and Socket.IO.
 *
 * Behaviour:
 *   - Origins are read from CORS_ORIGINS (comma-separated, no trailing slash).
 *   - A request with NO Origin header is always allowed. This is required:
 *     the Razorpay webhook, curl, the E2E suites and server-to-server calls
 *     send no Origin. Browsers always send one, so this is not a bypass.
 *   - Outside production, localhost/127.0.0.1/[::1] are allowed automatically
 *     so `npm run dev` keeps working with no .env change.
 *   - Outside production, private LAN ranges are allowed only when
 *     CORS_ALLOW_LAN=true (the phone-on-the-same-wifi testing case).
 *   - In production nothing is implicit. Empty CORS_ORIGINS means every
 *     cross-origin browser request is rejected — it fails closed, loudly.
 */

const stripTrailingSlash = (value) => String(value).replace(/\/+$/, '');

const parseOriginList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => stripTrailingSlash(entry.trim()))
    .filter(Boolean);

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const PRIVATE_LAN_ORIGIN =
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const isProduction = () => process.env.NODE_ENV === 'production';
const lanAllowed = () => String(process.env.CORS_ALLOW_LAN || '').toLowerCase() === 'true';

export const allowedOrigins = () => parseOriginList(process.env.CORS_ORIGINS);

export function isOriginAllowed(origin) {
  if (!origin) return true; // no Origin header — not a browser cross-origin request

  const candidate = stripTrailingSlash(origin);

  if (allowedOrigins().includes(candidate)) return true;

  if (!isProduction()) {
    if (LOOPBACK_ORIGIN.test(candidate)) return true;
    if (lanAllowed() && PRIVATE_LAN_ORIGIN.test(candidate)) return true;
  }

  return false;
}

/** Thrown so the error handler can map it to 403 rather than a 500 stack trace. */
export class CorsOriginError extends Error {
  constructor(origin) {
    super('CORS_ORIGIN_NOT_ALLOWED');
    this.name = 'CorsOriginError';
    this.status = 403;
    this.origin = origin;
  }
}

/** Options object for the `cors` express middleware. */
export const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new CorsOriginError(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Idempotency-Key is REQUIRED here. POST /api/payments sends it, and a strict
  // CORS policy that omits it will fail the preflight and silently break the
  // payment idempotency guarantee. Do not remove it.
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

/** Options object for the Socket.IO server constructor. */
export const socketCorsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new CorsOriginError(origin));
  },
  credentials: true,
  methods: ['GET', 'POST'],
};

/** Express error handler for rejected origins. Mount AFTER all routes. */
export function corsErrorHandler(err, req, res, next) {
  if (err instanceof CorsOriginError || err?.message === 'CORS_ORIGIN_NOT_ALLOWED') {
    return res.status(403).json({
      success: false,
      error: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'This origin is not permitted to call the WedCrew API.',
    });
  }
  return next(err);
}

/** Call once at boot. Prints the effective policy. */
export function logCorsPolicy(logger = console) {
  const list = allowedOrigins();

  if (isProduction() && list.length === 0) {
    logger.warn(
      '[cors] PRODUCTION WITH EMPTY CORS_ORIGINS — every cross-origin browser ' +
        'request will be rejected with 403. Set CORS_ORIGINS to your frontend URL.'
    );
    return;
  }

  const extras = [];
  if (!isProduction()) extras.push('localhost');
  if (!isProduction() && lanAllowed()) extras.push('private LAN');

  logger.log(
    `[cors] allow-list: ${list.length ? list.join(', ') : '(none)'}` +
      (extras.length ? ` | auto-allowed in dev: ${extras.join(', ')}` : '')
  );
}
