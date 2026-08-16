import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { PlusCircle, Users, Search, ListTodo, Star, Building2, Bell, Settings, LogOut, ChevronRight, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CompanyDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [myRequirements, setMyRequirements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        const res = await api.get('/api/requirements/me');
        setMyRequirements(res.data.data);
      } catch (error) {
        console.error('Failed to fetch requirements', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequirements();
  }, []);

  const handleDeactivate = async (item) => {
    if (window.confirm('Are you sure you want to deactivate this requirement? It will no longer be visible on the platform.')) {
      try {
        const updatedItem = { ...item, status: 'closed' };
        await api.put(`/api/requirements/${item.id}`, updatedItem);
        setMyRequirements(myRequirements.map(req => req.id === item.id ? updatedItem : req));
      } catch (error) {
        console.error('Error deactivating requirement:', error);
        alert('Failed to deactivate requirement');
      }
    }
  };

  const handleReactivate = async (item) => {
    if (window.confirm('Are you sure you want to reactivate this requirement? It will be visible on the platform again.')) {
      try {
        const updatedItem = { ...item, status: 'published' };
        await api.put(`/api/requirements/${item.id}`, updatedItem);
        setMyRequirements(myRequirements.map(req => req.id === item.id ? updatedItem : req));
      } catch (error) {
        console.error('Error reactivating requirement:', error);
        alert('Failed to reactivate requirement');
      }
    }
  };

  const activeCount = myRequirements.filter(r => r.status === 'published').length;

  const stats = [
    { label: 'Active Requirements', value: activeCount.toString(), icon: ListTodo, trend: 'Currently published' },
    { label: 'Total Hires', value: '42', icon: Users, trend: 'Top 10% studio' },
    { label: 'Favorite Crew', value: '18', icon: Star, trend: 'Saved profiles' },
    { label: 'Avg Rating Given', value: '4.9', icon: Star, trend: 'Highly rated' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl bg-brand-card border-2 border-brand-gold flex items-center justify-center text-3xl font-serif text-brand-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Building2 size={40} />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-brand-gold text-brand-bg text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                Studio
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-brand-text mb-1">
                {user?.name || 'Company Studio'}
              </h1>
              <p className="text-brand-gold text-sm tracking-widest uppercase">Verified Production House • Delhi</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-2">
            <Link 
              to="/company/requirements/new" 
              className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 bg-brand-card/50 border border-gray-200 text-brand-textSec hover:bg-brand-card hover:text-brand-text mb-2"
            >
              <div className="flex items-center gap-3 font-medium text-sm">
                <PlusCircle size={18} className="text-brand-textSec" />
                Post Requirement
              </div>
            </Link>
            
            {[
              { id: 'overview', label: 'Studio Overview', icon: Building2 },
              { id: 'requirements', label: 'Manage Requirements', icon: ListTodo },
              { id: 'search', label: 'Find Crew', icon: Search },
              { id: 'favorites', label: 'Saved Professionals', icon: Star },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'settings', label: 'Company Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold shadow-sm' 
                    : 'bg-brand-card/50 border border-gray-200 text-brand-textSec hover:bg-brand-card hover:text-brand-text'
                }`}
              >
                <div className="flex items-center gap-3 font-medium text-sm">
                  <tab.icon size={18} className={activeTab === tab.id ? 'text-brand-gold' : 'text-brand-textSec'} />
                  {tab.label}
                </div>
                {activeTab === tab.id && <ChevronRight size={16} />}
              </button>
            ))}
            
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 p-4 rounded-xl text-brand-danger hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors mt-8 font-medium text-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="glass-card p-5 rounded-2xl relative overflow-hidden group hover:border-brand-gold/30 transition-colors"
                >
                  <div className="absolute top-0 right-0 -mt-2 -mr-2 p-4 bg-brand-gold/5 rounded-bl-full group-hover:bg-brand-gold/10 transition-colors">
                    <stat.icon size={20} className="text-brand-gold opacity-80" />
                  </div>
                  <p className="text-xs text-brand-textSec font-medium uppercase tracking-wider mb-2">{stat.label}</p>
                  <h3 className="text-3xl font-serif text-brand-text">{stat.value}</h3>
                  <p className="text-xs text-brand-textSec mt-2 font-medium">{stat.trend}</p>
                </motion.div>
              ))}
            </div>

            {/* Active Requirements */}
            <div className="glass-card rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-brand-card/30">
                <h3 className="text-lg font-serif font-bold text-brand-text">Active Requirements</h3>
                <button className="text-brand-gold text-sm hover:text-brand-goldLight transition-colors font-medium tracking-wide">View All</button>
              </div>
              
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-6 text-center text-brand-textSec">Loading...</div>
                ) : myRequirements.length === 0 ? (
                  <div className="p-6 text-center text-brand-textSec">No requirements posted yet.</div>
                ) : (
                  myRequirements.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 bg-brand-gold/20 text-brand-gold rounded text-xs font-bold uppercase tracking-wider">{item.category}</span>
                          <span className="px-2 py-1 bg-white/10 text-brand-text rounded text-xs font-medium">{item.city}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {item.status}
                          </span>
                        </div>
                        <h4 className="text-brand-text font-serif text-xl mb-1">
                          {item.event_type ? `${item.event_type} - ` : ''}
                          {item.description ? item.description.substring(0, 50) + (item.description.length > 50 ? '...' : '') : 'Need ' + item.category}
                        </h4>
                        <p className="text-sm text-brand-textSec">
                          {new Date(item.event_date).toLocaleDateString()} • Budget: ₹{item.payment_per_freelancer} / freelancer • Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="text-center px-4">
                          <p className="text-2xl font-bold text-brand-text">{item.applications_count || 0}</p>
                          <p className="text-xs text-brand-textSec uppercase">Proposals</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 flex-1 sm:flex-none">
                          <button className="flex-1 sm:flex-none btn-outline py-2 px-6">
                            Review
                          </button>
                          {item.status !== 'closed' ? (
                            <button 
                              onClick={() => handleDeactivate(item)}
                              className="flex-1 sm:flex-none py-2 px-4 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleReactivate(item)}
                              className="flex-1 sm:flex-none py-2 px-4 border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Premium CTA */}
            <div className="p-8 rounded-2xl bg-brand-card border border-gray-200 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gold-gradient opacity-0 group-hover:opacity-5 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-serif text-brand-text mb-2 flex items-center gap-2">
                    <Crown className="text-brand-gold" size={24} /> WedCrew Studio Enterprise
                  </h3>
                  <p className="text-brand-textSec max-w-md">
                    Need to hire 10+ crew members for a mega production? Get dedicated account management and bulk hiring discounts.
                  </p>
                </div>
                <button className="btn-gold shrink-0 whitespace-nowrap">Contact Enterprise</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
