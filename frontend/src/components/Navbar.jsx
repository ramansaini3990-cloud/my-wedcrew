import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Menu, X, Crown } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from './ui/Avatar';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Professionals', to: '/freelancers' },
  { label: 'Requirements', to: '/requirements' },
  { label: 'Pricing', to: '/#pricing' }
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile menu on navigation and lock scroll while it is open.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'freelancer') return '/freelancer/dashboard';
    if (user.role === 'company') return '/company/dashboard';
    if (user.role === 'admin') return '/admin/dashboard';
    return '/';
  };

  // If we're in the admin section, the AdminLayout has its own Topbar, so we shouldn't render this Navbar
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const isHashLink = (to) => to.includes('#');

  const desktopLinkClass = ({ isActive }) =>
    `relative text-[11px] uppercase tracking-[0.16em] font-semibold transition-colors duration-200 py-1 after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:h-[1.5px] after:bg-brand-primary after:transition-all after:duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm ${
      isActive
        ? 'text-brand-primary after:w-full'
        : 'text-brand-navy hover:text-brand-primary after:w-0 hover:after:w-full'
    }`;

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-brand-surface/95 backdrop-blur-xl border-b border-brand-border py-3 shadow-[0_4px_20px_-12px_rgba(11,24,53,0.25)]'
          : 'bg-brand-surface/80 backdrop-blur-md border-b border-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm"
          >
            <Crown
              className="text-brand-primary group-hover:text-brand-primaryDark transition-colors duration-300"
              size={26}
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-brand-navy">
              Wed<span className="text-brand-primary">Crew</span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden lg:flex items-center gap-9">
            {NAV_LINKS.map((item) =>
              isHashLink(item.to) ? (
                <a
                  key={item.label}
                  href={item.to}
                  className="relative text-[11px] uppercase tracking-[0.16em] font-semibold text-brand-navy hover:text-brand-primary transition-colors duration-200 py-1 after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:h-[1.5px] after:w-0 after:bg-brand-primary after:transition-all after:duration-300 hover:after:w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink key={item.label} to={item.to} end={item.to === '/'} className={desktopLinkClass}>
                  {item.label}
                </NavLink>
              )
            )}
          </div>

          {/* Auth controls */}
          <div className="hidden lg:flex items-center gap-5 shrink-0">
            {user ? (
              <div className="flex items-center gap-4 border-l border-brand-border pl-5">
                <Link
                  to={getDashboardLink()}
                  className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-lg px-1 py-0.5"
                >
                  <Avatar
                    user={user}
                    size="sm"
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="text-[13px] font-semibold text-brand-navy group-hover:text-brand-primary transition-colors">
                    Dashboard
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[11px] uppercase tracking-[0.14em] font-bold text-brand-textSec hover:text-brand-danger transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-[11px] uppercase tracking-[0.14em] font-bold text-brand-navy hover:text-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-[11px] uppercase tracking-[0.14em] font-bold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                >
                  Join Network
                </Link>
              </>
            )}
          </div>

          {/* Mobile trigger */}
          <div className="lg:hidden flex items-center gap-3">
            {user && <Avatar user={user} size="sm" />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="p-1.5 rounded-md text-brand-navy hover:text-brand-primary hover:bg-brand-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="lg:hidden absolute top-full left-0 w-full bg-brand-surface border-b border-brand-border shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="px-4 py-4 flex flex-col">
              {NAV_LINKS.map((item) =>
                isHashLink(item.to) ? (
                  <a
                    key={item.label}
                    href={item.to}
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-3 text-[15px] font-medium text-brand-navy hover:text-brand-primary border-b border-brand-border transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `px-3 py-3 text-[15px] font-medium border-b border-brand-border transition-colors ${
                        isActive ? 'text-brand-primary' : 'text-brand-navy hover:text-brand-primary'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                )
              )}

              <div className="pt-4 flex flex-col gap-2.5 px-3">
                {user ? (
                  <>
                    <Link
                      to={getDashboardLink()}
                      onClick={() => setIsOpen(false)}
                      className="w-full text-center px-4 py-2.5 rounded-lg border border-brand-primary text-brand-primary text-sm font-semibold hover:bg-brand-primary/10 transition-colors"
                    >
                      Go to Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 rounded-lg text-brand-danger text-sm font-semibold hover:bg-red-50 transition-colors"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsOpen(false)}
                      className="w-full text-center px-4 py-2.5 rounded-lg border border-brand-primary text-brand-primary text-sm font-semibold hover:bg-brand-primary/10 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsOpen(false)}
                      className="w-full text-center px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primaryDark transition-colors"
                    >
                      Join Network
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
