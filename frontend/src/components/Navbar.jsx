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
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200 py-4 shadow-md' : 'bg-white/90 backdrop-blur-md border-b border-gray-100 py-4 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <Crown className="text-brand-gold group-hover:text-brand-goldLight transition-colors" size={28} />
            <span className="font-serif text-2xl font-bold tracking-wider text-brand-text">
              Wed<span className="text-brand-gold">Crew</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm uppercase tracking-widest font-medium">Home</Link>
            <Link to="/freelancers" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm uppercase tracking-widest font-medium">Professionals</Link>
            <Link to="/requirements" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm uppercase tracking-widest font-medium">Requirements</Link>
            <Link to="/pricing" className="text-brand-textSec hover:text-brand-gold transition-colors text-sm uppercase tracking-widest font-medium">Pricing</Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link 
                  to={getDashboardLink()} 
                  className="text-brand-textSec hover:text-brand-text transition-colors flex items-center gap-2"
                >
                  <div className="h-8 w-8 rounded-full bg-brand-surface border border-brand-gold/30 flex items-center justify-center text-brand-gold font-serif">
                    {user.name.charAt(0)}
                  </div>
                  <span className="font-medium text-sm">Dashboard</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-brand-danger hover:text-red-400 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-brand-text hover:text-brand-gold transition-colors text-sm font-medium">Sign In</Link>
                <Link to="/register" className="btn-gold text-sm">Join Network</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-brand-text hover:text-brand-gold focus:outline-none"
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
              <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-gold font-medium font-serif text-lg border-b border-gray-200">Home</Link>
              <Link to="/freelancers" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-gold font-medium font-serif text-lg border-b border-gray-200">Professionals</Link>
              <Link to="/requirements" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-gold font-medium font-serif text-lg border-b border-gray-200">Requirements</Link>
              <Link to="/pricing" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-brand-text hover:text-brand-gold font-medium font-serif text-lg border-b border-gray-200">Pricing</Link>
              
              <div className="pt-4 flex flex-col gap-3 px-3">
                {user ? (
                  <>
                    <Link to={getDashboardLink()} onClick={() => setIsOpen(false)} className="btn-outline text-center w-full">Go to Dashboard</Link>
                    <button onClick={handleLogout} className="text-brand-danger font-medium py-2">Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsOpen(false)} className="btn-outline text-center w-full">Sign In</Link>
                    <Link to="/register" onClick={() => setIsOpen(false)} className="btn-gold text-center w-full">Join Network</Link>
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
