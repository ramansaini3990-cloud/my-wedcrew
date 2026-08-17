import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlusCircle, Users, Search, ListTodo, Star, Building2, Bell, Settings, LogOut, ChevronRight, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import NotificationsView from '../components/NotificationsView';

export default function CompanyDashboard() {
  const { user, logout } = useContext(AuthContext);
  const socket = useSocket();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
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
      navigate('/messages', { state: { selectedConversation: res.data } });
    } catch (e) {
      console.error(e);
      alert('Failed to start chat. Make sure you have an active chat subscription.');
    }
  };

  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  const stats = [
    { label: 'Active Requirements', value: activeCount.toString(), icon: ListTodo, trend: 'Currently published' },
    { label: 'Total Hires', value: '42', icon: Users, trend: 'Top 10% studio' },
    { label: 'Favorite Crew', value: '18', icon: Star, trend: 'Saved profiles' },
    { label: 'Avg Rating Given', value: '4.9', icon: Star, trend: 'Highly rated' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col lg:flex-row pt-20">
      {/* Mobile Header Dashboard Summary (visible only on small screens) */}
      <div className="lg:hidden bg-brand-surface border-b border-gray-200 px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-brand-bg border border-brand-gold flex items-center justify-center text-brand-primary">
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-brand-navy">
              {user?.name || 'Company Studio'}
            </h1>
            <p className="text-brand-primary text-xs tracking-widest uppercase">
              Verified Production House
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 lg:fixed lg:h-[calc(100vh-5rem)] bg-brand-surface border-r border-gray-200 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="p-6 hidden lg:block border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-brand-bg border border-brand-gold flex items-center justify-center text-brand-primary shadow-sm relative">
              <Building2 size={28} />
              <div className="absolute -bottom-2 -right-2 bg-brand-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                PRO
              </div>
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-brand-navy line-clamp-1">
                {user?.name || 'Company Studio'}
              </h1>
              <p className="text-brand-primary text-xs tracking-widest uppercase">
                Production House
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-b border-gray-100">
          <Link 
            to="/company/requirements/new" 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-all font-medium text-sm shadow-sm"
          >
            <PlusCircle size={18} />
            Post Requirement
          </Link>
        </div>

        <nav className="p-4 flex-1 space-y-1">
          {[
            { id: 'overview', label: 'Studio Overview', icon: Building2 },
            { id: 'requirements', label: 'Manage Requirements', icon: ListTodo },
            { id: 'messages', label: 'Messages', icon: ListTodo, path: '/messages' },
            { id: 'search', label: 'Find Crew', icon: Search },
            { id: 'favorites', label: 'Saved Professionals', icon: Star },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'settings', label: 'Company Settings', icon: Settings },
          ].map((tab) => (
            tab.path ? (
              <Link
                key={tab.id}
                to={tab.path}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id ? 'bg-brand-primary text-white' : 'text-brand-textSec hover:bg-gray-50 hover:text-brand-navy'
                }`}
              >
                <div className="flex items-center gap-3 text-sm">
                  <tab.icon size={18} className={activeTab === tab.id ? "text-white" : "text-brand-textSec"} />
                  {tab.label}
                </div>
                {tab.id === 'notifications' && unreadNotifications > 0 && (
                  <span className="bg-brand-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            ) : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id ? 'bg-brand-primary text-white' : 'text-brand-textSec hover:bg-gray-50 hover:text-brand-navy'
                }`}
              >
                <div className="flex items-center gap-3 text-sm">
                  <tab.icon size={18} className={activeTab === tab.id ? "text-white" : "text-brand-textSec"} />
                  {tab.label}
                </div>
                {tab.id === 'notifications' && unreadNotifications > 0 && (
                  <span className="bg-brand-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadNotifications}
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
                <h2 className="text-2xl font-serif font-bold text-brand-navy">Studio Overview</h2>
                <p className="text-brand-textSec text-sm mt-1">Manage your active shoots, crews, and postings.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-brand-surface p-6 rounded-xl border border-gray-200 shadow-sm hover:border-brand-primary/30 transition-all group">
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
              <div className="bg-brand-surface rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-brand-bg/50">
                  <h3 className="text-lg font-serif font-bold text-brand-navy">Recent Postings</h3>
                  <button 
                    onClick={() => setActiveTab('requirements')}
                    className="text-brand-primary text-sm hover:text-brand-primaryLight transition-colors font-medium"
                  >
                    View All
                  </button>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {loading ? (
                    <div className="p-8 text-center text-brand-textSec">Loading...</div>
                  ) : myRequirements.length === 0 ? (
                    <div className="p-12 text-center text-brand-textSec">No requirements posted yet.</div>
                  ) : (
                    myRequirements.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors flex justify-between items-center">
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
                      <Crown className="text-brand-primary" size={24} /> WedCrew Studio Enterprise
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

              <div className="bg-brand-surface rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
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
                        <div className="p-6 md:p-8 hover:bg-gray-50/50 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-md text-[10px] font-bold uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="px-2.5 py-1 bg-gray-100 text-brand-textSec rounded-md text-xs font-medium">
                                {item.city}
                              </span>
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'published' ? 'bg-green-100 text-green-700' : 
                                item.status === 'closed' ? 'bg-red-100 text-red-700' : 
                                'bg-gray-100 text-gray-700'
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
                          
                          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto p-4 lg:p-0 bg-gray-50 lg:bg-transparent rounded-lg border border-gray-100 lg:border-none">
                            <div className="text-center">
                              <p className="text-3xl font-serif text-brand-navy mb-1">{item.applications_count || 0}</p>
                              <p className="text-[10px] text-brand-textSec font-bold uppercase tracking-wider">Proposals</p>
                            </div>
                            
                            <div className="w-px h-12 bg-gray-200 hidden sm:block"></div>
                            
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
                                  className="w-full sm:w-auto px-6 py-2 bg-white border border-gray-200 text-brand-danger hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleReactivate(item)}
                                  className="w-full sm:w-auto px-6 py-2 bg-white border border-gray-200 text-green-600 hover:bg-green-50 hover:border-green-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                  Reactivate
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Applications List */}
                      {expandedReq === item.id && (
                        <div className="bg-gray-50/80 border-t border-gray-100 p-6 md:p-8">
                          <h5 className="text-lg font-serif font-bold text-brand-navy mb-4">Proposals for {item.category}</h5>
                          {loadingApps ? (
                            <div className="text-brand-textSec">Loading applications...</div>
                          ) : reqApplications.length === 0 ? (
                            <div className="text-brand-textSec bg-white p-6 rounded-xl border border-gray-100 text-center">No applications received yet.</div>
                          ) : (
                            <div className="space-y-4">
                              {reqApplications.map(app => (
                                <div key={app.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
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
                                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-brand-navy border border-gray-100">
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
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <NotificationsView 
                  onNotificationClick={(notif) => {
                    if (notif.subscription_required || notif.type === 'locked_message') {
                      window.location.href = '/pricing';
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
          {['search', 'favorites', 'settings'].includes(activeTab) && (
            <div className="animate-fade-in flex flex-col items-center justify-center p-12 bg-brand-surface rounded-xl border border-gray-200">
              <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Settings className="text-brand-textSec/50" size={32} />
              </div>
              <h2 className="text-xl font-serif font-bold text-brand-navy mb-2 capitalize">{activeTab}</h2>
              <p className="text-brand-textSec text-sm text-center max-w-md">This module is currently being updated to match the new premium experience. Check back soon.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
