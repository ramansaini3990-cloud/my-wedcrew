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
  X
} from 'lucide-react';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Freelancers', path: '/admin/freelancers', icon: Users },
    { name: 'Companies', path: '/admin/companies', icon: Briefcase },
    { name: 'Requirements', path: '/admin/requirements', icon: ListTodo },
    { name: 'Availability', path: '/admin/availability', icon: Calendar },
    { name: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
    { name: 'Payments', path: '/admin/payments', icon: Wallet },
    { name: 'Verifications', path: '/admin/verifications', icon: ShieldCheck },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell },
    { name: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div 
        className={`fixed inset-0 bg-brand-bg bg-opacity-80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Component */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-surface border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <span className="font-serif text-xl font-bold tracking-wider text-brand-text">
            Wed<span className="text-brand-gold">Crew</span>
          </span>
          <button className="lg:hidden text-brand-textSec hover:text-brand-text" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive 
                    ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                    : 'text-brand-textSec border border-transparent hover:bg-brand-card hover:text-brand-text hover:border-gray-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-brand-gold' : ''} />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        
        {/* Footer info */}
        <div className="p-4 border-t border-gray-200 text-xs text-brand-textSec text-center font-medium tracking-wider uppercase">
          WedCrew Studio v1.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
