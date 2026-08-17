import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';

const RequirementCard = ({ req }) => {
  const { hasAccess } = req;
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chatLoading, setChatLoading] = useState(false);

  const handleStartChat = async () => {
    setChatLoading(true);
    try {
      const payload = {
        company_id: req.company_id,
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

  return (
    <div className={`bg-white shadow-md border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-brand-primary/30 transition-all relative overflow-hidden`}>
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

        <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
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
          
          {user && user.role === 'freelancer' && (
            <button 
              onClick={handleStartChat}
              disabled={chatLoading}
              className="w-full py-2 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {chatLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Start Chat
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementCard;
