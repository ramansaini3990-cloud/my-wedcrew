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
    <div className="min-h-screen bg-brand-bg flex flex-col lg:flex-row pt-20">
      {/* Mobile Header Dashboard Summary (visible only on small screens) */}
      <div className="lg:hidden bg-brand-surface border-b border-gray-200 px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-brand-bg border border-brand-gold flex items-center justify-center text-2xl font-serif text-brand-primary">
            {user?.name?.charAt(0) || 'F'}
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-brand-navy">
              {profileData.name || user?.name || 'Freelancer'}
            </h1>
            <p className="text-brand-primary text-xs tracking-widest uppercase">
              {profileData.profession ? `Verified ${profileData.profession}` : 'Freelancer'}
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 lg:fixed lg:h-[calc(100vh-5rem)] bg-brand-surface border-r border-gray-200 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="p-6 hidden lg:block border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-brand-bg border border-brand-gold flex items-center justify-center text-2xl font-serif text-brand-primary">
              {user?.name?.charAt(0) || 'F'}
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-brand-navy line-clamp-1">
                {profileData.name || user?.name || 'Freelancer'}
              </h1>
              <p className="text-brand-primary text-xs tracking-widest uppercase">
                {profileData.profession || 'Freelancer'}
              </p>
            </div>
          </div>
        </div>
        
        <nav className="p-4 flex-1 space-y-1">
          {[
            { id: 'overview', label: 'Overview', icon: Camera },
            { id: 'requests', label: 'Booking Requests', icon: Briefcase },
            { id: 'messages', label: 'Messages', icon: Briefcase, path: '/messages' },
            { id: 'calendar', label: 'Availability', icon: Calendar },
            { id: 'earnings', label: 'Earnings', icon: IndianRupee },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            tab.path ? (
              <a
                key={tab.id}
                href={tab.path}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 text-brand-textSec hover:bg-gray-50 hover:text-brand-navy"
              >
                <div className="flex items-center gap-3 text-sm">
                  <tab.icon size={18} className="text-brand-textSec" />
                  {tab.label}
                </div>
              </a>
            ) : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-brand-primary/5 text-brand-primary font-medium' 
                    : 'text-brand-textSec hover:bg-gray-50 hover:text-brand-navy'
                }`}
              >
                <div className="flex items-center gap-3 text-sm">
                  <tab.icon size={18} className={activeTab === tab.id ? 'text-brand-primary' : 'text-brand-textSec'} />
                  {tab.label}
                </div>
                {tab.id === 'requests' && pendingRequestsCount > 0 && (
                  <span className="bg-brand-gold text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-brand-textSec hover:bg-red-50 hover:text-brand-danger transition-colors text-sm font-medium"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-72 min-h-screen bg-brand-bg pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8">
          
          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-8">
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Dashboard Overview</h2>
                <p className="text-brand-textSec text-sm mt-1">Monitor your bookings, availability, and earnings.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-brand-surface p-6 rounded-xl border border-gray-200 shadow-sm hover:border-brand-gold/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-brand-primary/5 rounded-lg group-hover:bg-brand-primary/10 transition-colors">
                        <stat.icon size={20} className="text-brand-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif text-brand-navy mb-1">{stat.value}</h3>
                      <p className="text-xs text-brand-textSec font-medium uppercase tracking-wider">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Profile Status Card */}
              <div className="bg-brand-surface rounded-xl border border-brand-gold/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-gold"></div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-brand-navy mb-1">Signature Membership Active</h3>
                  <p className="text-sm text-brand-textSec max-w-md">
                    You are currently enjoying priority listing and unlimited booking responses. Your plan renews soon.
                  </p>
                </div>
                <button className="px-6 py-2.5 bg-brand-bg border border-brand-gold text-brand-gold text-sm font-medium rounded-lg hover:bg-brand-gold/5 transition-colors whitespace-nowrap">
                  Manage Subscription
                </button>
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="animate-fade-in">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-brand-navy">Booking Requests</h2>
                  <p className="text-brand-textSec text-sm mt-1">Review and manage your incoming proposals.</p>
                </div>
              </div>
              
              <div className="bg-brand-surface rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                  {bookingRequests.length > 0 ? bookingRequests.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div className="flex gap-4 items-start sm:items-center">
                        <div className="w-12 h-12 rounded-lg bg-brand-primary/5 flex items-center justify-center shrink-0">
                          <Briefcase className="text-brand-primary" size={20} />
                        </div>
                        <div>
                          <h4 className="text-brand-navy font-bold">{item.company_name}</h4>
                          <p className="text-sm text-brand-textSec mt-0.5">
                            {item.requirement_category ? (item.requirement_category + (item.requirement_city ? ' • ' + item.requirement_city : '')) : item.message}
                          </p>
                          <span className={`text-[10px] uppercase tracking-wider font-bold mt-3 inline-block px-2.5 py-1 rounded-md ${
                            item.status === 'accepted' ? 'bg-green-100 text-green-700' : 
                            item.status === 'declined' ? 'bg-red-100 text-red-700' : 
                            'bg-brand-gold/10 text-brand-gold'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <button 
                            onClick={() => handleRequestAction(item.id, 'accepted')}
                            className="flex-1 sm:flex-none px-5 py-2 bg-brand-navy text-white hover:bg-brand-navy/90 rounded-lg text-sm font-medium transition-colors"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleRequestAction(item.id, 'declined')}
                            className="flex-1 sm:flex-none px-5 py-2 bg-white border border-gray-200 text-brand-textSec hover:bg-gray-50 hover:text-brand-danger rounded-lg text-sm font-medium transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <Briefcase className="text-brand-textSec/30 mb-4" size={40} />
                      <p className="text-brand-textSec font-medium">No booking requests yet.</p>
                      <p className="text-sm text-brand-textSec/70 mt-1">When clients reach out, you'll see them here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="animate-fade-in space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Manage Availability</h2>
                <p className="text-brand-textSec text-sm mt-1">Set your working days and let clients know when you're free.</p>
              </div>
              
              <div className="bg-brand-surface p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm space-y-8">
                {/* Add Dates Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Date Range Option */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider">Add Date Range</label>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-lg px-3 focus-within:border-brand-primary transition-all">
                          <Calendar className="text-brand-textSec shrink-0" size={16} />
                          <input 
                            type="date" 
                            value={startDate}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-transparent py-2.5 text-sm text-brand-navy focus:outline-none cursor-pointer"
                          />
                        </label>
                        <span className="text-brand-textSec text-sm font-medium flex items-center px-1">to</span>
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-lg px-3 focus-within:border-brand-primary transition-all">
                          <Calendar className="text-brand-textSec shrink-0" size={16} />
                          <input 
                            type="date" 
                            value={endDate}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate || new Date().toISOString().split('T')[0]}
                            className="w-full bg-transparent py-2.5 text-sm text-brand-navy focus:outline-none cursor-pointer"
                          />
                        </label>
                      </div>
                      <button 
                        onClick={handleAddDateRange}
                        disabled={!startDate || !endDate}
                        className="w-full px-4 py-2.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Add Dates
                      </button>
                    </div>
                  </div>

                  {/* Entire Month Option */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider">Or Add Entire Month</label>
                    <div className="space-y-3">
                      <label className="w-full flex items-center gap-2 bg-brand-bg border border-gray-200 rounded-lg px-3 focus-within:border-brand-primary transition-all">
                        <Calendar className="text-brand-textSec shrink-0" size={16} />
                        <input 
                          type="month" 
                          value={newMonth}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => setNewMonth(e.target.value)}
                          min={new Date().toISOString().slice(0, 7)}
                          className="w-full bg-transparent py-2.5 text-sm text-brand-navy focus:outline-none cursor-pointer"
                        />
                      </label>
                      <button 
                        onClick={handleAddMonth}
                        disabled={!newMonth}
                        className="w-full px-4 py-2.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Add Month
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selected Dates Display */}
                <div className="pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Upcoming Availability</h3>
                    <div className="flex items-center gap-3">
                      {profileData.availableDates.length > 0 && (
                        <button 
                          onClick={() => setProfileData({ ...profileData, availableDates: [] })}
                          className="text-xs text-brand-danger hover:underline transition-all font-medium"
                        >
                          Clear All
                        </button>
                      )}
                      <span className="text-xs font-bold px-2.5 py-1 bg-brand-gold/10 text-brand-gold rounded-md">
                        {profileData.availableDates.length} Selected
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-brand-bg rounded-xl p-4 border border-gray-100 min-h-[120px] max-h-[300px] overflow-y-auto custom-scrollbar">
                    {profileData.availableDates.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-6">
                        <Calendar size={28} className="mb-2 text-brand-textSec" />
                        <p className="text-sm">No dates added yet.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profileData.availableDates.map(d => (
                          <div key={d} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-brand-primary/30 pl-3 pr-1 py-1.5 rounded-lg text-xs shadow-sm group transition-all">
                            <span className="text-brand-navy font-medium">{new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <button 
                              onClick={() => handleRemoveDate(d)} 
                              className="w-5 h-5 flex items-center justify-center rounded-md text-brand-textSec hover:bg-red-50 hover:text-brand-danger transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primaryLight transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? 'Saving...' : 'Save Availability'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Profile Settings</h2>
                <p className="text-brand-textSec text-sm mt-1">Update your professional details and location.</p>
              </div>
              
              <div className="bg-brand-surface p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">Full Name</label>
                    <input 
                      type="text" 
                      value={profileData.name}
                      onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                      className="w-full bg-brand-bg border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">Email Address</label>
                    <input 
                      type="email" 
                      value={profileData.email}
                      disabled
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-textSec cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">Phone Number</label>
                    <input 
                      type="tel" 
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      className="w-full bg-brand-bg border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">Profession</label>
                    <input 
                      type="text" 
                      value={profileData.profession}
                      onChange={(e) => setProfileData({...profileData, profession: e.target.value})}
                      className="w-full bg-brand-bg border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary transition-colors"
                      placeholder="e.g. Photographer, Makeup Artist"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">City</label>
                    <input 
                      type="text" 
                      value={profileData.city}
                      onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                      className="w-full bg-brand-bg border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">State</label>
                    <select 
                      value={profileData.state}
                      onChange={(e) => setProfileData({...profileData, state: e.target.value})}
                      className="w-full bg-brand-bg border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary transition-colors custom-scrollbar"
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
                
                <div className="flex justify-end pt-8 mt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primaryLight transition-all shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
