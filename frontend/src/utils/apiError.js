/**
 * Turns an axios error into a sentence a person can act on.
 *
 * The case that prompted this: a rate-limited gallery write answered "Too many
 * requests. Please wait a few minutes and try again." Which minutes? It did not
 * even read as a rate limit, so a throttled Instagram embed looked like a
 * broken embed. The server now returns `retry_after_seconds`, and this is the
 * one place that turns it into "you can try again in 4 minutes".
 *
 * Use `describeApiError` for a plain string, or `describeApiFailure` when the
 * caller wants the structured form too (a countdown that ticks, say).
 */

/** "45 seconds" / "4 minutes" - never "a few". */
export const formatWait = (seconds) => {
  const s = Math.max(1, Math.ceil(Number(seconds) || 0));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? '' : 's'}`;
};

/**
 * Seconds until a 429 clears.
 *
 * Prefers the body's own figure, then the standard headers. `RateLimit-Reset`
 * is seconds-remaining under the draft standard; `Retry-After` may be either
 * seconds or an HTTP date, so both forms are handled.
 */
export const retryAfterSeconds = (error) => {
  const body = error?.response?.data;
  if (typeof body?.retry_after_seconds === 'number' && body.retry_after_seconds > 0) {
    return Math.ceil(body.retry_after_seconds);
  }

  const headers = error?.response?.headers || {};
  const reset = Number(headers['ratelimit-reset']);
  if (Number.isFinite(reset) && reset > 0) return Math.ceil(reset);

  const retry = headers['retry-after'];
  if (retry) {
    const asNumber = Number(retry);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.ceil(asNumber);
    const asDate = Date.parse(retry);
    if (!Number.isNaN(asDate)) return Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
  }

  return null;
};

export const isRateLimited = (error) => error?.response?.status === 429;

/**
 * @returns {{message: string, rateLimited: boolean, retryAfter: number|null, code: string|null}}
 */
export const describeApiFailure = (error, fallback = 'Something went wrong. Please try again.') => {
  const status = error?.response?.status;
  const data = error?.response?.data || {};

  if (status === 429) {
    const retryAfter = retryAfterSeconds(error);
    return {
      rateLimited: true,
      retryAfter,
      code: 'RATE_LIMITED',
      message: retryAfter
        ? `Too many attempts. This is a temporary limit — you can try again in ${formatWait(retryAfter)}.`
        : 'Too many attempts. This is a temporary limit — please try again shortly.'
    };
  }

  // No response at all: the request never completed.
  if (!error?.response) {
    return {
      rateLimited: false,
      retryAfter: null,
      code: error?.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK',
      message:
        error?.code === 'ECONNABORTED'
          ? 'That took too long. Check your connection and try again.'
          : 'We could not reach the server. Check your connection and try again.'
    };
  }

  return {
    rateLimited: false,
    retryAfter: null,
    code: data.code || null,
    message: data.message || fallback
  };
};

/** The common case: just the sentence. */
export const describeApiError = (error, fallback) => describeApiFailure(error, fallback).message;

export default { describeApiError, describeApiFailure, retryAfterSeconds, isRateLimited, formatWait };
