import { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { Camera, Calendar, Star, IndianRupee, Bell, Briefcase, Settings, ChevronRight, FileText, MessageSquare, Menu, GalleryVerticalEnd } from 'lucide-react';
import { motion } from 'framer-motion';
import NotificationsView from '../components/NotificationsView';
import SubscriptionStatusCard from '../components/SubscriptionStatusCard';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import Messages from './Messages';
import Avatar from '../components/ui/Avatar';
import useSubscription from '../hooks/useSubscription';
import ProfileForm from '../components/profile/ProfileForm';
import ProfileSummaryCard from '../components/dashboard/ProfileSummaryCard';
import useMyProfile from '../hooks/useMyProfile';
import useUnreadMessages from '../hooks/useUnreadMessages';
import TravelAvailability from '../components/profile/TravelAvailability';
import PortfolioManager from '../components/gallery/PortfolioManager';
import FreelancerEarnings from '../components/payments/FreelancerEarnings';
import ChangePassword from '../components/settings/ChangePassword';

export default function FreelancerDashboard() {
  const { user, logout } = useContext(AuthContext);
  const socket = useSocket();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { profile: myProfile, loading: myProfileLoading, refresh: refreshMyProfile } = useMyProfile();
  
  const [showModal, setShowModal] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', city: '', profession: '', state: '', availableDates: [] });
  const [newDate, setNewDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Chat unread is its own counter - never folded into Notifications.
  const { unreadMessages } = useUnreadMessages();
  const [myApplications, setMyApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    if (socket) {
      socket.on('new_notification', (notification) => {
        setUnreadNotifications(prev => prev + 1);
        fetchMyApplications();
      });
      return () => {
        socket.off('new_notification');
      };
    }
  }, [socket]);

  useEffect(() => {
    fetchData();
    fetchUnreadNotifications();
    fetchMyApplications();
  }, []);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications/unread-count');
      setUnreadNotifications(res.data.count);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMyApplications = async () => {
    setLoadingApps(true);
    try {
      const res = await api.get('/api/applications/my');
      setMyApplications(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleStartChat = async (companyId, requirementId) => {
    try {
      const res = await api.post('/api/chat/conversations', {
        company_id: companyId,
        freelancer_id: user.id || user._id,
        requirement_id: requirementId
      });
      const conversationId = res.data?.id || res.data?._id;
      navigate('/messages', { state: { activeConversationId: conversationId } });
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to open chat.');
    }
  };

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
    <div className="min-h-screen bg-brand-bg pt-20 flex">
      <DashboardSidebar
        profile={{ ...user, ...profileData, ...(myProfile || {}) }}
        subtitle={[myProfile?.profession || profileData.profession, myProfile?.city]
          .filter(Boolean)
          .join(' · ') || 'Freelancer'}
        fallbackInitial="F"
        tabs={[
          { id: 'overview', label: 'Overview', icon: Camera },
          { id: 'portfolio', label: 'Portfolio', icon: GalleryVerticalEnd },
          { id: 'requests', label: 'Booking Requests', icon: Briefcase, badge: pendingRequestsCount },
          { id: 'applications', label: 'My Applications', icon: FileText },
          { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
          { id: 'calendar', label: 'Availability', icon: Calendar },
          { id: 'earnings', label: 'Earnings', icon: IndianRupee },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]}
        activeTab={activeTab}
        onTabSelect={setActiveTab}
        onLogout={logout}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-brand-bg pb-10">
        {/* Mobile bar - opens the sidebar */}
        <div className="lg:hidden sticky top-20 z-20 bg-brand-surface border-b border-brand-border px-3 py-2 flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-brand-textSec hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Avatar user={{ ...user, ...profileData }} size="sm" fallback="F" />
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-semibold text-brand-navy truncate">
              {profileData.name || user?.name || 'Freelancer'}
            </p>
            <p className="text-[11px] text-brand-textSec truncate">
              {profileData.profession || 'Freelancer'}
            </p>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-5 py-5 space-y-5">
          
          {activeTab === 'earnings' && (
            <div className="animate-fade-in">
              <FreelancerEarnings />
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="animate-fade-in -mx-4 sm:-mx-5 -my-5">
              <Messages embedded />
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-8">
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Dashboard Overview</h2>
                <p className="text-brand-textSec text-sm mt-1">Monitor your bookings, availability, and earnings.</p>
              </div>

              {/* Profile summary - real data from GET /api/profile/me */}
              <ProfileSummaryCard
                profile={myProfile}
                loading={myProfileLoading}
                role="freelancer"
                onEdit={() => setActiveTab('settings')}
                quickActions={
                  <>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Manage Availability
                    </button>
                    <button
                      onClick={() => setActiveTab('applications')}
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      View Applications
                    </button>
                    <Link
                      to="/requirements"
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Find Requirements
                    </Link>
                    <button
                      onClick={() => setActiveTab('messages')}
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Messages
                    </button>
                  </>
                }
              />

              {/* Subscription status - values come from GET /api/subscriptions/me */}
              <SubscriptionStatusCard subscription={subscription} loading={subscriptionLoading} />

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-brand-surface p-6 rounded-xl border border-brand-border shadow-sm hover:border-brand-primary/30 transition-all group">
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
              <div className="bg-brand-surface rounded-xl border border-brand-primary/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-brand-navy mb-1">Signature Membership Active</h3>
                  <p className="text-sm text-brand-textSec max-w-md">
                    You are currently enjoying priority listing and unlimited booking responses. Your plan renews soon.
                  </p>
                </div>
                <button className="px-6 py-2.5 bg-brand-bg border border-brand-primary text-brand-primary text-sm font-medium rounded-lg hover:bg-brand-primary/5 transition-colors whitespace-nowrap">
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
              
              <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
                <div className="divide-y divide-brand-border">
                  {bookingRequests.length > 0 ? bookingRequests.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-brand-bg/50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
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
                            'bg-brand-primary/10 text-brand-primary'
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
                            className="flex-1 sm:flex-none px-5 py-2 bg-white border border-brand-border text-brand-textSec hover:bg-brand-bg hover:text-brand-danger rounded-lg text-sm font-medium transition-colors"
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
              
              <div className="bg-brand-surface p-6 sm:p-8 rounded-xl border border-brand-border shadow-sm space-y-8">
                {/* Add Dates Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Date Range Option */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider">Add Date Range</label>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-brand-border rounded-lg px-3 focus-within:border-brand-primary transition-all">
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
                        <label className="flex-1 flex items-center gap-2 bg-brand-bg border border-brand-border rounded-lg px-3 focus-within:border-brand-primary transition-all">
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
                      <label className="w-full flex items-center gap-2 bg-brand-bg border border-brand-border rounded-lg px-3 focus-within:border-brand-primary transition-all">
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
                <div className="pt-8 border-t border-brand-border">
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
                      <span className="text-xs font-bold px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-md">
                        {profileData.availableDates.length} Selected
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-brand-bg rounded-xl p-4 border border-brand-border min-h-[120px] max-h-[300px] overflow-y-auto custom-scrollbar">
                    {profileData.availableDates.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-6">
                        <Calendar size={28} className="mb-2 text-brand-textSec" />
                        <p className="text-sm">No dates added yet.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profileData.availableDates.map(d => (
                          <div key={d} className="flex items-center gap-1.5 bg-white border border-brand-border hover:border-brand-primary/30 pl-3 pr-1 py-1.5 rounded-lg text-xs shadow-sm group transition-all">
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

          {activeTab === 'portfolio' && (
            <div className="animate-fade-in">
              <PortfolioManager profile={myProfile} onProfileChange={refreshMyProfile} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-brand-navy">Profile Settings</h2>
                <p className="text-[13px] text-brand-textSec mt-0.5">
                  Update your professional details, base location and travel schedule.
                </p>
              </div>

              <ProfileForm role="freelancer" />

              <div className="pt-2 border-t border-brand-border">
                <TravelAvailability baseLocation={{ city: myProfile?.city, state: myProfile?.state }} />
              </div>

              <div className="pt-2 border-t border-brand-border">
                <ChangePassword />
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-brand-navy">My Applications</h2>
                  <p className="text-brand-textSec mt-1">Track the status of requirements you've applied to</p>
                </div>
              </div>
              
              {loadingApps ? (
                <div className="text-center py-12 text-brand-textSec">Loading applications...</div>
              ) : myApplications.length === 0 ? (
                <div className="bg-white rounded-xl border border-brand-border p-12 text-center text-brand-textSec">
                  You haven't applied to any requirements yet.
                </div>
              ) : (
                <div className="grid gap-4">
                  {myApplications.map(app => (
                    <div key={app.id} className="bg-white rounded-xl border border-brand-border p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h4 className="font-bold text-brand-navy text-lg">{app.requirement_id?.category || 'Requirement'}</h4>
                        <p className="text-brand-textSec font-medium">{app.company_id?.name || 'Company'}</p>
                        <div className="flex gap-4 mt-2 text-sm text-brand-textSec">
                          <span>💰 {app.proposed_rate}</span>
                          <span>📅 {app.availability}</span>
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start md:self-end ${
                          app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          app.status === 'shortlisted' ? 'bg-blue-100 text-blue-700' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {app.status}
                        </span>
                        {app.status === 'accepted' && (
                          <button 
                            onClick={() => handleStartChat(app.company_id?._id || app.company_id?.id || app.company_id, app.requirement_id?._id || app.requirement_id?.id)}
                            className="px-6 py-2 bg-brand-navy text-white hover:bg-brand-navy/90 rounded-lg text-sm font-medium transition-colors"
                          >
                            Open Chat
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-brand-navy">Notifications</h2>
                  <p className="text-brand-textSec mt-1">Stay updated with your latest applications and messages</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-brand-border overflow-hidden shadow-sm">
                <NotificationsView 
                  onNotificationClick={(notif) => {
                    if (notif.application_id || notif.type.includes('application')) {
                      setActiveTab('applications');
                      fetchMyApplications();
                      fetchUnreadNotifications();
                    }
                  }} 
                />
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
