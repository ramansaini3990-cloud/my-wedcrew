import { Menu, Search, Bell } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import useUnreadNotifications from '../../hooks/useUnreadNotifications';

/**
 * Which deployment is this panel pointed at?
 *
 * Local and production admin panels are pixel-identical, and the actions in
 * here delete real accounts and move real money. The badge exists so an
 * operator can never mistake one for the other.
 *
 * Deliberately absent when VITE_ENV_LABEL is unset, so it never shows up in
 * production unless somebody configured it on purpose - a badge that appears
 * by default would be ignored within a week.
 */
const ENV_LABEL = String(import.meta.env.VITE_ENV_LABEL || '').trim();

const ENV_TONES = {
  production: 'border-red-300 bg-red-50 text-red-700',
  prod: 'border-red-300 bg-red-50 text-red-700',
  live: 'border-red-300 bg-red-50 text-red-700',
  staging: 'border-amber-300 bg-amber-50 text-amber-700',
  stage: 'border-amber-300 bg-amber-50 text-amber-700',
  qa: 'border-amber-300 bg-amber-50 text-amber-700',
  local: 'border-brand-border bg-brand-bg text-brand-textSec',
  development: 'border-brand-border bg-brand-bg text-brand-textSec',
  dev: 'border-brand-border bg-brand-bg text-brand-textSec'
};

const EnvironmentBadge = () => {
  if (!ENV_LABEL) return null;

  const tone = ENV_TONES[ENV_LABEL.toLowerCase()] || 'border-brand-border bg-brand-bg text-brand-textSec';

  return (
    <span
      className={`hidden sm:inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] ${tone}`}
      title={`Admin panel is pointed at: ${ENV_LABEL}`}
    >
      {ENV_LABEL}
    </span>
  );
};

const Topbar = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { count: unreadNotifications } = useUnreadNotifications();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-brand-surface border-b border-brand-border h-14 flex items-center justify-between gap-3 px-4 sm:px-5 z-10 sticky top-0 shrink-0">

      {/* Left side */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-brand-textSec hover:text-brand-primary lg:hidden p-1 rounded-md hover:bg-brand-primary/5 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <EnvironmentBadge />

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-brand-bg border border-brand-border rounded-lg px-3 h-9 focus-within:ring-2 focus-within:ring-brand-primary/25 focus-within:border-brand-primary transition-all">
          <Search size={15} className="text-brand-textSec shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none focus:outline-none text-[13px] w-48 lg:w-64 text-brand-text placeholder-brand-muted"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => navigate('/admin/notifications')}
          className="relative p-2 text-brand-textSec hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {/* Was rendered unconditionally, so it always claimed something was
              new. Now shown only when there really is an unread notification
              for this admin. */}
          {unreadNotifications > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-primary rounded-full ring-2 ring-brand-surface"
              aria-hidden="true"
            />
          )}
          <span className="sr-only">
            {unreadNotifications > 0
              ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`
              : 'No unread notifications'}
          </span>
        </button>

        <div className="h-6 w-px bg-brand-border hidden sm:block"></div>

        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary text-[13px] font-semibold border border-brand-primary/25 shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="hidden sm:block leading-tight min-w-0">
            <p className="text-[13px] font-semibold text-brand-navy truncate max-w-[10rem]">
              {user?.name || 'Admin'}
            </p>
            <p className="text-[11px] text-brand-textSec capitalize">{user?.role || 'admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-1 px-2.5 py-1.5 text-[12px] font-medium text-brand-textSec hover:text-brand-danger hover:bg-red-50 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
