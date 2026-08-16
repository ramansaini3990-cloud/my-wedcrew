import { Menu, Search, Bell } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-brand-surface border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="text-brand-textSec hover:text-brand-text lg:hidden p-1 rounded-md hover:bg-white/5 transition-colors"
        >
          <Menu size={24} />
        </button>
        
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-full px-4 py-1.5 focus-within:ring-1 focus-within:ring-brand-gold focus-within:border-brand-gold transition-all">
          <Search size={16} className="text-brand-gold" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-transparent border-none focus:outline-none text-sm w-64 text-brand-text placeholder-gray-500"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-brand-textSec hover:text-brand-text hover:bg-white/5 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-gold rounded-full shadow-[0_0_5px_rgba(212,175,55,0.8)]"></span>
        </button>
        
        <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block"></div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-serif font-bold text-brand-text leading-none tracking-wide">{user?.name || 'Admin'}</p>
            <p className="text-xs text-brand-gold mt-1 uppercase tracking-wider">{user?.role || 'Admin'}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand-card flex items-center justify-center text-brand-gold font-serif border border-brand-gold/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs text-brand-danger hover:text-red-400 ml-2 font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
