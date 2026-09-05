import { useEffect, useRef } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar from './DashboardTopbar';

/**
 * Shell for the freelancer and company dashboards.
 *
 * Structurally the same as components/admin/AdminLayout.jsx: a full-height
 * flex row, a persistent sidebar, and a single scrolling column on the right
 * holding a sticky topbar and the page content. The dashboards used to render
 * inside the public layout instead, which put the public Navbar (and its own
 * logout and "Dashboard" link) above the dashboard sidebar.
 *
 * WHY THIS IS A COMPONENT AND NOT A ROUTE LAYOUT
 * The sidebar needs live values that belong to each dashboard - unread message
 * counts, pending booking requests, the resolved profile. Making this an
 * <Outlet /> layout would mean lifting all of that above the router, a far
 * larger change than this task calls for. Each dashboard renders the shell and
 * passes its own tab list down, so no state moves.
 *
 * `h-screen` + `overflow-hidden` on the outer element is what makes the
 * sidebar and the content scroll independently: neither can push the page
 * itself taller than the viewport.
 */
export default function DashboardShell({
  profile,
  subtitle,
  tabs,
  groups,
  activeTab,
  onTabSelect,
  onLogout,
  topAction,
  sidebarOpen,
  onOpenSidebar,
  onCloseSidebar,
  fallbackInitial = 'U',
  /** Reset the content scroll when this changes (the active tab). */
  scrollResetKey,
  children
}) {
  const mainRef = useRef(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [scrollResetKey]);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg text-brand-text">
      <DashboardSidebar
        profile={profile}
        subtitle={subtitle}
        tabs={tabs}
        groups={groups}
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        topAction={topAction}
        mobileOpen={sidebarOpen}
        onCloseMobile={onCloseSidebar}
        fallbackInitial={fallbackInitial}
      />

      <div
        ref={mainRef}
        className="relative flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      >
        <DashboardTopbar
          user={profile}
          subtitle={subtitle}
          onOpenSidebar={onOpenSidebar}
          onLogout={onLogout}
          fallbackInitial={fallbackInitial}
        />

        <main className="w-full grow px-4 py-4 sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
