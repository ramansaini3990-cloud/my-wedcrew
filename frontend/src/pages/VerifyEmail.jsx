import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Link2Off } from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import useResendVerification from '../hooks/useResendVerification';

/**
 * Landing page for the emailed verification link: /verify-email?token=...
 *
 * On success the API returns a token and user, because opening the link proves
 * control of the address - so the visitor is signed straight in and sent to
 * their dashboard rather than being asked to log in again.
 *
 * EVERY outcome must land on a visible state. An earlier version discarded the
 * response whenever the effect re-ran (AuthContext re-creates applySession on
 * every render, and StrictMode remounts effects), which left the spinner up for
 * good on a perfectly clean 400. The rules that prevent a repeat:
 *
 *   1. settle() is the ONLY way out, and the finally block calls it. No path
 *      through this component can leave `status` on 'verifying'.
 *   2. The one-shot guard is a ref, never a cleanup flag - a cleanup flag
 *      cancels the in-flight request that the guard then refuses to re-issue.
 *      That combination was the original hang.
 *   3. A 15s timeout means a hanging network also resolves to a state.
 */
const DASHBOARD_BY_ROLE = {
  freelancer: '/freelancer/dashboard',
  company: '/company/dashboard',
  admin: '/admin/dashboard'
};

const REQUEST_TIMEOUT_MS = 15_000;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { applySession } = useContext(AuthContext);

  // 'verifying' | 'success' | 'used' | 'expired' | 'invalid' | 'missing' | 'error'
  const [status, setStatus] = useState(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState(null);

  // Bumping this re-runs the verification; it drives the "Try again" button on
  // the error state.
  const [attempt, setAttempt] = useState(0);

  // applySession is not memoised upstream, so holding it in a ref keeps it out
  // of the dependency array and stops a parent re-render from restarting - or
  // orphaning - the request.
  const applySessionRef = useRef(applySession);
  applySessionRef.current = applySession;

  useEffect(() => {
    if (!token) return;

    let settled = false;
    const settle = (next) => {
      if (settled) return;
      settled = true;
      setStatus(next);
    };

    (async () => {
      try {
        const res = await api.post(
          '/api/auth/verify-email',
          { token },
          { timeout: REQUEST_TIMEOUT_MS }
        );

        setUserRole(res.data?.user?.role || null);
        if (res.data?.token && res.data?.user) {
          applySessionRef.current?.(res.data.token, res.data.user);
        }
        settle('success');
      } catch (err) {
        const data = err.response?.data || {};
        setEmail(data.email || '');
        setMessage(data.message || '');

        if (data.code === 'TOKEN_EXPIRED') {
          settle('expired');
        } else if (data.code === 'MISSING_TOKEN') {
          settle('missing');
        } else if (data.code === 'INVALID_TOKEN') {
          // The server destroys the token hash on success, so a replayed link
          // and a bogus link are indistinguishable TO IT. If we already hold a
          // session we can ask /auth/me whether this account is in fact
          // verified, and report the far friendlier "already confirmed".
          settle(await resolveInvalid());
        } else if (!err.response) {
          // Timeout, offline, CORS, backend down - all retryable.
          setMessage(
            err.code === 'ECONNABORTED'
              ? 'The request timed out. Your connection may be slow.'
              : 'We could not reach the server.'
          );
          settle('error');
        } else {
          settle('error');
        }
      } finally {
        // Belt and braces: if any branch above somehow fell through, the page
        // still leaves the spinner rather than hanging on it forever.
        settle('error');
      }
    })();
  }, [token, attempt]);

  // Give the success state a beat to register before redirecting.
  useEffect(() => {
    if (status !== 'success') return undefined;
    const to = DASHBOARD_BY_ROLE[userRole] || '/';
    const timer = setTimeout(() => navigate(to, { replace: true }), 1600);
    return () => clearTimeout(timer);
  }, [status, userRole, navigate]);

  const retry = useCallback(() => {
    setMessage('');
    setStatus('verifying');
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-3xl border border-brand-border bg-white p-10 text-center shadow-xl">
        {status === 'verifying' && <Verifying />}
        {status === 'success' && <Success role={userRole} />}
        {status === 'used' && <AlreadyVerified />}
        {status === 'expired' && <Expired email={email} />}
        {status === 'invalid' && <Invalid message={message} email={email} />}
        {status === 'missing' && <MissingToken />}
        {status === 'error' && <Unexpected message={message} onRetry={retry} />}
      </div>
    </div>
  );
}

/**
 * Was this link already used successfully? Only answerable when a session
 * exists - which is exactly the common case, because a successful verification
 * signs the visitor in and a refresh or a second click then replays the link.
 */
async function resolveInvalid() {
  if (!localStorage.getItem('token')) return 'invalid';
  try {
    const me = await api.get('/api/auth/me', { timeout: REQUEST_TIMEOUT_MS });
    return me.data?.email_verified === true ? 'used' : 'invalid';
  } catch {
    // A failed probe must not upgrade the problem - fall back to the honest
    // "not valid" state rather than claiming a verification we cannot see.
    return 'invalid';
  }
}

function Shell({ icon: Icon, tone, title, children }) {
  const toneClass = {
    primary: 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary',
    success: 'border-brand-success/30 bg-brand-success/10 text-brand-success',
    warning: 'border-amber-300 bg-amber-50 text-amber-600',
    danger: 'border-brand-danger/30 bg-brand-danger/10 text-brand-danger'
  }[tone];

  return (
    <>
      <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${toneClass}`}>
        <Icon size={26} aria-hidden="true" />
      </div>
      <h1 className="font-serif text-2xl font-bold text-brand-navy">{title}</h1>
      {children}
    </>
  );
}

const primaryButton =
  'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60';

const Verifying = () => (
  <Shell icon={Loader2} tone="primary" title="Confirming your email">
    <p className="mt-3 text-sm text-brand-textSec">One moment while we verify your link…</p>
    <Loader2 size={18} className="mx-auto mt-5 animate-spin text-brand-primary" aria-hidden="true" />
  </Shell>
);

const Success = ({ role }) => (
  <Shell icon={CheckCircle2} tone="success" title="Email confirmed">
    <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
      Your account is active and you are now signed in. Taking you to your dashboard…
    </p>
    <Link to={DASHBOARD_BY_ROLE[role] || '/'} className={primaryButton}>
      Go to dashboard
    </Link>
  </Shell>
);

/** A replayed link on an account that is genuinely verified: good news, not an error. */
const AlreadyVerified = () => (
  <Shell icon={CheckCircle2} tone="success" title="Already confirmed">
    <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
      This email address has already been verified, so there is nothing left to do. Verification
      links only work once, which is why opening this one again did nothing.
    </p>
    <Link to="/login" className={primaryButton}>
      <MailCheck size={15} aria-hidden="true" /> Go to sign in
    </Link>
  </Shell>
);

function Expired({ email }) {
  const { resend, sending, cooldown, message, error } = useResendVerification(email);

  return (
    <Shell icon={Clock} tone="danger" title="This link has expired">
      <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
        Verification links are valid for 24 hours. Request a new one and we will email it straight away.
      </p>
      {email && <p className="mt-2 break-all text-sm font-semibold text-brand-navy">{email}</p>}

      {message && <p className="mt-4 text-[13px] font-medium text-brand-success">{message}</p>}
      {error && <p className="mt-4 text-[13px] font-medium text-brand-danger">{error}</p>}

      {email ? (
        <button type="button" onClick={resend} disabled={sending || cooldown > 0} className={primaryButton}>
          {sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new link'}
        </button>
      ) : (
        <Link to="/login" className={primaryButton}>
          Go to sign in
        </Link>
      )}
    </Shell>
  );
}

/**
 * Unknown token. The server had no account to name, so it returns no address -
 * which means a resend needs the visitor to sign in and request one there.
 */
function Invalid({ message, email }) {
  const { resend, sending, cooldown, message: sent, error } = useResendVerification(email);

  return (
    <Shell icon={XCircle} tone="danger" title="This link is not valid">
      <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
        {message || 'The link may have been copied incompletely, or it has already been used.'}
      </p>
      <p className="mt-2 text-[13px] text-brand-textSec">
        Sign in to check - if your account still needs confirming, you can send a fresh link from there.
      </p>

      {sent && <p className="mt-4 text-[13px] font-medium text-brand-success">{sent}</p>}
      {error && <p className="mt-4 text-[13px] font-medium text-brand-danger">{error}</p>}

      <Link to="/login" className={primaryButton}>
        <MailCheck size={15} aria-hidden="true" /> Go to sign in
      </Link>

      {email && (
        <button type="button" onClick={resend} disabled={sending || cooldown > 0} className={secondaryButton}>
          {sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new link'}
        </button>
      )}
    </Shell>
  );
}

/** /verify-email with no ?token= at all - usually a truncated paste. */
const MissingToken = () => (
  <Shell icon={Link2Off} tone="warning" title="This link is incomplete">
    <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
      The verification link is missing its code. Email clients sometimes break long links across
      lines - copy the whole link from the email into your browser, or sign in and request a new one.
    </p>
    <Link to="/login" className={primaryButton}>
      <MailCheck size={15} aria-hidden="true" /> Go to sign in
    </Link>
  </Shell>
);

/** Network failure, timeout, or a 5xx - the only genuinely retryable state. */
const Unexpected = ({ message, onRetry }) => (
  <Shell icon={AlertTriangle} tone="warning" title="Something went wrong">
    <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
      {message || 'We could not confirm your email just now.'} Your link is still valid, so trying
      again usually works.
    </p>
    <button type="button" onClick={onRetry} className={primaryButton}>
      Try again
    </button>
    <Link to="/login" className={secondaryButton}>
      Go to sign in
    </Link>
  </Shell>
);
