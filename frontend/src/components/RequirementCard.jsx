import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { X } from 'lucide-react';

const RequirementCard = ({ req }) => {
  const { hasAccess } = req;
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chatLoading, setChatLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  
  // Apply Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [proposedRate, setProposedRate] = useState('');
  const [availability, setAvailability] = useState('');
  const [message, setMessage] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'freelancer' && hasAccess) {
      const fetchStatus = async () => {
        try {
          const reqId = req.id || req._id;
          const res = await api.get(`/api/applications/my/requirement/${reqId}`);
          if (res.data.data) {
            setApplicationStatus(res.data.data.status);
          }
        } catch (e) {
          // ignore
        }
      };
      fetchStatus();
    }
  }, [user, req, hasAccess]);

  const handleStartChat = async () => {
    setChatLoading(true);
    try {
      const compId = typeof req.company_id === 'object' ? (req.company_id._id || req.company_id.id) : req.company_id;
      const payload = {
        company_id: compId,
        freelancer_id: user.id || user._id,
        requirement_id: req.id || req._id
      };
      
      const response = await api.post('/api/chat/conversations', payload);
      const conversationId = response.data.data ? response.data.data.id || response.data.data._id : response.data.id || response.data._id;
      
      navigate('/messages', { state: { activeConversationId: conversationId } });
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert(error.response?.data?.message || 'Failed to start chat.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleApply = async () => {
    if (!proposedRate || !availability || !message.trim()) {
      return alert('Please fill in all fields');
    }
    setApplyLoading(true);
    try {
      await api.post('/api/applications', {
        requirement_id: req.id || req._id,
        proposed_rate: proposedRate,
        availability: availability,
        message: message
      });
      setApplicationStatus('pending');
      setIsModalOpen(false);
      alert('Application sent successfully!');
    } catch (error) {
      console.error('Apply failed:', error);
      alert(error.response?.data?.message || 'Failed to apply');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <>
      <div className={`bg-white shadow-md border border-brand-border rounded-2xl p-6 hover:shadow-xl hover:border-brand-primary/30 transition-all relative overflow-hidden`}>
        {/* Blurred overlay if no access */}
        {!hasAccess && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
            <svg className="w-12 h-12 text-brand-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <h3 className="text-xl font-bold text-brand-navy mb-2">Subscribe to Unlock</h3>
            <p className="text-brand-textSec text-sm mb-4 text-center px-4">Get an active subscription to view full company details, payment info, and apply directly.</p>
            <Link to="/freelancer/dashboard" className="px-6 py-2 bg-primary-gradient text-white font-semibold rounded-lg hover:shadow-md transition-all">
              View Subscription Plans
            </Link>
          </div>
        )}

        <div className={`relative ${!hasAccess ? 'filter blur-sm select-none' : ''}`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-brand-primary mb-1 font-serif">{req.category}</h3>
              <p className="text-brand-navy font-medium">{req.company_name}</p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-brand-primary/10 text-brand-primary text-sm font-semibold px-3 py-1 rounded-full border border-brand-primary/20">
                Need: {req.quantity}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-brand-textSec">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>{req.city}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>{new Date(req.event_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-semibold text-brand-navy">₹{req.payment_per_freelancer} / day</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{req.working_hours || 'Not specified'}</span>
            </div>
          </div>

          {req.description && (
            <div className="mb-4 text-sm text-brand-textSec">
              <p>{req.description}</p>
            </div>
          )}

          <div className="border-t border-brand-border pt-4 flex flex-col gap-4">
            <div className="flex justify-between items-center text-xs">
              <div className="flex space-x-3">
                {req.food ? <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200">Food: Yes</span> : <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-200">Food: No</span>}
                {req.travel ? <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200">Travel: Yes</span> : <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-200">Travel: No</span>}
                {req.accommodation ? <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200">Stay: Yes</span> : <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-200">Stay: No</span>}
              </div>
              <div className="text-brand-textSec">
                Posted: {new Date(req.created_at).toLocaleDateString()}
              </div>
            </div>
            
            {/* Detail page - the full brief lives there, not on the card */}
            <Link
              to={`/requirements/${req.id || req._id}`}
              className="w-full mb-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              View Requirement
            </Link>

            {user && user.role === 'freelancer' && (
              <>
                {!applicationStatus ? (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-2 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primaryDark transition-colors flex items-center justify-center gap-2"
                  >
                    Apply Now
                  </button>
                ) : applicationStatus === 'pending' ? (
                  <button disabled className="w-full py-2 bg-brand-bg border border-brand-border text-brand-textSec font-medium rounded-lg cursor-not-allowed">
                    Application Sent
                  </button>
                ) : applicationStatus === 'shortlisted' ? (
                  <button disabled className="w-full py-2 bg-blue-50 text-blue-600 font-medium rounded-lg cursor-not-allowed border border-blue-200">
                    Shortlisted
                  </button>
                ) : applicationStatus === 'rejected' ? (
                  <button disabled className="w-full py-2 bg-red-50 text-red-600 font-medium rounded-lg cursor-not-allowed border border-red-200">
                    Application Rejected
                  </button>
                ) : applicationStatus === 'accepted' ? (
                  <button 
                    onClick={handleStartChat}
                    disabled={chatLoading}
                    className="w-full py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {chatLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        Open Chat
                      </>
                    )}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 backdrop-blur-sm p-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-navy font-serif">Apply for {req.category}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-brand-textSec hover:text-brand-primary transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-brand-textSec mb-1 font-medium">Your Rate (per day)</label>
                <input
                  type="text"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder="e.g. ₹30,000"
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-textSec mb-1 font-medium">Availability Date(s)</label>
                <input
                  type="text"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. 18/08/2026 or Available"
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-textSec mb-1 font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Why are you a good fit for this project?"
                  rows="4"
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 custom-scrollbar"
                ></textarea>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-brand-bg border border-brand-border text-brand-navy font-bold rounded-xl hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApply}
                  disabled={applyLoading}
                  className="flex-1 py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-brand-primaryLight transition-colors flex items-center justify-center"
                >
                  {applyLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Send Application'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RequirementCard;
