import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Crown } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <nav 
      className={`fixed w-full z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/95 backdrop-blur-xl border-b border-brand-gold/10 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]' : 'bg-[#FFFCF8] border-b border-brand-gold/20 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <Crown className="text-brand-primary group-hover:text-brand-gold transition-colors duration-300" size={30} strokeWidth={1.5} />
            <span className="font-serif text-2xl font-bold tracking-widest text-brand-navy">
              Wed<span className="text-brand-primary">Crew</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-10">
            {['Home', 'Professionals', 'Requirements', 'Pricing'].map((item) => {
              let path = `/${item.toLowerCase()}`;
              if (item === 'Home') path = '/';
              if (item === 'Professionals') path = '/freelancers';
              
              return (
                <Link 
                  key={item} 
                  to={path} 
                  className="text-brand-navy hover:text-brand-primary transition-colors text-xs uppercase tracking-[0.2em] font-semibold relative after:content-[''] after:absolute after:-bottom-1.5 after:left-0 after:w-0 after:h-[2px] after:bg-brand-primary after:transition-all after:duration-300 hover:after:w-full"
                >
                  {item}
                </Link>
              );
            })}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <div className="flex items-center gap-5 border-l border-brand-gold/30 pl-6">
                <Link 
                  to={getDashboardLink()} 
                  className="flex items-center gap-3 group"
                >
                  <div className="h-9 w-9 rounded-full bg-brand-primary text-white flex items-center justify-center font-serif text-lg shadow-sm group-hover:scale-105 transition-transform duration-300">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-sans font-semibold text-sm text-brand-navy group-hover:text-brand-primary transition-colors tracking-wide">
                    Dashboard
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-xs uppercase tracking-widest font-bold text-brand-textSec hover:text-brand-danger transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-brand-navy hover:text-brand-primary transition-colors text-xs uppercase tracking-widest font-bold">Sign In</Link>
                <Link to="/register" className="btn-primary text-xs uppercase tracking-widest px-6 py-2.5 shadow-[0_4px_15px_-5px_rgba(169,11,74,0.4)]">Join Network</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-brand-text hover:text-brand-primary focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-full left-0 w-full bg-brand-bg/95 backdrop-blur-xl border-b border-gray-200 py-4 shadow-2xl"
          >
            <div className="px-4 pt-2 pb-3 space-y-2 flex flex-col">
              <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-primary font-medium font-serif text-lg border-b border-gray-200">Home</Link>
              <Link to="/freelancers" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-primary font-medium font-serif text-lg border-b border-gray-200">Professionals</Link>
              <Link to="/requirements" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-primary font-medium font-serif text-lg border-b border-gray-200">Requirements</Link>
              <Link to="/pricing" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-primary font-medium font-serif text-lg border-b border-gray-200">Pricing</Link>
              
              <div className="pt-4 flex flex-col gap-3 px-3">
                {user ? (
                  <>
                    <Link to={getDashboardLink()} onClick={() => setIsOpen(false)} className="btn-primary-outline text-center w-full">Go to Dashboard</Link>
                    <button onClick={handleLogout} className="text-brand-danger font-medium py-2">Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsOpen(false)} className="btn-primary-outline text-center w-full">Sign In</Link>
                    <Link to="/register" onClick={() => setIsOpen(false)} className="btn-primary text-center w-full">Join Network</Link>
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
