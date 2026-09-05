import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import Avatar from '../ui/Avatar';

/**
 * Compact sidebar shared by the Freelancer and Company dashboards.
 *
 * It renders whatever tab list the dashboard passes in, so no menu item is
 * invented or removed here. Tabs with a `path` navigate (React Router <Link>);
 * tabs without one switch the dashboard's own active tab, which keeps the
 * selected page inside the main content area on the right.
 *
 * LAYOUT
 * Positioning now matches components/admin/Sidebar.jsx exactly: off-canvas and
 * fixed below `lg`, a static flex child above it. It previously used
 * `lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)]`, where the 5rem was
 * compensating for the public Navbar sitting on top of the dashboard. With the
 * dashboards in their own shell there is nothing above it, so it is simply
 * full height.
 *
 * The header, the optional primary action and the footer are all `shrink-0`;
 * only <nav> scrolls. That is what keeps a long tab list from ever clipping.
 *
 * Logout is NOT here - it lives in DashboardTopbar, matching the admin shell.
 * Having it in both places is what put two logout buttons on screen.
 */
export default function DashboardSidebar({
  profile,
  subtitle,
  tabs = [],
  /** Optional [{ label, items: [tab] }] grouping. Falls back to a flat list. */
  groups,
  activeTab,
  onTabSelect,
  topAction,
  mobileOpen = false,
  onCloseMobile = () => {},
  fallbackInitial = 'U'
}) {
  const itemClass = (isActive) =>
    `group relative w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium leading-5 transition-colors duration-150 ${
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

  const renderTab = (tab) => {
    const isActive = activeTab === tab.id;

    if (tab.path) {
      return (
        <Link key={tab.id} to={tab.path} onClick={onCloseMobile} className={itemClass(isActive)}>
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
        className={`text-left ${itemClass(isActive)}`}
      >
        {renderInner(tab, isActive)}
      </button>
    );
  };

  // A flat list is treated as one unlabelled group, so there is a single
  // rendering path regardless of which shape the dashboard passes in.
  const resolvedGroups = groups?.length ? groups : [{ label: null, items: tabs }];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-brand-navy/40 backdrop-blur-sm lg:hidden transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[13.5rem] shrink-0 bg-brand-surface border-r border-brand-border flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Profile header - pinned, uses the real user record */}
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-brand-border shrink-0">
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

        {/* Optional primary action (e.g. Post Requirement) - pinned */}
        {topAction && <div className="px-2.5 pt-2.5 shrink-0">{topAction}</div>}

        {/* Navigation - the only scrolling region */}
        <nav className="flex-1 min-h-0 px-2.5 py-2.5 overflow-y-auto overscroll-contain custom-scrollbar">
          {resolvedGroups.map((group, groupIndex) => (
            <div key={group.label || `group-${groupIndex}`} className={groupIndex === 0 ? '' : 'mt-4'}>
              {group.label && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">{group.items.map(renderTab)}</div>
            </div>
          ))}
        </nav>

        {/* Footer - pinned, mirrors the admin sidebar */}
        <div className="px-4 py-2.5 border-t border-brand-border text-[10px] text-brand-muted text-center font-medium tracking-wider uppercase shrink-0">
          mywedcrew.com v1.0
        </div>
      </aside>
    </>
  );
}
