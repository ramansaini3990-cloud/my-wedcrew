import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Users, AlertCircle, Loader2, Bookmark, BookmarkCheck,
  ChevronLeft, ChevronRight, Send, SlidersHorizontal
} from 'lucide-react';
import useMasterData from '../../hooks/useMasterData';
import useProfessionalSearch from '../../hooks/useProfessionalSearch';
import ProfessionalCard from '../professionals/ProfessionalCard';
import ProfessionalFilters from '../professionals/ProfessionalFilters';
import SubscriptionLockNotice from '../professionals/SubscriptionLockNotice';
import BookingRequestDialog from '../professionals/BookingRequestDialog';

/**
 * Find Crew - professional discovery inside the company dashboard.
 *
 * Reuses the public browse page's building blocks rather than restating them:
 * the same useProfessionalSearch hook, the same ProfessionalFilters bar and the
 * same ProfessionalCard. What is different here is the surrounding chrome and
 * the actions on a card (save, book), not the search itself.
 *
 * There is no new endpoint. GET /api/public/freelancers already supports every
 * filter this needs - profession, state, city, date, include_travel, page and
 * limit - and already applies the subscription lock server-side.
 */
const PAGE_SIZE = 12;

export default function FindCrew({ saved }) {
  const search = useProfessionalSearch({ limit: PAGE_SIZE });
  const master = useMasterData(search.filters.state_id || null);
  const [booking, setBooking] = useState(null);

  const { results, pagination, loading, error, filters, hasFilters } = search;
  const lockedCount = results.filter((p) => p.locked).length;
  const anyLocked = lockedCount > 0;

  /* ---------------- save toggle ---------------- */
  const SaveButton = ({ pro }) => {
    const id = String(pro.id || pro._id);
    const isSaved = saved.isSaved(id);
    const busy = saved.isPending(id);

    return (
      <button
        type="button"
        onClick={() => saved.toggle(pro)}
        disabled={busy}
        aria-pressed={isSaved}
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
          isSaved
            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
            : 'border-brand-border text-brand-navy hover:border-brand-primary hover:text-brand-primary'
        }`}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : isSaved ? (
          <BookmarkCheck size={14} aria-hidden="true" />
        ) : (
          <Bookmark size={14} aria-hidden="true" />
        )}
        {isSaved ? 'Saved' : 'Save'}
      </button>
    );
  };

  /* ---------------- states ---------------- */
  const Results = () => {
    if (loading) {
      return (
        <p className="flex items-center gap-2 py-10 text-[13px] text-brand-textSec">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Searching…
        </p>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="flex items-start gap-2 text-[13px] font-medium text-brand-danger">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
          <button
            type="button"
            onClick={search.retry}
            className="mt-3 rounded-lg bg-brand-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            Try again
          </button>
        </div>
      );
    }

    if (results.length === 0) {
      // Says what to change, not just "nothing here".
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <Users size={20} aria-hidden="true" />
          </span>
          <p className="text-[14px] font-semibold text-brand-navy">No professionals match this search</p>
          {hasFilters ? (
            <>
              <ul className="mt-2 max-w-md space-y-1 text-left text-[12.5px] leading-relaxed text-brand-textSec">
                {filters.date && <li>· Try a different date, or clear the date to see everyone.</li>}
                {filters.city_id && (
                  <li>
                    · Widen the location — clear the city to search the whole state
                    {!filters.include_travel && ', or switch travel back on'}.
                  </li>
                )}
                {filters.profession_id && <li>· Try a related profession, or clear it.</li>}
                {!filters.date && !filters.city_id && !filters.profession_id && (
                  <li>· Loosen or clear the filters you have set.</li>
                )}
              </ul>
              <button
                type="button"
                onClick={search.clearFilters}
                className="mt-4 rounded-lg border border-brand-border px-4 py-2 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                Clear all filters
              </button>
            </>
          ) : (
            <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-brand-textSec">
              No professionals have joined yet. They will appear here as soon as they register.
            </p>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((pro) => (
            <ProfessionalCard
              key={pro.id || pro._id}
              professional={pro}
              lockedActions={<SaveButton pro={pro} />}
              actions={
                <div className="flex gap-2">
                  <div className="flex-1"><SaveButton pro={pro} /></div>
                  <button
                    type="button"
                    onClick={() => setBooking(pro)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
                  >
                    <Send size={13} aria-hidden="true" /> Book
                  </button>
                </div>
              }
            />
          ))}
        </div>

        {pagination.pages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => search.setPage(search.page - 1)}
              disabled={search.page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <span className="text-[12px] tabular-nums text-brand-textSec">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              onClick={() => search.setPage(search.page + 1)}
              disabled={search.page >= pagination.pages}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
            >
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Find Crew</h2>
        <p className="mt-0.5 text-[13px] text-brand-textSec">
          Search professionals by craft, location and date — including those travelling to your city.
        </p>
      </div>

      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">
          <SlidersHorizontal size={12} aria-hidden="true" /> Filters
        </h3>
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
              : `${pagination.total} professional${pagination.total === 1 ? '' : 's'} match${pagination.total === 1 ? 'es' : ''} this search.`
          }
        />
      </section>

      {saved.error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {saved.error}
        </p>
      )}

      {anyLocked && !loading && <SubscriptionLockNotice count={pagination.total} />}

      <Results />

      {booking && (
        <BookingRequestDialog
          professional={booking}
          onClose={() => setBooking(null)}
        />
      )}

      <p className="text-[12px] text-brand-textSec">
        <Search size={12} className="mr-1 inline" aria-hidden="true" />
        Looking for someone you have worked with before? Check{' '}
        <Link to="/company/dashboard?tab=favorites" className="font-semibold text-brand-primary hover:underline">
          Saved Professionals
        </Link>.
      </p>
    </div>
  );
}
