import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Camera, Calendar, Star, IndianRupee, Bell, Briefcase, Settings, LogOut, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FreelancerDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [showModal, setShowModal] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', city: '', profession: '', state: '', availableDates: [] });
  const [newDate, setNewDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, dashboardRes, requestsRes] = await Promise.all([
        api.get('/api/freelancer/profile'),
        api.get('/api/freelancer/dashboard/stats'),
        api.get('/api/booking-requests/freelancer')
      ]);

      setProfileData({
        name: profileRes.data?.name || '',
        email: profileRes.data?.email || '',
        phone: profileRes.data?.phone || '',
        city: profileRes.data?.city || '',
        profession: profileRes.data?.profession || '',
        state: profileRes.data?.state || '',
        availableDates: profileRes.data?.availableDates || []
      });
      setDashboardData(dashboardRes.data);
      setBookingRequests(requestsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (id, status) => {
    try {
      await api.put(`/api/booking-requests/${id}/status`, { status });
      setBookingRequests(bookingRequests.map(req => 
        req.id === id ? { ...req, status } : req
      ));
    } catch (error) {
      console.error('Failed to update request status', error);
      alert('Failed to update request status');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      let newDates = [...profileData.availableDates];
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start <= end) {
          const current = new Date(start);
          while (current <= end) {
            newDates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
            current.setDate(current.getDate() + 1);
          }
        }
      }

      if (newMonth) {
        const [year, month] = newMonth.split('-');
        const numDays = new Date(year, month, 0).getDate();
        const today = new Date();
        today.setHours(0,0,0,0);
        
        for (let i = 1; i <= numDays; i++) {
          const d = new Date(year, month - 1, i);
          if (d >= today) {
            newDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }
        }
      }

      newDates = [...new Set(newDates)].sort();
      const updatedProfile = { ...profileData, availableDates: newDates };

      await api.post('/api/freelancer/profile', updatedProfile);
      
      setProfileData(updatedProfile);
      setStartDate('');
      setEndDate('');
      setNewMonth('');
      // Toast notification placeholder
    } catch (error) {
      console.error('Failed to save profile', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDate = () => {
    if (newDate && !profileData.availableDates.includes(newDate)) {
      setProfileData(prev => ({ ...prev, availableDates: [...prev.availableDates, newDate] }));
      setNewDate('');
    }
  };

  const handleRemoveDate = (dateToRemove) => {
    setProfileData(prev => ({
      ...prev,
      availableDates: prev.availableDates.filter(d => d !== dateToRemove)
    }));
  };

  const handleAddDateRange = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start <= end) {
        const datesToAdd = [];
        const current = new Date(start);
        while (current <= end) {
          datesToAdd.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
          current.setDate(current.getDate() + 1);
        }
        
        setProfileData(prev => {
          const newAvailable = [...new Set([...prev.availableDates, ...datesToAdd])];
          return { ...prev, availableDates: newAvailable.sort() };
        });
        setStartDate('');
        setEndDate('');
      }
    }
  };

  const [newMonth, setNewMonth] = useState('');

  const handleAddMonth = () => {
    if (newMonth) {
      const [year, month] = newMonth.split('-');
      const numDays = new Date(year, month, 0).getDate();
      const datesToAdd = [];
      const today = new Date();
      today.setHours(0,0,0,0);
      
      for (let i = 1; i <= numDays; i++) {
        const d = new Date(year, month - 1, i);
        if (d >= today) {
          datesToAdd.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
      }
      
      setProfileData(prev => {
        const newAvailable = [...new Set([...prev.availableDates, ...datesToAdd])];
        return { ...prev, availableDates: newAvailable.sort() };
      });
      setNewMonth('');
    }
  };

  const stats = [
    { label: 'Profile Views', value: dashboardData?.stats?.profileViews || 0, icon: Star, trend: '' },
    { label: 'Booking Requests', value: dashboardData?.stats?.bookingRequests || 0, icon: Briefcase, trend: '' },
    { label: 'Upcoming Shoots', value: dashboardData?.stats?.upcomingShoots || 0, icon: Camera, trend: '' },
    { label: 'Earnings (Month)', value: dashboardData?.stats?.earnings || '₹0', icon: IndianRupee, trend: '' },
  ];

  const pendingRequestsCount = bookingRequests.filter(req => req.status === 'pending').length;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-brand-card border-2 border-brand-gold flex items-center justify-center text-3xl font-serif text-brand-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                {user?.name?.charAt(0) || 'F'}
              </div>
              <div className="absolute bottom-0 right-0 h-6 w-6 bg-brand-success border-2 border-brand-bg rounded-full"></div>
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-brand-text mb-1">
                Welcome, {profileData.name || user?.name || 'Freelancer'}
              </h1>
              <p className="text-brand-gold text-sm tracking-widest uppercase">
                {profileData.profession ? `Verified ${profileData.profession}` : 'Freelancer'}
                {profileData.state ? ` • ${profileData.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: Camera },
              { id: 'requests', label: 'Booking Requests', icon: Briefcase },
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'earnings', label: 'Earnings & Payments', icon: IndianRupee },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'settings', label: 'Profile Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold' 
                    : 'bg-brand-card/50 border border-gray-200 text-brand-textSec hover:bg-brand-card hover:text-brand-text'
                }`}
              >
                <div className="flex items-center gap-3 font-medium text-sm">
                  <tab.icon size={18} className={activeTab === tab.id ? 'text-brand-gold' : 'text-brand-textSec'} />
                  {tab.label}
                  {tab.id === 'requests' && pendingRequestsCount > 0 && (
                    <span className="ml-2 bg-brand-gold text-brand-bg text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingRequestsCount}
                    </span>
                  )}
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
            
            {activeTab === 'overview' && (
              <>
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
                      <p className="text-xs text-brand-success mt-2 font-medium">{stat.trend}</p>
                    </motion.div>
                  ))}
                </div>



                {/* Profile Status Card */}
                <div className="p-1 rounded-2xl bg-gold-gradient shadow-[0_0_30px_rgba(212,175,55,0.15)] relative overflow-hidden">
                  <div className="bg-brand-card rounded-xl p-8 relative z-10 h-full flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="text-xl font-serif text-brand-gold mb-2">Signature Membership Active</h3>
                      <p className="text-sm text-brand-textSec max-w-md leading-relaxed">
                        You are currently enjoying priority listing and unlimited booking responses. Your plan renews on Dec 1st.
                      </p>
                    </div>
                    <button className="btn-outline shrink-0">Manage Subscription</button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'requests' && (
              <div className="glass-card rounded-2xl border border-gray-200 overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-brand-card/30">
                  <h3 className="text-lg font-serif font-bold text-brand-text">Booking Requests</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {bookingRequests.length > 0 ? bookingRequests.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-full bg-brand-surface border border-gray-200 flex items-center justify-center">
                          <Briefcase className="text-brand-gold" size={20} />
                        </div>
                        <div>
                          <h4 className="text-brand-text font-medium">{item.company_name}</h4>
                          <p className="text-sm text-brand-textSec mt-1">
                            {item.requirement_category ? (item.requirement_category + (item.requirement_city ? ' - ' + item.requirement_city : '')) : item.message}
                          </p>
                          <span className={"text-xs mt-2 inline-block px-2 py-0.5 rounded-full " + (item.status === 'accepted' ? 'bg-brand-success/10 text-brand-success border border-brand-success/20' : item.status === 'declined' ? 'bg-brand-danger/10 text-brand-danger border border-brand-danger/20' : 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20')}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <button 
                            onClick={() => handleRequestAction(item.id, 'accepted')}
                            className="flex-1 sm:flex-none px-4 py-2 bg-brand-success/10 text-brand-success border border-brand-success/20 hover:bg-brand-success/20 rounded-lg text-sm font-medium transition-colors"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleRequestAction(item.id, 'declined')}
                            className="flex-1 sm:flex-none px-4 py-2 bg-brand-danger/10 text-brand-danger border border-brand-danger/20 hover:bg-brand-danger/20 rounded-lg text-sm font-medium transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="p-6 text-center text-brand-textSec italic">No booking requests.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="glass-card p-6 rounded-2xl border border-gray-200 animate-fade-in">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 shrink-0">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-brand-gold tracking-wide">Manage Availability</h2>
                    <p className="text-brand-textSec text-sm mt-1">Set your working days and let clients know when you're free.</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-8">
                  {/* Add Dates Section */}
                  <div className="bg-brand-surface/50 rounded-xl p-6 border border-gray-200 space-y-6">
                    
                    {/* Date Range Option */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider">Add Date Range</label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-xl px-3 focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold/50 transition-all [color-scheme:dark] cursor-text">
                          <Calendar className="text-brand-gold/50 shrink-0" size={16} />
                          <input 
                            type="date" 
                            value={startDate}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-transparent py-2.5 text-sm text-brand-text focus:outline-none cursor-pointer"
                            placeholder="Start Date"
                          />
                        </label>
                        <span className="text-brand-textSec text-sm font-medium px-1 text-center">to</span>
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-xl px-3 focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold/50 transition-all [color-scheme:dark] cursor-text">
                          <Calendar className="text-brand-gold/50 shrink-0" size={16} />
                          <input 
                            type="date" 
                            value={endDate}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate || new Date().toISOString().split('T')[0]}
                            className="w-full bg-transparent py-2.5 text-sm text-brand-text focus:outline-none cursor-pointer"
                            placeholder="End Date"
                          />
                        </label>
                        <button 
                          onClick={handleAddDateRange}
                          disabled={!startDate || !endDate}
                          className="px-4 py-2.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 rounded-xl text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Dates
                        </button>
                      </div>
                      <p className="text-xs text-brand-textSec/70 ml-1">Select the same start and end date for a single day.</p>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full"></div>

                    {/* Entire Month Option */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider">Or Add Entire Month</label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-xl px-3 focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold/50 transition-all [color-scheme:dark] cursor-text">
                          <Calendar className="text-brand-gold/50 shrink-0" size={16} />
                          <input 
                            type="month" 
                            value={newMonth}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setNewMonth(e.target.value)}
                            min={new Date().toISOString().slice(0, 7)}
                            className="w-full bg-transparent py-2.5 text-sm text-brand-text focus:outline-none cursor-pointer"
                          />
                        </label>
                        <button 
                          onClick={handleAddMonth}
                          disabled={!newMonth}
                          className="px-4 py-2.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 rounded-xl text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Month
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Selected Dates Display */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h3 className="text-lg font-medium text-brand-text">Upcoming Availability</h3>
                      <div className="flex items-center gap-3">
                        {profileData.availableDates.length > 0 && (
                          <button 
                            onClick={() => setProfileData({ ...profileData, availableDates: [] })}
                            className="text-xs text-brand-danger hover:text-red-400 hover:underline transition-all font-medium"
                          >
                            Clear All
                          </button>
                        )}
                        <span className="text-xs font-medium px-3 py-1 bg-brand-gold/10 text-brand-gold rounded-full border border-brand-gold/20">
                          {profileData.availableDates.length} {profileData.availableDates.length === 1 ? 'Date' : 'Dates'} Selected
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-brand-surface/30 rounded-xl p-4 border border-gray-200 min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar">
                      {profileData.availableDates.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-8">
                          <Calendar size={32} className="mb-3 text-brand-textSec" />
                          <p className="text-sm text-brand-textSec">No dates added yet.</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {profileData.availableDates.map(d => (
                            <div key={d} className="group flex items-center gap-1.5 bg-brand-card border border-brand-gold/30 hover:border-brand-gold pl-3 pr-1 py-1.5 rounded-lg text-xs transition-all shadow-sm">
                              <span className="text-brand-text font-medium">{new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <button 
                                onClick={() => handleRemoveDate(d)} 
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 text-brand-textSec group-hover:bg-brand-danger/10 group-hover:text-brand-danger transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 shrink-0">
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); setNewMonth(''); }}
                      className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-lg text-brand-textSec hover:text-brand-text hover:bg-white/5 transition-all"
                    >
                      Clear Fields
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-brand-gold text-brand-bg text-sm font-bold rounded-lg hover:bg-brand-goldLight transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)] disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3 h-3 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : 'Save Availability'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="glass-card p-6 rounded-2xl border border-gray-200 animate-fade-in">
                <h2 className="text-2xl font-serif font-bold text-brand-gold mb-6">Profile Settings</h2>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">Full Name</label>
                      <input 
                        type="text" 
                        value={profileData.name}
                        onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                        className="w-full bg-brand-surface border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">Email Address</label>
                      <input 
                        type="email" 
                        value={profileData.email}
                        disabled
                        className="w-full bg-brand-surface/50 border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text/50 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">Phone Number</label>
                      <input 
                        type="tel" 
                        value={profileData.phone}
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                        className="w-full bg-brand-surface border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">Profession</label>
                      <input 
                        type="text" 
                        value={profileData.profession}
                        onChange={(e) => setProfileData({...profileData, profession: e.target.value})}
                        className="w-full bg-brand-surface border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-gold"
                        placeholder="e.g. Photographer, Makeup Artist"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">City</label>
                      <input 
                        type="text" 
                        value={profileData.city}
                        onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                        className="w-full bg-brand-surface border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-textSec mb-1">State</label>
                      <select 
                        value={profileData.state}
                        onChange={(e) => setProfileData({...profileData, state: e.target.value})}
                        className="w-full bg-brand-surface border border-gray-200 rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-gold custom-scrollbar"
                      >
                        <option value="">Select State</option>
                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                        <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                        <option value="Assam">Assam</option>
                        <option value="Bihar">Bihar</option>
                        <option value="Chandigarh">Chandigarh</option>
                        <option value="Chhattisgarh">Chhattisgarh</option>
                        <option value="Delhi">Delhi</option>
                        <option value="Goa">Goa</option>
                        <option value="Gujarat">Gujarat</option>
                        <option value="Haryana">Haryana</option>
                        <option value="Himachal Pradesh">Himachal Pradesh</option>
                        <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                        <option value="Jharkhand">Jharkhand</option>
                        <option value="Karnataka">Karnataka</option>
                        <option value="Kerala">Kerala</option>
                        <option value="Ladakh">Ladakh</option>
                        <option value="Lakshadweep">Lakshadweep</option>
                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Manipur">Manipur</option>
                        <option value="Meghalaya">Meghalaya</option>
                        <option value="Mizoram">Mizoram</option>
                        <option value="Nagaland">Nagaland</option>
                        <option value="Odisha">Odisha</option>
                        <option value="Puducherry">Puducherry</option>
                        <option value="Punjab">Punjab</option>
                        <option value="Rajasthan">Rajasthan</option>
                        <option value="Sikkim">Sikkim</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Telangana">Telangana</option>
                        <option value="Tripura">Tripura</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                        <option value="Uttarakhand">Uttarakhand</option>
                        <option value="West Bengal">West Bengal</option>
                        <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                        <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-brand-gold text-brand-bg font-bold rounded-xl hover:bg-brand-goldLight transition-colors shadow-[0_0_15px_rgba(212,175,55,0.4)] disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
