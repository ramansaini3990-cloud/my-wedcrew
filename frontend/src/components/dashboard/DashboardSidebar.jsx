import { Link } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import Avatar from '../ui/Avatar';

/**
 * Compact sidebar shared by the Freelancer and Company dashboards.
 *
 * It renders whatever tab list the dashboard passes in, so no menu item is
 * invented or removed here. Tabs with a `path` navigate (React Router <Link>);
 * tabs without one switch the dashboard's own `activeTab` state, which keeps
 * the selected page inside the main content area on the right.
 */
export default function DashboardSidebar({
  profile,
  subtitle,
  tabs = [],
  activeTab,
  onTabSelect,
  onLogout,
  topAction,
  mobileOpen = false,
  onCloseMobile = () => {},
  fallbackInitial = 'U'
}) {
  const itemClass = (isActive) =>
    `group w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium leading-5 transition-colors duration-150 ${
      isActive
        ? 'bg-brand-primary/10 text-brand-primary'
        : 'text-brand-navy hover:bg-brand-primary/5 hover:text-brand-primary'
    }`;

  const renderInner = (tab, isActive) => (
    <>
      <span className="flex items-center gap-2.5 min-w-0">
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-brand-primary transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <tab.icon size={16} strokeWidth={1.9} className="shrink-0" />
        <span className="truncate">{tab.label}</span>
      </span>
      {tab.badge > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
          {tab.badge > 99 ? '99+' : tab.badge}
        </span>
      )}
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-brand-navy/40 backdrop-blur-sm lg:hidden transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed z-40 top-0 left-0 h-full w-[13.5rem] bg-brand-surface border-r border-brand-border flex flex-col transition-transform duration-200
          lg:sticky lg:top-20 lg:z-auto lg:h-[calc(100vh-5rem)] lg:translate-x-0 lg:shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Profile header - uses the real user record */}
        <div className="flex items-center gap-2.5 px-3 py-3 border-b border-brand-border shrink-0">
          <Avatar user={profile} size="md" fallback={fallbackInitial} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-brand-navy truncate leading-tight">
              {(profile && (profile.name || profile.company_name)) || 'Account'}
            </p>
            {subtitle && (
              <p className="text-[11px] text-brand-textSec truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-brand-textSec hover:text-brand-primary transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Optional primary action (e.g. Post Requirement) */}
        {topAction && (
          <div className="px-2.5 pt-2.5 shrink-0">{topAction}</div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-2.5 space-y-0.5 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            if (tab.path) {
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  onClick={onCloseMobile}
                  className={`relative ${itemClass(isActive)}`}
                >
                  {renderInner(tab, isActive)}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onTabSelect(tab.id);
                  onCloseMobile();
                }}
                className={`relative text-left ${itemClass(isActive)}`}
              >
                {renderInner(tab, isActive)}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-2.5 py-2.5 border-t border-brand-border shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-brand-textSec hover:bg-red-50 hover:text-brand-danger transition-colors"
          >
            <LogOut size={16} strokeWidth={1.9} /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
