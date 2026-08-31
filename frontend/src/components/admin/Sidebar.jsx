import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ListTodo,
  Calendar,
  CreditCard,
  Wallet,
  ShieldCheck,
  BarChart3,
  Bell,
  Activity,
  Settings,
  Database,
  X
} from 'lucide-react';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  // Same items and paths as before - grouped only for visual hierarchy.
  const navGroups = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }
      ]
    },
    {
      label: 'Management',
      items: [
        { name: 'Freelancers', path: '/admin/freelancers', icon: Users },
        { name: 'Companies', path: '/admin/companies', icon: Briefcase },
        { name: 'Requirements', path: '/admin/requirements', icon: ListTodo },
        { name: 'Availability', path: '/admin/availability', icon: Calendar },
        { name: 'Master Data', path: '/admin/master-data', icon: Database }
      ]
    },
    {
      label: 'Billing',
      items: [
        { name: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
        { name: 'Payments', path: '/admin/payments', icon: Wallet }
      ]
    },
    {
      label: 'System',
      items: [
        { name: 'Verifications', path: '/admin/verifications', icon: ShieldCheck },
        { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
        { name: 'Notifications', path: '/admin/notifications', icon: Bell },
        { name: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
        { name: 'Settings', path: '/admin/settings', icon: Settings }
      ]
    }
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div
        className={`fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Component */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[13.5rem] shrink-0 bg-brand-surface border-r border-brand-border transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-brand-border shrink-0">
          <span className="font-serif text-base font-bold tracking-wide text-brand-navy whitespace-nowrap">
            mywed<span className="text-brand-primary">crew</span><span className="text-brand-navy/55">.com</span>
          </span>
          <button
            className="lg:hidden text-brand-textSec hover:text-brand-primary transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex === 0 ? '' : 'mt-4'}>
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium leading-5 transition-colors duration-150 ${
                        isActive
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : 'text-brand-navy hover:bg-brand-primary/5 hover:text-brand-primary'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active accent bar - uses the existing primary colour */}
                        <span
                          className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-brand-primary transition-opacity ${
                            isActive ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        <item.icon size={16} strokeWidth={1.9} className="shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-brand-border text-[10px] text-brand-muted text-center font-medium tracking-wider uppercase shrink-0">
          mywedcrew.com v1.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
