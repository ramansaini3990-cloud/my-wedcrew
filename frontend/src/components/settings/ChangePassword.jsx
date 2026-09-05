import { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import PasswordInput from '../ui/PasswordInput';
import { isPasswordStrong } from '../../utils/passwordRules';

/**
 * "Change your password" panel, shared by the company settings tab, the
 * freelancer settings tab and the admin settings page, so all three roles get
 * identical behaviour and wording.
 *
 * The client-side checks here are convenience only. The server verifies the
 * current password and enforces the policy in
 * backend/src/services/passwordPolicy.js, so bypassing this form cannot set a
 * weak password or change one without knowing the existing value.
 *
 * Neither password is logged, stored, or kept after a successful change - the
 * fields are cleared and the values go out of scope.
 *
 * This is NOT a password reset. Without the current password there is no way
 * through, by design; a forgot-password flow is a separate feature.
 */
export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current.length > 0 && isPasswordStrong(next) && next === confirm && !busy;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');

    if (next !== confirm) return setError('The two new passwords do not match.');
    if (!isPasswordStrong(next)) return setError('Your new password does not meet the requirements below.');
    if (next === current) return setError('Your new password must be different from your current one.');

    setBusy(true);
    try {
      const { data } = await api.patch('/api/profile/password', {
        current_password: current,
        new_password: next
      });
      setDone(data?.message || 'Password updated.');
      // Cleared immediately: nothing keeps either value around after this.
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      // No response at all means the request never completed - say so, rather
      // than implying the password was wrong.
      if (!err.response) {
        setError(
          err.code === 'ECONNABORTED'
            ? 'That took too long. Check your connection and try again.'
            : 'We could not reach the server. Check your connection and try again.'
        );
      } else if (err.response.status === 429) {
        setError('Too many attempts. Wait a few minutes before trying again.');
      } else {
        setError(err.response?.data?.message || 'Could not change your password.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <KeyRound size={17} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-brand-navy">Change your password</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-brand-textSec">
            You will need your current password. Choose something you do not use anywhere else.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 max-w-md space-y-3.5">
        <div>
          <label htmlFor="cp-current" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
            Current password
          </label>
          <PasswordInput
            id="cp-current"
            name="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Your current password"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label htmlFor="cp-new" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
            New password
          </label>
          <PasswordInput
            id="cp-new"
            name="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Your new password"
            autoComplete="new-password"
            showRequirements
            required
          />
        </div>

        <div>
          <label htmlFor="cp-confirm" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
            Confirm new password
          </label>
          <PasswordInput
            id="cp-confirm"
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
          <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
            <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {error}
          </p>
        )}
        {done && (
          <p className="flex items-start gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] font-medium text-green-700">
            <CheckCircle2 size={14} className="mt-px shrink-0" aria-hidden="true" /> {done}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}
