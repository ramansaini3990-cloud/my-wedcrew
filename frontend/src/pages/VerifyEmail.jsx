import { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import useResendVerification from '../hooks/useResendVerification';

/**
 * Landing page for the emailed verification link: /verify-email?token=...
 *
 * On success the API returns a token and user, because opening the link proves
 * control of the address — so the visitor is signed straight in and sent to
 * their dashboard rather than being asked to log in again.
 *
 * Expired and invalid are shown as DIFFERENT states: an expired link needs a
 * resend, an unknown one usually means a copy/paste truncation.
 */
const DASHBOARD_BY_ROLE = {
  freelancer: '/freelancer/dashboard',
  company: '/company/dashboard',
  admin: '/admin/dashboard'
};

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { applySession } = useContext(AuthContext);

  // 'verifying' | 'success' | 'expired' | 'invalid' | 'error'
  const [status, setStatus] = useState(token ? 'verifying' : 'invalid');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState(null);

  // React 18/19 StrictMode mounts effects twice in development; the token is
  // single-use, so a second call would report "invalid" over a success.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.post('/api/auth/verify-email', { token });
        if (cancelled) return;

        setStatus('success');
        setUserRole(res.data?.user?.role || null);

        // Establish the session from the token the server just issued.
        if (res.data?.token && res.data?.user) applySession(res.data.token, res.data.user);
      } catch (err) {
        if (cancelled) return;
        const data = err.response?.data || {};
        setEmail(data.email || '');
        setMessage(data.message || '');
        if (data.code === 'TOKEN_EXPIRED') setStatus('expired');
        else if (data.code === 'INVALID_TOKEN' || data.code === 'MISSING_TOKEN') setStatus('invalid');
        else setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [token, applySession]);

  // Give the success state a beat to register before redirecting.
  useEffect(() => {
    if (status !== 'success') return undefined;
    const to = DASHBOARD_BY_ROLE[userRole] || '/';
    const timer = setTimeout(() => navigate(to, { replace: true }), 1600);
    return () => clearTimeout(timer);
  }, [status, userRole, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-3xl border border-brand-border bg-white p-10 text-center shadow-xl">
        {status === 'verifying' && <Verifying />}
        {status === 'success' && <Success role={userRole} />}
        {status === 'expired' && <Expired email={email} />}
        {(status === 'invalid' || status === 'error') && <Invalid message={message} />}
      </div>
    </div>
  );
}

function Shell({ icon: Icon, tone, title, children }) {
  const toneClass = {
    primary: 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary',
    success: 'border-brand-success/30 bg-brand-success/10 text-brand-success',
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
    <Link
      to={DASHBOARD_BY_ROLE[role] || '/'}
      className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark"
    >
      Go to dashboard
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
        <button
          type="button"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new link'}
        </button>
      ) : (
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark"
        >
          Go to sign in
        </Link>
      )}
    </Shell>
  );
}

const Invalid = ({ message }) => (
  <Shell icon={XCircle} tone="danger" title="This link is not valid">
    <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
      {message || 'The link may have been copied incompletely, or it has already been used.'}
    </p>
    <p className="mt-2 text-[13px] text-brand-textSec">
      Try signing in — if your account still needs confirming, you can send a fresh link from there.
    </p>
    <Link
      to="/login"
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark"
    >
      <MailCheck size={15} aria-hidden="true" /> Go to sign in
    </Link>
  </Shell>
);
