import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Loader2, Link2Off, AlertTriangle, KeyRound } from 'lucide-react';
import api from '../utils/api';
import PasswordInput from '../components/ui/PasswordInput';
import { isPasswordStrong } from '../utils/passwordRules';
import { describeApiFailure } from '../utils/apiError';

/**
 * Landing page for the emailed reset link: /reset-password?token=...
 *
 * EVERY outcome must land on a visible state. This is the same discipline
 * VerifyEmail needed after an earlier version left the spinner up for good on
 * a clean 400:
 *
 *   - `settle()` is the only way out of the request, and the finally block
 *     calls it, so no path can leave `status` on 'working'.
 *   - a 15s timeout means a hanging network resolves too.
 *
 * Unlike verification, a successful reset does NOT sign the user in. Opening a
 * verification link IS the whole ceremony; here the user has just chosen a
 * password, and typing it on the sign-in form confirms they know what they set.
 */
const REQUEST_TIMEOUT_MS = 15_000;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  // 'form' | 'working' | 'success' | 'expired' | 'invalid' | 'missing' | 'error'
  const [status, setStatus] = useState(token ? 'form' : 'missing');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = isPasswordStrong(password) && password === confirm && status !== 'working';

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) return setError('The two passwords do not match.');
    if (!isPasswordStrong(password)) return setError('Your password does not meet the requirements below.');

    let settled = false;
    const settle = (next) => {
      if (settled) return;
      settled = true;
      setStatus(next);
    };

    setStatus('working');
    try {
      await api.post('/api/auth/reset-password', { token, password }, { timeout: REQUEST_TIMEOUT_MS });
      settle('success');
      // Give the confirmation a beat before handing them the sign-in form.
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      const data = err.response?.data || {};
      const failure = describeApiFailure(err, 'Could not reset your password.');

      if (data.code === 'TOKEN_EXPIRED') {
        settle('expired');
      } else if (data.code === 'INVALID_TOKEN') {
        settle('invalid');
      } else if (data.code === 'MISSING_TOKEN') {
        settle('missing');
      } else {
        // Policy rejections and rate limits keep the user on the form with the
        // reason shown - there is nothing to navigate away from.
        setError(failure.message);
        settle('form');
      }
    } finally {
      // Belt and braces: if any branch above fell through, the page still
      // leaves the spinner rather than hanging on it.
      settle('form');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-3xl border border-brand-border bg-white p-10 text-center shadow-xl">
        {(status === 'form' || status === 'working') && (
          <>
            <Icon tone="primary"><KeyRound size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">Choose a new password</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              Pick something you do not use anywhere else. This link works once.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3.5 text-left">
              <div>
                <label htmlFor="rp-new" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  New password
                </label>
                <PasswordInput
                  id="rp-new"
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your new password"
                  autoComplete="new-password"
                  showRequirements
                  required
                />
              </div>

              <div>
                <label htmlFor="rp-confirm" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  Confirm new password
                </label>
                <PasswordInput
                  id="rp-confirm"
                  name="confirm-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  required
                />
                {mismatch && (
                  <p className="mt-1 text-[12px] font-medium text-brand-danger">These passwords do not match.</p>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!ready}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'working' && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {status === 'working' ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <>
            <Icon tone="success"><CheckCircle2 size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">Password updated</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              You can now sign in with your new password. Taking you to the sign-in page…
            </p>
            <Link to="/login" className={primaryButton}>Go to sign in</Link>
          </>
        )}

        {status === 'expired' && (
          <>
            <Icon tone="danger"><Clock size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">This link has expired</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              Reset links are valid for one hour. Request a new one and we will email it straight away.
            </p>
            <Link to="/forgot-password" className={primaryButton}>Request a new link</Link>
          </>
        )}

        {status === 'invalid' && (
          <>
            <Icon tone="danger"><XCircle size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">This link is not valid</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              It may already have been used, or it was copied incompletely. Reset links work once.
            </p>
            <Link to="/forgot-password" className={primaryButton}>Request a new link</Link>
            <Link to="/login" className={secondaryButton}>Go to sign in</Link>
          </>
        )}

        {status === 'missing' && (
          <>
            <Icon tone="warning"><Link2Off size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">This link is incomplete</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              The reset link is missing its code. Email clients sometimes break long links across
              lines — copy the whole link from the email, or request a new one.
            </p>
            <Link to="/forgot-password" className={primaryButton}>Request a new link</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <Icon tone="warning"><AlertTriangle size={26} aria-hidden="true" /></Icon>
            <h1 className="font-serif text-2xl font-bold text-brand-navy">Something went wrong</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
              {error || 'We could not reset your password just now.'}
            </p>
            <button type="button" onClick={() => setStatus('form')} className={primaryButton}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}

const primaryButton =
  'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark';
const secondaryButton =
  'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary';

function Icon({ tone, children }) {
  const toneClass = {
    primary: 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary',
    success: 'border-brand-success/30 bg-brand-success/10 text-brand-success',
    warning: 'border-amber-300 bg-amber-50 text-amber-600',
    danger: 'border-brand-danger/30 bg-brand-danger/10 text-brand-danger'
  }[tone];
  return (
    <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${toneClass}`}>
      {children}
    </div>
  );
}
