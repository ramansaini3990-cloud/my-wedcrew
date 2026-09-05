import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import api from '../utils/api';
import { describeApiFailure } from '../utils/apiError';

/**
 * "I forgot my password" - request a reset link.
 *
 * The confirmation is deliberately the SAME whether or not an account exists,
 * matching the endpoint. Saying "no account with that address" here would undo
 * the server's care and turn this form into a way to test whether somebody has
 * an account.
 *
 * Every path out of submit() clears `busy` in a finally, and the request has a
 * timeout - this page can never sit on a spinner, which is the bug that once
 * left VerifyEmail hanging.
 */
const REQUEST_TIMEOUT_MS = 15_000;
const COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timer.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer.current);
  }, [cooldown]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError('');

    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() }, { timeout: REQUEST_TIMEOUT_MS });
      setSent(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      const failure = describeApiFailure(err, 'Could not send the reset link. Try again shortly.');
      setError(failure.message);
      // A rate limit knows exactly when it clears; mirror it in the button.
      if (failure.rateLimited && failure.retryAfter) setCooldown(failure.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-3xl border border-brand-border bg-white p-10 shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-primary/30 bg-brand-primary/5 text-brand-primary">
          {sent ? <MailCheck size={26} aria-hidden="true" /> : <KeyRound size={26} aria-hidden="true" />}
        </div>

        <h1 className="text-center font-serif text-2xl font-bold text-brand-navy">
          {sent ? 'Check your inbox' : 'Reset your password'}
        </h1>

        {sent ? (
          <>
            <p className="mt-3 text-center text-sm leading-relaxed text-brand-textSec">
              If an account exists for that address, a password reset link is on its way. The link
              works once and expires in an hour.
            </p>
            <p className="mt-3 text-center text-[13px] text-brand-textSec">
              Nothing arrived? Check your spam folder, then request another.
            </p>

            {error && (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
                <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy || cooldown > 0}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {busy ? 'Sending…' : cooldown > 0 ? `Send again in ${cooldown}s` : 'Send another link'}
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mt-3 text-center text-sm leading-relaxed text-brand-textSec">
              Enter the email address on your account and we will send you a link to choose a new
              password.
            </p>

            <label htmlFor="fp-email" className="mt-6 mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
              Email address
            </label>
            <input
              id="fp-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
            />

            {error && (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
                <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || cooldown > 0 || !email.trim()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {busy ? 'Sending…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-textSec transition-colors hover:text-brand-primary"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
