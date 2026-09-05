import dns from 'dns';

/**
 * Email address validation, in three layers of increasing cost:
 *
 *   1. FORMAT      — cheap, local, deterministic
 *   2. DISPOSABLE  — cheap, local, a blocklist of throwaway providers
 *   3. MX RECORD   — a DNS lookup; proves the domain can receive mail at all
 *
 * DESIGN NOTE — the MX check FAILS OPEN.
 *
 * This machine's system resolver (127.0.0.1) has been observed refusing SRV
 * queries, which already breaks mongodb+srv://. It may refuse MX queries too.
 * A resolver problem is an infrastructure fault on OUR side, and it must never
 * become "nobody can sign up". So a timeout, a refusal, or any resolver error
 * ALLOWS the address and logs a warning. Only a definitive "this domain has no
 * MX records" rejects.
 *
 * The lookup uses its own Resolver instance with explicit public nameservers.
 * It deliberately does NOT call the global dns.setServers(), because that
 * would change resolution for the whole process — including the Mongoose SRV
 * connection.
 *
 * Role-based addresses (info@, admin@, contact@) are NOT rejected: real
 * production companies sign up with them.
 */

/** Deliberately strict, but not so strict it rejects valid production addresses. */
const EMAIL_FORMAT = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;

/**
 * Known throwaway/disposable mail providers. Matched on the exact domain AND
 * any subdomain of it, so `foo.mailinator.com` is caught too.
 *
 * Extend this list as new ones appear — it is the only place to change.
 */
export const DISPOSABLE_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  '10minutemail.com',
  '10minutemail.net',
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.net',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'trashmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'spamgourmet.com',
  'emailondeck.com',
  'burnermail.io',
  'moakt.com',
  'tmail.ws',
  'discard.email'
];

const MX_TIMEOUT_MS = 3000;

const mxCheckEnabled = () =>
  String(process.env.EMAIL_MX_CHECK_ENABLED ?? 'true').toLowerCase() !== 'false';

/** Lowercased, trimmed. The form we store and compare against. */
export const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

export const domainOf = (email) => normaliseEmail(email).split('@')[1] || '';

/** Exact domain or any subdomain of a blocked domain. */
export const isDisposableDomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  return DISPOSABLE_DOMAINS.some((blocked) => d === blocked || d.endsWith(`.${blocked}`));
};

/**
 * Does this domain publish MX records?
 *
 * @returns {Promise<{hasMx: boolean, checked: boolean, reason?: string}>}
 *          `checked:false` means the lookup could not be completed and the
 *          caller must NOT treat it as a failure.
 */
export const hasMxRecords = async (domain) => {
  if (!domain) return { hasMx: false, checked: true, reason: 'no domain' };
  if (!mxCheckEnabled()) return { hasMx: true, checked: false, reason: 'mx check disabled' };

  // Dedicated resolver — never touches global DNS configuration.
  const resolver = new dns.promises.Resolver();
  try {
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // Some environments refuse setServers; fall back to system defaults.
  }

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ __timedOut: true }), MX_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([resolver.resolveMx(domain), timeout]);

    if (result?.__timedOut) {
      console.warn(`[email-validation] MX lookup for "${domain}" timed out — allowing (fail open).`);
      return { hasMx: true, checked: false, reason: 'timeout' };
    }

    const records = Array.isArray(result) ? result.filter((r) => r?.exchange) : [];
    // An empty MX set is a definitive answer: the domain cannot receive mail.
    return { hasMx: records.length > 0, checked: true };
  } catch (error) {
    const code = error?.code || '';

    // NXDOMAIN / NODATA are definitive answers from a working resolver.
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return { hasMx: false, checked: true, reason: code };
    }

    // Anything else (ECONNREFUSED, ESERVFAIL, EREFUSED, ETIMEOUT...) is OUR
    // resolver misbehaving. Never punish the user for that.
    console.warn(`[email-validation] MX lookup for "${domain}" failed (${code || error.message}) — allowing (fail open).`);
    return { hasMx: true, checked: false, reason: code || 'resolver error' };
  } finally {
    try { resolver.cancel(); } catch { /* already settled */ }
  }
};

/**
 * Full validation.
 *
 * @returns {Promise<{ok: true, email: string} | {ok: false, code: string, message: string}>}
 *          Codes: INVALID_EMAIL | DISPOSABLE_EMAIL | DOMAIN_CANNOT_RECEIVE_MAIL
 */
export const validateEmailAddress = async (rawEmail) => {
  const email = normaliseEmail(rawEmail);

  if (!email || email.length > 254 || !EMAIL_FORMAT.test(email)) {
    return { ok: false, code: 'INVALID_EMAIL', message: 'Enter a valid email address.' };
  }

  const domain = domainOf(email);

  if (isDisposableDomain(domain)) {
    return {
      ok: false,
      code: 'DISPOSABLE_EMAIL',
      message: 'Temporary or disposable email addresses are not accepted. Please use a permanent address.'
    };
  }

  const mx = await hasMxRecords(domain);
  if (mx.checked && !mx.hasMx) {
    return {
      ok: false,
      code: 'DOMAIN_CANNOT_RECEIVE_MAIL',
      message: `"${domain}" cannot receive email. Check the address for a typo.`
    };
  }

  return { ok: true, email };
};

export default {
  validateEmailAddress,
  isDisposableDomain,
  hasMxRecords,
  normaliseEmail,
  domainOf,
  DISPOSABLE_DOMAINS
};
