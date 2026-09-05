import EmailLog from '../models/EmailLog.js';

/**
 * Transactional email — provider abstraction.
 *
 * Structured exactly like paymentProviderService.js: nothing outside this file
 * knows which provider is in use, so swapping Brevo for anyone else means
 * adding an adapter here and changing one env var.
 *
 * SECRETS: BREVO_API_KEY is read from the environment and is NEVER logged, and
 * never returned by any function here.
 *
 * TOKENS: the `console` adapter prints the verification link by design, so a
 * developer can complete the flow with no mail provider configured. The
 * `brevo` adapter never logs the link or the token.
 *
 * FAILURES NEVER THROW. Registration must succeed even when the mail provider
 * is down — the user can resend. Same contract as activityService.logActivity.
 */

export const PROVIDERS = ['console', 'brevo'];

const REQUEST_TIMEOUT_MS = 10_000;

/** Which adapter is active. `console` is the default, as sandbox is for payments. */
export const activeProviderName = () => {
  const configured = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (configured === 'brevo') return 'brevo';
  if (configured === 'console') return 'console';
  // No explicit choice: use brevo only when it is actually configured.
  return process.env.BREVO_API_KEY ? 'brevo' : 'console';
};

const fromAddress = () => process.env.EMAIL_FROM_ADDRESS || 'no-reply@mywedcrew.com';
const fromName = () => process.env.EMAIL_FROM_NAME || 'mywedcrew.com';

/** Public base URL the verification link points at. */
export const appPublicUrl = () =>
  (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '');

/* ================================================================== */
/* Templates                                                           */
/* ================================================================== */

/**
 * Verification email body.
 *
 * No external images (many clients block them, and a remote image is a
 * tracking pixel by another name). The link appears BOTH as a button and as
 * visible text, because some clients strip anchors styled as buttons.
 */
const verificationTemplate = ({ name, verifyUrl }) => {
  const safeName = String(name || 'there').replace(/[<>&]/g, '');
  return {
    subject: 'Confirm your email address — mywedcrew.com',
    html: `<!doctype html>
<html><body style="margin:0;padding:0;background:#F8F5F0;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0B1835;">
      mywed<span style="color:#DE601E;">crew</span><span style="color:#64748B;">.com</span>
    </p>
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:19px;color:#0B1835;">Confirm your email address</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#0B1835;">
        Hi ${safeName}, thanks for joining mywedcrew.com. Confirm this address to activate your account and sign in.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;background:#DE601E;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">
        Confirm email address
      </a>
      <p style="margin:22px 0 6px;font-size:12px;color:#64748B;">
        If the button does not work, copy this link into your browser:
      </p>
      <p style="margin:0;font-size:12px;word-break:break-all;color:#2563EB;">${verifyUrl}</p>
      <p style="margin:22px 0 0;font-size:12px;color:#64748B;">
        This link expires in 24 hours. If you did not create an account, you can ignore this email.
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:11px;color:#94A3B8;text-align:center;">
      Sent by mywedcrew.com — India's wedding production network.
    </p>
  </div>
</body></html>`,
    text: `Confirm your email address

Hi ${safeName}, thanks for joining mywedcrew.com.

Confirm this address to activate your account:
${verifyUrl}

This link expires in 24 hours. If you did not create an account, ignore this email.`
  };
};

/* ================================================================== */
/* Adapters                                                            */
/* ================================================================== */

const consoleAdapter = {
  name: 'console',
  /**
   * Sends nothing. Prints the link so local development and the E2E suites
   * work with zero configuration — the mail equivalent of PAYMENT_PROVIDER=sandbox.
   */
  async send({ to, subject, verifyUrl }) {
    console.log('\n──────────── EMAIL (console adapter — nothing was sent) ────────────');
    console.log(`  to      : ${to}`);
    console.log(`  subject : ${subject}`);
    if (verifyUrl) console.log(`  link    : ${verifyUrl}`);
    console.log('────────────────────────────────────────────────────────────────────\n');
    return { ok: true, id: null };
  }
};

const brevoAdapter = {
  name: 'brevo',
  /**
   * Brevo transactional email API. Authenticated with the `api-key` header.
   * The key is never logged, and neither is the verification link.
   */
  async send({ to, name, subject, html, text }) {
    // A hanging provider must never stall a registration request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY || '',
          'Content-Type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          sender: { email: fromAddress(), name: fromName() },
          to: [{ email: to, ...(name ? { name } : {}) }],
          subject,
          htmlContent: html,
          textContent: text
        }),
        signal: controller.signal
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Provider messages may echo the request; never include the body's
        // link fields. Only the coarse reason is kept.
        return { ok: false, error: `Brevo responded ${res.status}: ${body?.message || 'send failed'}` };
      }
      return { ok: true, id: body?.messageId || null };
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'timed out after 10s' : error.message;
      return { ok: false, error: `Brevo request failed: ${reason}` };
    } finally {
      clearTimeout(timer);
    }
  }
};

const ADAPTERS = { console: consoleAdapter, brevo: brevoAdapter };

const adapter = () => ADAPTERS[activeProviderName()] || consoleAdapter;

/* ================================================================== */
/* Logging                                                             */
/* ================================================================== */

/**
 * Writes one EmailLog row per attempt.
 *
 * METADATA ONLY — never the token, never the verification URL, never the body.
 * A logging failure must not break sending, so this swallows its own errors.
 */
const recordAttempt = async ({ to, subject, template, provider, status, errorMessage, userId }) => {
  try {
    await EmailLog.create({
      to,
      subject,
      template,
      provider,
      status,
      error_message: errorMessage ? String(errorMessage).slice(0, 300) : null,
      user_id: userId || null
    });
  } catch (error) {
    console.error('EmailLog write failed:', error.message);
  }
};

/* ================================================================== */
/* Public API                                                          */
/* ================================================================== */

/**
 * Sends the account verification email.
 *
 * NEVER THROWS. Returns {ok} so the caller can decide what to tell the user,
 * but a false result must not roll back a registration.
 */
export const sendVerificationEmail = async ({ to, name, verifyUrl, userId }) => {
  const { subject, html, text } = verificationTemplate({ name, verifyUrl });
  const providerName = activeProviderName();

  let result;
  try {
    result = await adapter().send({ to, name, subject, html, text, verifyUrl });
  } catch (error) {
    // Defensive: an adapter should return {ok:false}, not throw.
    result = { ok: false, error: error.message };
  }

  await recordAttempt({
    to,
    subject,
    template: 'verification',
    provider: providerName,
    status: result.ok ? 'SENT' : 'FAILED',
    errorMessage: result.ok ? null : result.error,
    userId
  });

  if (!result.ok) console.error(`[email] verification send failed via ${providerName}: ${result.error}`);
  return result;
};

/**
 * Call once at boot. Prints the active adapter, and shouts if production is
 * about to silently send nothing.
 */
export const logEmailPolicy = (logger = console) => {
  const name = activeProviderName();

  if (process.env.NODE_ENV === 'production' && name === 'console') {
    logger.warn(
      '[email] PRODUCTION IS USING THE CONSOLE ADAPTER — NO EMAIL WILL ACTUALLY BE SENT. ' +
        'New users will never receive a verification link. Set EMAIL_PROVIDER=brevo and BREVO_API_KEY.'
    );
    return;
  }

  logger.log(`[email] provider: ${name} | from: ${fromName()} <${fromAddress()}> | links point at ${appPublicUrl()}`);
};

export default { sendVerificationEmail, logEmailPolicy, activeProviderName, appPublicUrl, PROVIDERS };
