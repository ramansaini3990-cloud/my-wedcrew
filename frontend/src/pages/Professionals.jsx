import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import useMasterData from '../hooks/useMasterData';
import ProfessionalCard from '../components/professionals/ProfessionalCard';
import { AlertCircle, Users } from 'lucide-react';
import { X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

// Profession, state and city options now come from Admin-managed master data
// via useMasterData() - no hardcoded lists.

const Professionals = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  // Seeded from the URL so the homepage search panel (and shareable links)
  // land here with filters already applied. Same filter state as before.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    profession: searchParams.get('profession') || '',
    // Master-data + date filters (location-aware search)
    profession_id: searchParams.get('profession_id') || '',
    state_id: searchParams.get('state_id') || '',
    city_id: searchParams.get('city_id') || '',
    date: searchParams.get('date') || ''
  });
  // Master data for the cascading filters (Admin-managed, never hardcoded).
  const master = useMasterData(searchParams.get('state_id') || null);

  const handleStateFilterChange = async (e) => {
    const stateId = e.target.value;
    // Changing the state clears a city that no longer belongs to it.
    setFilters((f) => ({ ...f, state_id: stateId, city_id: '' }));
    await master.loadCities(stateId);
  };


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPro, setSelectedPro] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);

  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      // Master-data IDs take precedence; the legacy string filters still work.
      if (filters.profession_id) queryParams.append('profession_id', filters.profession_id);
      else if (filters.profession) queryParams.append('profession', filters.profession);
      if (filters.state_id) queryParams.append('state_id', filters.state_id);
      if (filters.city_id) queryParams.append('city_id', filters.city_id);
      else if (filters.city) queryParams.append('city', filters.city);
      if (filters.date) queryParams.append('date', filters.date);

      const response = await api.get(`/api/public/freelancers?${queryParams.toString()}`);
      setProfessionals(response.data.data);
    } catch (error) {
      console.error('Failed to fetch professionals', error);
      setLoadError(true);
      setProfessionals([]);
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
    setRequestLoading(true);
    try {
      await api.post('/api/booking-requests', {
        freelancer_id: selectedPro.id || selectedPro._id
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
        <h1 className="text-4xl font-serif font-bold text-brand-primary mb-4">Elite Professionals</h1>
        <p className="text-brand-textSec">Discover and hire top-tier freelancers for your wedding production.</p>
      </div>

      {/* Filters - options come from Admin-managed master data */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            name="profession_id"
            value={filters.profession_id}
            onChange={handleFilterChange}
            aria-label="Profession"
            className="bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
            disabled={master.loadingLists}
          >
            <option value="">{master.loadingLists ? 'Loading...' : 'All professions'}</option>
            {master.professions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            name="state_id"
            value={filters.state_id}
            onChange={handleStateFilterChange}
            aria-label="State"
            className="bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
            disabled={master.loadingLists}
          >
            <option value="">All states</option>
            {master.states.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            name="city_id"
            value={filters.city_id}
            onChange={handleFilterChange}
            aria-label="City"
            className="bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 disabled:bg-brand-bg disabled:text-brand-muted"
            disabled={!filters.state_id || master.loadingCities}
          >
            <option value="">
              {!filters.state_id ? 'Select a state first' : master.loadingCities ? 'Loading cities...' : 'All cities'}
            </option>
            {master.cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            type="date"
            name="date"
            value={filters.date}
            onChange={handleFilterChange}
            aria-label="Available on date"
            className="bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
          />
        </div>

        {(filters.profession_id || filters.state_id || filters.city_id || filters.date) && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] text-brand-textSec">
              {filters.date
                ? 'Showing professionals available on the selected date, including those travelling to that city.'
                : 'Showing professionals matching these filters.'}
            </p>
            <button
              type="button"
              onClick={() => setFilters({ city: '', profession: '', profession_id: '', state_id: '', city_id: '', date: '' })}
              className="shrink-0 text-[12px] font-semibold text-brand-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-brand-border bg-white p-5 animate-pulse">
              <div className="flex gap-3.5">
                <div className="h-12 w-12 rounded-full bg-brand-bg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-brand-bg" />
                  <div className="h-3 w-1/2 rounded bg-brand-bg" />
                </div>
              </div>
              <div className="mt-5 h-9 w-full rounded bg-brand-bg" />
            </div>
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
          <AlertCircle size={24} className="mx-auto text-brand-danger mb-3" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-brand-navy">Unable to load professionals.</p>
          <p className="mt-1 text-[13px] text-brand-textSec">Please check your connection and try again.</p>
          <button
            onClick={fetchProfessionals}
            className="mt-5 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !loadError && professionals.length === 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-14 text-center">
          <Users size={26} className="mx-auto text-brand-textSec/40 mb-3" aria-hidden="true" />
          <p className="text-[16px] font-semibold text-brand-navy">No professionals found</p>
          <p className="mt-1.5 text-[13px] text-brand-textSec max-w-sm mx-auto">
            Try changing your profession, location, or date filters.
          </p>
        </div>
      )}

      {!loading && !loadError && professionals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {professionals.map((pro) => (
            <ProfessionalCard
              key={pro.id || pro._id}
              professional={pro}
              actions={
                user?.role === 'company' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRequestBooking(pro)}
                      className="flex-1 py-2 rounded-lg border border-brand-primary/40 text-brand-primary text-[13px] font-semibold hover:bg-brand-primary/10 transition-colors"
                    >
                      Request Booking
                    </button>
                    <button
                      onClick={() => handleStartChat(pro)}
                      disabled={chatLoading}
                      className="flex-1 py-2 rounded-lg border border-brand-border text-brand-navy text-[13px] font-semibold hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50"
                    >
                      {chatLoading ? 'Opening...' : 'Message'}
                    </button>
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      )}
    
      {/* Booking Modal */}
      {isModalOpen && selectedPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 backdrop-blur-sm p-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-primary">Request {selectedPro.name}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-brand-textSec hover:text-brand-primary transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="w-full bg-brand-primary/5 border border-brand-primary/20 rounded-xl px-4 py-4 text-brand-navy font-medium italic text-sm">
                  "Hi, we’re interested in connecting with you for a booking. Please review our request and respond if you’re available."
                </p>
              </div>
              
              <button 
                onClick={submitBookingRequest}
                disabled={requestLoading}
                className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-brand-primaryDark transition-colors flex items-center justify-center"
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
