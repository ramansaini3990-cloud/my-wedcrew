import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useMasterData from '../hooks/useMasterData';
import useProfessionalSearch from '../hooks/useProfessionalSearch';
import ProfessionalCard from '../components/professionals/ProfessionalCard';
import ProfessionalFilters from '../components/professionals/ProfessionalFilters';
import BookingRequestDialog from '../components/professionals/BookingRequestDialog';
import { AlertCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

/**
 * Public professional browse page.
 *
 * The search itself - query building, filters, pagination and URL state - lives
 * in useProfessionalSearch and ProfessionalFilters, shared with the company
 * dashboard's Find Crew tab. This file owns only what is specific to the public
 * page: the marketing header, the card actions and the chat shortcut.
 *
 * Behaviour gained by moving onto the shared hook, all of which the API already
 * supported but this page never exposed:
 *   - pagination (it previously showed the first 10 and no way to see more)
 *   - the include_travel toggle
 *   - filters written back to the URL, so a search is shareable and survives
 *     a refresh or Back
 *   - booking failures that name the actual reason instead of alert('Failed')
 */
const PAGE_SIZE = 12;

const Professionals = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const search = useProfessionalSearch({ limit: PAGE_SIZE });
  const master = useMasterData(search.filters.state_id || null);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [booking, setBooking] = useState(null);

  const { results, pagination, loading, error, filters, hasFilters } = search;

  const handleStartChat = async (pro) => {
    setChatLoading(true);
    setChatError('');
    try {
      const response = await api.post('/api/chat/conversations', {
        company_id: user.id || user._id,
        freelancer_id: pro.id || pro._id
      }, { timeout: 15_000 });

      const payload = response.data.data || response.data;
      const conversationId = payload.id || payload._id;
      navigate('/messages', { state: { activeConversationId: conversationId } });
    } catch (err) {
      setChatError(err.response?.data?.message || 'Could not open a conversation. Try again shortly.');
    } finally {
      setChatLoading(false);
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
        <ProfessionalFilters
          filters={filters}
          master={master}
          onFilterChange={search.setFilter}
          onIncludeTravelChange={search.setIncludeTravel}
          onClear={search.clearFilters}
          hasFilters={hasFilters}
          resultSummary={
            loading
              ? null
              : filters.date
                ? `${pagination.total} professional${pagination.total === 1 ? '' : 's'} available on the selected date, including those travelling to that city.`
                : `${pagination.total} professional${pagination.total === 1 ? '' : 's'} match${pagination.total === 1 ? 'es' : ''} these filters.`
          }
        />
      </div>

      {chatError && (
        <p className="mx-auto mb-5 flex max-w-4xl items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {chatError}
        </p>
      )}

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

      {!loading && error && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
          <AlertCircle size={24} className="mx-auto text-brand-danger mb-3" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-brand-navy">Unable to load professionals.</p>
          <p className="mt-1 text-[13px] text-brand-textSec">{error}</p>
          <button
            onClick={search.retry}
            className="mt-5 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-14 text-center">
          <Users size={26} className="mx-auto text-brand-textSec/40 mb-3" aria-hidden="true" />
          <p className="text-[16px] font-semibold text-brand-navy">No professionals found</p>
          <p className="mt-1.5 text-[13px] text-brand-textSec max-w-sm mx-auto">
            Try changing your profession, location, or date filters.
          </p>
          {hasFilters && (
            <button
              onClick={search.clearFilters}
              className="mt-5 rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((pro) => (
              <ProfessionalCard
                key={pro.id || pro._id}
                professional={pro}
                actions={
                  user?.role === 'company' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBooking(pro)}
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

          {pagination.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => search.setPage(search.page - 1)}
                disabled={search.page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
              >
                <ChevronLeft size={15} aria-hidden="true" /> Previous
              </button>
              <span className="text-[13px] tabular-nums text-brand-textSec">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => search.setPage(search.page + 1)}
                disabled={search.page >= pagination.pages}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
              >
                Next <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}

      {booking && (
        <BookingRequestDialog professional={booking} onClose={() => setBooking(null)} />
      )}
    </div>
  );
};

export default Professionals;
