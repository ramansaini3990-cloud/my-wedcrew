import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlusCircle, Search, ListTodo, Star, Building2, Bell, Settings, ChevronRight, Crown, MessageSquare, Menu, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import NotificationsView from '../components/NotificationsView';
import SubscriptionStatusCard from '../components/SubscriptionStatusCard';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import Messages from './Messages';
import Avatar from '../components/ui/Avatar';
import useSubscription from '../hooks/useSubscription';
import useUnreadMessages from '../hooks/useUnreadMessages';
import CompanyPayments from '../components/payments/CompanyPayments';
import UnderConstruction from '../components/ui/UnderConstruction';
import ProfileForm from '../components/profile/ProfileForm';
import ProfileSummaryCard from '../components/dashboard/ProfileSummaryCard';
import useMyProfile from '../hooks/useMyProfile';
import ChangePassword from '../components/settings/ChangePassword';

export default function CompanyDashboard() {
  const { user, logout } = useContext(AuthContext);
  const socket = useSocket();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { profile: myProfile, loading: myProfileLoading } = useMyProfile();
  const [myRequirements, setMyRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedReq, setExpandedReq] = useState(null);
  const [reqApplications, setReqApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const fetchApplications = async (reqId) => {
    setLoadingApps(true);
    try {
      const res = await api.get(`/api/applications/requirement/${reqId}`);
      setReqApplications(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingApps(false);
    }
  };

  const updateAppStatus = async (appId, status) => {
    try {
      await api.patch(`/api/applications/${appId}/status`, { status });
      setReqApplications(reqApplications.map(a => a.id === appId ? { ...a, status } : a));
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  };

  const handleStartChat = async (freelancerId, requirementId) => {
    try {
      const res = await api.post('/api/chat/conversations', {
        company_id: user.id || user._id,
        freelancer_id: freelancerId,
        requirement_id: requirementId
      });
      const conversationId = res.data?.id || res.data?._id;
      navigate('/messages', { state: { activeConversationId: conversationId } });
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to open chat.');
    }
  };

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Chat unread is its own counter - never folded into Notifications.
  const { unreadMessages } = useUnreadMessages();

  useEffect(() => {
    if (socket) {
      socket.on('new_notification', (notification) => {
        setUnreadNotifications(prev => prev + 1);
        // Refresh requirements/applications if appropriate
        fetchMyRequirements();
        if (expandedReq) {
          fetchApplications(expandedReq);
        }
      });
      return () => {
        socket.off('new_notification');
      };
    }
  }, [socket, expandedReq]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    fetchMyRequirements();
    fetchUnreadNotifications();
  }, []);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications/unread-count');
      setUnreadNotifications(res.data.count);
    } catch (e) {
      console.error('Failed to fetch notifications count', e);
    }
  };

  const fetchMyRequirements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/requirements/me');
      setMyRequirements(res.data.data);
    } catch (error) {
      console.error("Failed to fetch requirements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (item) => {
    if (window.confirm('Are you sure you want to deactivate this requirement? It will no longer be visible on the platform.')) {
      try {
        await api.patch(`/api/requirements/${item.id}/status`, { status: 'closed' });
        setMyRequirements(myRequirements.map(req => req.id === item.id ? { ...req, status: 'closed' } : req));
      } catch (error) {
        console.error('Error deactivating requirement:', error);
        alert('Failed to deactivate requirement');
      }
    }
  };

  const handleReactivate = async (item) => {
    if (window.confirm('Are you sure you want to reactivate this requirement? It will be visible on the platform again.')) {
      try {
        await api.patch(`/api/requirements/${item.id}/status`, { status: 'published' });
        setMyRequirements(myRequirements.map(req => req.id === item.id ? { ...req, status: 'published' } : req));
      } catch (error) {
        console.error('Error reactivating requirement:', error);
        alert('Failed to reactivate requirement');
      }
    }
  };

  const activeCount = myRequirements.filter(r => r.status === 'published').length;

  // Only genuinely-derived figures belong here. "Total Hires", "Favorite Crew"
  // and "Avg Rating Given" were hardcoded demo values (42 / 18 / 4.9) shown to
  // real users; they were removed rather than zeroed, because a wrong number is
  // worse than no number. Re-add them once each has a real backing query.
  const stats = [
    { label: 'Active Requirements', value: activeCount.toString(), icon: ListTodo, trend: 'Currently published' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg pt-20 flex">
      <DashboardSidebar
        profile={{ ...user, ...(myProfile || {}) }}
        subtitle={[myProfile?.profession || 'Production House', myProfile?.city]
          .filter(Boolean)
          .join(' · ')}
        fallbackInitial="C"
        topAction={
          <Link
            to="/company/requirements/new"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors font-medium text-[13px] shadow-sm"
          >
            <PlusCircle size={15} />
            Post Requirement
          </Link>
        }
        tabs={[
          { id: 'overview', label: 'Studio Overview', icon: Building2 },
          { id: 'requirements', label: 'Manage Requirements', icon: ListTodo },
          { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
          { id: 'payments', label: 'Payments', icon: Wallet },
          { id: 'search', label: 'Find Crew', icon: Search },
          { id: 'favorites', label: 'Saved Professionals', icon: Star },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
          { id: 'settings', label: 'Company Settings', icon: Settings },
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
          <Avatar user={user} size="sm" fallback="C" />
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-semibold text-brand-navy truncate">
              {user?.name || 'Company Studio'}
            </p>
            <p className="text-[11px] text-brand-textSec truncate">Production House</p>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-5 py-5 space-y-5">
          
          {activeTab === 'payments' && (
          
            <div className="animate-fade-in">
          
              <CompanyPayments />
          
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
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Studio Overview</h2>
                <p className="text-brand-textSec text-sm mt-1">Manage your active shoots, crews, and postings.</p>
              </div>

              {/* Profile summary - real data from GET /api/profile/me */}
              <ProfileSummaryCard
                profile={myProfile}
                loading={myProfileLoading}
                role="company"
                onEdit={() => setActiveTab('settings')}
                quickActions={
                  <>
                    <Link
                      to="/company/requirements/new"
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Post Requirement
                    </Link>
                    <Link
                      to="/freelancers"
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Find Professionals
                    </Link>
                    <button
                      onClick={() => setActiveTab('requirements')}
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-[12px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Manage Requirements
                    </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              {/* Active Requirements List Summary */}
              <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
                <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg/50">
                  <h3 className="text-lg font-serif font-bold text-brand-navy">Recent Postings</h3>
                  <button 
                    onClick={() => setActiveTab('requirements')}
                    className="text-brand-primary text-sm hover:text-brand-primaryLight transition-colors font-medium"
                  >
                    View All
                  </button>
                </div>
                
                <div className="divide-y divide-brand-border">
                  {loading ? (
                    <div className="p-8 text-center text-brand-textSec">Loading...</div>
                  ) : myRequirements.length === 0 ? (
                    <div className="p-12 text-center text-brand-textSec">No requirements posted yet.</div>
                  ) : (
                    myRequirements.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-6 hover:bg-brand-bg/50 transition-colors flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-brand-primary text-[10px] font-bold uppercase tracking-wider bg-brand-primary/10 px-2 py-0.5 rounded">
                              {item.category}
                            </span>
                            <span className="text-brand-textSec text-xs font-medium">{item.city}</span>
                          </div>
                          <h4 className="text-brand-navy font-bold">{item.description ? item.description.substring(0, 50) + '...' : 'Need ' + item.category}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-brand-navy font-bold">{item.applications_count || 0}</p>
                          <p className="text-[10px] text-brand-textSec uppercase tracking-wider">Proposals</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Premium CTA */}
              <div className="p-8 rounded-xl bg-brand-surface border border-brand-primary/20 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary-gradient opacity-5 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-serif text-brand-navy mb-2 flex items-center gap-2">
                      <Crown className="text-brand-primary" size={24} /> mywedcrew.com Studio Enterprise
                    </h3>
                    <p className="text-brand-textSec text-sm max-w-md leading-relaxed">
                      Need to hire 10+ crew members for a mega production? Get dedicated account management and bulk hiring discounts.
                    </p>
                  </div>
                  <button className="px-6 py-3 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primaryLight transition-all shadow-sm shrink-0 whitespace-nowrap">
                    Contact Enterprise
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="animate-fade-in space-y-6">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-brand-navy">Manage Requirements</h2>
                  <p className="text-brand-textSec text-sm mt-1">Review proposals and manage your active job postings.</p>
                </div>
                <Link 
                  to="/company/requirements/new" 
                  className="hidden md:flex px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-all font-medium text-sm items-center gap-2"
                >
                  <PlusCircle size={16} /> New Post
                </Link>
              </div>

              <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
                <div className="divide-y divide-brand-border">
                  {loading ? (
                    <div className="p-12 text-center text-brand-textSec">Loading...</div>
                  ) : myRequirements.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center">
                      <ListTodo className="text-brand-textSec/30 mb-4" size={48} />
                      <p className="text-brand-navy font-bold text-lg mb-1">No requirements posted</p>
                      <p className="text-sm text-brand-textSec mb-6">Create a job post to start receiving proposals from professionals.</p>
                      <Link 
                        to="/company/requirements/new" 
                        className="px-6 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primaryLight transition-all font-medium text-sm"
                      >
                        Post Your First Requirement
                      </Link>
                    </div>
                  ) : (
                    myRequirements.map((item) => (
                      <div key={item.id}>
                        <div className="p-6 md:p-8 hover:bg-brand-bg/50 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-md text-[10px] font-bold uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="px-2.5 py-1 bg-brand-bg border border-brand-border text-brand-textSec rounded-md text-xs font-medium">
                                {item.city}
                              </span>
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'published' ? 'bg-green-100 text-green-700' : 
                                item.status === 'closed' ? 'bg-red-100 text-red-700' : 
                                'bg-brand-bg text-brand-textSec'
                              }`}>
                                {item.status === 'closed' ? 'deactivated' : item.status}
                              </span>
                            </div>
                            <h4 className="text-brand-navy font-serif text-xl font-bold">
                              {item.event_type ? `${item.event_type} - ` : ''}
                              {item.description ? item.description.substring(0, 80) + (item.description.length > 80 ? '...' : '') : 'Need ' + item.category}
                            </h4>
                            <p className="text-sm text-brand-textSec flex items-center gap-4">
                              <span>📅 {new Date(item.event_date).toLocaleDateString()}</span>
                              <span>💰 ₹{item.payment_per_freelancer} / person</span>
                              <span>👥 Need {item.quantity}</span>
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto p-4 lg:p-0 bg-brand-bg lg:bg-transparent rounded-lg border border-brand-border lg:border-none">
                            <div className="text-center">
                              <p className="text-3xl font-serif text-brand-navy mb-1">{item.applications_count || 0}</p>
                              <p className="text-[10px] text-brand-textSec font-bold uppercase tracking-wider">Proposals</p>
                            </div>
                            
                            <div className="w-px h-12 bg-brand-border hidden sm:block"></div>
                            
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                              <button 
                                onClick={() => {
                                  if (expandedReq === item.id) {
                                    setExpandedReq(null);
                                  } else {
                                    setExpandedReq(item.id);
                                    fetchApplications(item.id);
                                  }
                                }}
                                className="w-full sm:w-auto px-6 py-2 bg-brand-navy text-white hover:bg-brand-navy/90 rounded-lg text-sm font-medium transition-colors"
                              >
                                {expandedReq === item.id ? 'Hide' : 'Review'}
                              </button>
                              {item.status !== 'closed' ? (
                                <button 
                                  onClick={() => handleDeactivate(item)}
                                  className="w-full sm:w-auto px-6 py-2 bg-white border border-brand-border text-brand-danger hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleReactivate(item)}
                                  className="w-full sm:w-auto px-6 py-2 bg-white border border-brand-border text-green-600 hover:bg-green-50 hover:border-green-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                  Reactivate
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Applications List */}
                      {expandedReq === item.id && (
                        <div className="bg-brand-bg/80 border-t border-brand-border p-6 md:p-8">
                          <h5 className="text-lg font-serif font-bold text-brand-navy mb-4">Proposals for {item.category}</h5>
                          {loadingApps ? (
                            <div className="text-brand-textSec">Loading applications...</div>
                          ) : reqApplications.length === 0 ? (
                            <div className="text-brand-textSec bg-white p-6 rounded-xl border border-brand-border text-center">No applications received yet.</div>
                          ) : (
                            <div className="space-y-4">
                              {reqApplications.map(app => (
                                <div key={app.id} className="bg-white p-5 rounded-xl border border-brand-border shadow-sm flex flex-col md:flex-row justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                      <h6 className="font-bold text-brand-navy text-lg">{app.freelancer_id?.name || 'Unknown Freelancer'}</h6>
                                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                        app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                        app.status === 'shortlisted' ? 'bg-blue-100 text-blue-700' :
                                        app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {app.status}
                                      </span>
                                    </div>
                                    <p className="text-brand-textSec text-sm mb-3"><strong>Rate:</strong> {app.proposed_rate} &nbsp;|&nbsp; <strong>Availability:</strong> {app.availability}</p>
                                    <div className="bg-brand-bg p-3 rounded-lg text-sm text-brand-navy border border-brand-border">
                                      <p className="whitespace-pre-wrap">{app.message}</p>
                                    </div>
                                    {app.status === 'accepted' && (
                                      <div className="mt-4">
                                        <button 
                                          onClick={() => handleStartChat(app.freelancer_id?._id || app.freelancer_id?.id || app.freelancer_id, item.id)}
                                          className="px-6 py-2 bg-brand-navy text-white hover:bg-brand-navy/90 rounded-lg text-sm font-medium transition-colors"
                                        >
                                          Open Chat
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2 justify-center shrink-0">
                                    {app.status === 'pending' && (
                                      <>
                                        <button onClick={() => updateAppStatus(app.id, 'shortlisted')} className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors border border-blue-200">Shortlist</button>
                                        <button onClick={() => updateAppStatus(app.id, 'accepted')} className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200">Accept</button>
                                        <button onClick={() => updateAppStatus(app.id, 'rejected')} className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200">Reject</button>
                                      </>
                                    )}
                                    {app.status === 'shortlisted' && (
                                      <>
                                        <button onClick={() => updateAppStatus(app.id, 'accepted')} className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200">Accept</button>
                                        <button onClick={() => updateAppStatus(app.id, 'rejected')} className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200">Reject</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    ))
                  )}
                </div>
              </div>
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
                    if (notif.subscription_required || notif.type === 'locked_message') {
                      window.location.href = '/#pricing';
                      return;
                    }
                    if (notif.conversation_id) {
                      window.location.href = '/messages';
                      return;
                    }
                    if (notif.requirement_id) {
                      setActiveTab('requirements');
                      setExpandedReq(notif.requirement_id);
                      fetchApplications(notif.requirement_id);
                      fetchUnreadNotifications();
                    }
                  }} 
                />
              </div>
            </div>
          )}

          {/* Fallback for other tabs not explicitly implemented but handled elegantly */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-brand-navy">Company Settings</h2>
                <p className="text-[13px] text-brand-textSec mt-0.5">
                  Manage your production house profile, category and location.
                </p>
              </div>
              <ProfileForm role="company" />

              <div className="pt-2 border-t border-brand-border">
                <ChangePassword />
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="animate-fade-in">
              <UnderConstruction
                title="Find Crew"
                description="Search professionals by craft, city and date from inside your dashboard, with availability and travel plans factored in."
                backTo={{ to: '/freelancers', label: 'Browse professionals meanwhile' }}
              />
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="animate-fade-in">
              <UnderConstruction
                title="Saved Professionals"
                description="Shortlist professionals you want to work with again and reach them without searching from scratch each time."
                backTo={{ to: '/freelancers', label: 'Browse professionals meanwhile' }}
              />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
