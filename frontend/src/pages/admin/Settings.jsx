import { useContext } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import ChangePassword from '../../components/settings/ChangePassword';

/**
 * Admin settings.
 *
 * Replaces the ComingSoon placeholder that /admin/settings used to fall
 * through to. It holds only what actually exists: the admin's own account
 * security. Platform configuration that is genuinely not built yet is not
 * advertised here - an empty section headed "coming soon" is the thing the
 * UnderConstruction panel exists to avoid pretending about.
 *
 * The finance settings (platform fee, minimum withdrawal) already live on the
 * Payments page, so they are deliberately not duplicated here.
 */
export default function AdminSettings() {
  const { user } = useContext(AuthContext);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Settings</h1>
        <p className="mt-0.5 text-[13px] text-brand-textSec">
          Your administrator account.
        </p>
      </div>

      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-brand-navy">Signed in as</h3>
            <p className="mt-0.5 truncate text-[13px] text-brand-textSec">
              {user?.name ? `${user.name} · ` : ''}
              {user?.email || '—'}
            </p>
            <p className="mt-1 text-[12px] text-brand-textSec">
              This account has full administrator access. Keep its password unique to this site.
            </p>
          </div>
        </div>
      </section>

      <ChangePassword />
    </div>
  );
}
