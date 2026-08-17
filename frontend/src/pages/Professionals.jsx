import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Camera, MapPin, Calendar, Star, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const categories = [
  'Wedding Photographer',
  'Cinematographer',
  'Drone Pilot',
  'Video Editor',
  'Album Designer',
  'Event Assistant'
];

const Professionals = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [filters, setFilters] = useState({
    city: '',
    profession: ''
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPro, setSelectedPro] = useState(null);
  const [message, setMessage] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.city) queryParams.append('city', filters.city);
      if (filters.profession) queryParams.append('profession', filters.profession);

      const response = await api.get(`/api/public/freelancers?${queryParams.toString()}`);
      setProfessionals(response.data.data);
    } catch (error) {
      console.error('Failed to fetch professionals', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleRequestBooking = (pro) => {
    setSelectedPro(pro);
    setMessage('');
    setIsModalOpen(true);
  };

  const handleStartChat = async (pro) => {
    setChatLoading(true);
    try {
      const payload = {
        company_id: user.id || user._id,
        freelancer_id: pro.id || pro._id,
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

  const submitBookingRequest = async () => {
    if (!message.trim()) return alert("Please enter a message");
    
    setRequestLoading(true);
    try {
      await api.post('/api/booking-requests', {
        freelancer_id: selectedPro.id || selectedPro._id,
        message: message
      });
      alert('Booking request sent successfully!');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to send booking request', error);
      alert('Failed to send booking request');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-32">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold text-brand-gold mb-4">Elite Professionals</h1>
        <p className="text-brand-textSec">Discover and hire top-tier freelancers for your wedding production.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-12 max-w-3xl mx-auto">
        <input
          type="text"
          name="city"
          placeholder="Filter by City"
          value={filters.city}
          onChange={handleFilterChange}
          className="flex-1 bg-brand-card/50 border border-gray-200 rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-gold"
        />
        <select
          name="profession"
          value={filters.profession}
          onChange={handleFilterChange}
          className="flex-1 bg-brand-card/50 border border-gray-200 rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-gold"
        >
          <option value="">All Professions</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {professionals.length > 0 ? (
            professionals.map(pro => (
              <div key={pro.id} className="glass-card rounded-2xl p-6 border border-gray-200 hover:border-brand-gold/30 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-gold/20 flex items-center justify-center text-2xl font-serif text-brand-gold group-hover:scale-105 transition-transform">
                    {pro.name ? pro.name.charAt(0) : 'P'}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-brand-text mb-1 group-hover:text-brand-gold transition-colors">{pro.name || 'Professional'}</h3>
                    <p className="text-brand-textSec text-sm flex items-center gap-1">
                      <Camera size={14} className="text-brand-gold opacity-70" />
                      {pro.profession || 'Professional'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-brand-textSec">
                    <MapPin size={16} className="text-brand-gold/70" />
                    {pro.city || 'Location not specified'}, {pro.state || ''}
                  </div>
                  <div className="flex items-start gap-2 text-sm text-brand-textSec">
                    <Calendar size={16} className="text-brand-gold/70 mt-0.5 shrink-0" />
                    <div>
                      <span className="block mb-1">Available Dates:</span>
                      {pro.available_dates ? (
                        <div className="flex flex-wrap gap-1">
                          {pro.available_dates.split(',').slice(0, 3).map((d, i) => (
                            <span key={i} className="text-[10px] bg-brand-gold/10 text-brand-gold border border-brand-gold/20 px-2 py-0.5 rounded-full">
                              {new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                          {pro.available_dates.split(',').length > 3 && (
                            <span className="text-[10px] bg-white/5 text-brand-textSec border border-gray-200 px-2 py-0.5 rounded-full">
                              +{pro.available_dates.split(',').length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic opacity-60">No upcoming dates</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 bg-brand-gold/10 text-brand-gold font-medium rounded-xl hover:bg-brand-gold hover:text-brand-bg transition-colors flex items-center justify-center gap-2">
                      View Profile
                    </button>
                    {user?.role === 'company' && (
                      <button 
                        onClick={() => handleRequestBooking(pro)}
                        className="flex-1 py-2.5 bg-brand-gold text-brand-bg font-bold rounded-xl hover:bg-brand-goldLight transition-colors flex items-center justify-center gap-2"
                      >
                        Request Booking
                      </button>
                    )}
                  </div>
                  {user?.role === 'company' && (
                    <button 
                      onClick={() => handleStartChat(pro)}
                      disabled={chatLoading}
                      className="w-full py-2.5 bg-[#C5A880] text-white font-medium rounded-xl hover:bg-[#C5A880]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-brand-textSec">
              <Star className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No professionals found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    
      {/* Booking Modal */}
      {isModalOpen && selectedPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-bg/90 backdrop-blur-sm p-4">
          <div className="bg-brand-surface border border-gray-200 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-gold">Request {selectedPro.name}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-brand-textSec hover:text-brand-text">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-brand-textSec mb-1">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your event, dates, and requirements..."
                  rows="4"
                  className="w-full bg-brand-bg border border-gray-200 rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-gold custom-scrollbar"
                ></textarea>
              </div>
              
              <button 
                onClick={submitBookingRequest}
                disabled={requestLoading}
                className="w-full py-3 bg-brand-gold text-brand-bg font-bold rounded-xl hover:bg-brand-goldLight transition-colors flex items-center justify-center"
              >
                {requestLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-bg"></div>
                ) : (
                  'Send Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Professionals;
