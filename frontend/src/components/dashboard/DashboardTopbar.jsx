import { Menu, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';

/**
 * Topbar for the freelancer and company dashboards.
 *
 * Deliberately mirrors components/admin/Topbar.jsx: same 56px height, same
 * sticky behaviour, same right-hand identity block. The dashboards previously
 * rendered inside the public layout, so the public Navbar sat above them and
 * put a SECOND logout and a "Dashboard" link on screen. This replaces that
 * chrome with a topbar that belongs to the dashboard.
 *
 * The wordmark links back to the public site, which is the way out that the
 * public Navbar used to provide.
 */
export default function DashboardTopbar({
  user,
  subtitle,
  onOpenSidebar,
  onLogout,
  fallbackInitial = 'U'
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-brand-border bg-brand-surface px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="shrink-0 rounded-md p-1 text-brand-textSec transition-colors hover:bg-brand-primary/5 hover:text-brand-primary lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* The way back to the public site. */}
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-1.5 transition-opacity hover:opacity-80"
          aria-label="Go to the mywedcrew.com home page"
        >
          <span className="whitespace-nowrap font-serif text-base font-bold tracking-wide text-brand-navy">
            mywed<span className="text-brand-primary">crew</span>
            <span className="text-brand-navy/55">.com</span>
          </span>
          <ExternalLink
            size={13}
            className="hidden shrink-0 text-brand-muted transition-colors group-hover:text-brand-primary sm:block"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden h-6 w-px bg-brand-border sm:block" />

        <div className="flex items-center gap-2.5">
          <Avatar user={user} size="sm" fallback={fallbackInitial} />
          <div className="hidden min-w-0 leading-tight sm:block">
            <p className="max-w-[10rem] truncate text-[13px] font-semibold text-brand-navy">
              {user?.name || 'Account'}
            </p>
            {subtitle && (
              <p className="max-w-[10rem] truncate text-[11px] text-brand-textSec">{subtitle}</p>
            )}
          </div>
          {/* The ONLY logout on the page. The sidebar deliberately does not
              repeat it - two logout buttons was the original complaint. */}
          <button
            onClick={onLogout}
            className="ml-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-brand-textSec transition-colors hover:bg-red-50 hover:text-brand-danger"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
