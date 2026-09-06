import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { X, IndianRupee, MapPin, Calendar, Clock } from 'lucide-react';
import { formatDay, formatDayRange, formatRupees } from '../utils/publicFormat';

const RequirementCard = ({ req }) => {
  const { hasAccess } = req;

  /* What a freelancer decides on, worked out once.

     `payment_per_freelancer` arrives as a number for subscribers and as the
     string "Hidden" for everyone else - the API masks it server-side - so the
     per-day and total lines only appear when it is genuinely an amount. */
  const payAmount = Number(req.payment_per_freelancer);
  const payIsAmount = Number.isFinite(payAmount);
  const pay = payIsAmount ? formatRupees(payAmount) : String(req.payment_per_freelancer ?? 'Not stated');
  const days = Number(req.number_of_days) || 1;
  const total = payIsAmount ? formatRupees(payAmount * days) : null;

  const dates = formatDayRange(req.event_date, req.end_date);
  const posted = formatDay(req.created_at);

  // `city` and `state` are free text typed by the company; requirements carry
  // no master-data reference, so this is shown as entered rather than
  // "corrected" into something the company did not write.
  const place = [req.city, req.state].filter(Boolean).join(', ');

  const perks = [
    req.food && 'Food',
    req.travel && 'Travel',
    req.accommodation && 'Stay'
  ].filter(Boolean);
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
          {/* PAY, DATE, PLACE LEAD.
              A freelancer scanning this page decides on how much, when and
              where; the craft is usually already filtered. The job title stays
              directly beneath, still the largest text after the fee. */}
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-brand-navy">
            <IndianRupee size={18} className="self-center shrink-0 text-brand-primary" aria-hidden="true" />
            <span className="font-serif text-2xl font-bold tabular-nums">{pay}</span>
            {payIsAmount && <span className="text-[13px] font-medium text-brand-textSec">per person, per day</span>}
          </p>
          {payIsAmount && days > 1 && (
            <p className="mt-0.5 text-[12px] text-brand-textSec">
              {days} days · <span className="font-semibold text-brand-navy">{total}</span> total per person
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-brand-navy">
            {dates && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} className="shrink-0 text-brand-primary" aria-hidden="true" />
                <span className="font-semibold">{dates}</span>
              </span>
            )}
            {place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-brand-primary" aria-hidden="true" />
                <span className="font-semibold">{place}</span>
              </span>
            )}
          </div>

          <div className="mt-3.5 border-t border-brand-border pt-3.5">
            <h3 className="font-serif text-[17px] font-bold leading-snug text-brand-primary">{req.category}</h3>
            <p className="mt-0.5 text-[13px] text-brand-navy">
              {req.company_name}
              {req.quantity ? (
                <span className="text-brand-textSec">
                  {' · '}{req.quantity} {req.quantity === 1 ? 'person' : 'people'} needed
                </span>
              ) : null}
            </p>
          </div>

          {req.working_hours && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-brand-textSec">
              <Clock size={13} className="shrink-0 text-brand-primary" aria-hidden="true" />
              <span className="font-medium text-brand-navy">Working hours:</span> {req.working_hours}
            </p>
          )}

          {/* Absent when the company wrote no brief - no empty block. */}
          {req.description && (
            <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-brand-textSec">
              {req.description}
            </p>
          )}

          <div className="border-t border-brand-border mt-4 pt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Only what IS provided. Three red "No" chips took the most
                  visual weight on the card to say nothing is included. */}
              {perks.length > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="text-brand-textSec">Provided:</span>
                  {perks.map((perk) => (
                    <span key={perk} className="rounded-md border border-green-200 bg-green-50 px-2 py-1 font-medium text-green-700">
                      {perk}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-brand-textSec">Food, travel and stay not provided</span>
              )}
              {posted && <span className="text-brand-textSec">Posted {posted}</span>}
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
