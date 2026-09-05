import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, AlertCircle, Loader2, BookmarkCheck, Send,
  ChevronLeft, ChevronRight, Search
} from 'lucide-react';
import api from '../../utils/api';
import ProfessionalCard from '../professionals/ProfessionalCard';
import SubscriptionLockNotice from '../professionals/SubscriptionLockNotice';
import BookingRequestDialog from '../professionals/BookingRequestDialog';

/**
 * Saved Professionals - the company's bookmarks.
 *
 * The rows come from GET /api/saved-professionals, which serialises through the
 * SAME publicProfileService rules as search. A company without an active plan
 * sees locked cards here too; bookmarking is not a way around the lock.
 *
 * The saved-state itself is owned by useSavedProfessionals in CompanyDashboard
 * and passed in, so unsaving here is immediately reflected in Find Crew without
 * either tab refetching the other's data.
 */
const PAGE_SIZE = 12;

export default function SavedProfessionals({ saved }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/saved-professionals', {
        params: { page, limit: PAGE_SIZE },
        timeout: 15_000
      });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setRows([]);
      setError(
        !err.response
          ? err.code === 'ECONNABORTED'
            ? 'That took too long. Check your connection and try again.'
            : 'We could not reach the server. Check your connection and try again.'
          : err.response?.data?.message || 'Could not load your saved professionals.'
      );
    } finally {
      // Always clears - this panel can never be left spinning.
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  /**
   * Unsaving removes the card from this list immediately rather than refetching
   * the page, so the grid does not flicker. The shared hook keeps Find Crew's
   * copy of the saved set in step.
   */
  const unsave = async (pro) => {
    const id = String(pro.id || pro._id);
    // remove(), not toggle(): a row here is already saved, so the direction
    // must not be inferred from a shared set that may still be loading.
    const result = await saved.remove(pro);
    if (result?.error) return;
    setRows((prev) => prev.filter((r) => String(r.id || r._id) !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
  };

  const lockedCount = rows.filter((r) => r.locked).length;

  const UnsaveButton = ({ pro }) => {
    const busy = saved.isPending(String(pro.id || pro._id));
    return (
      <button
        type="button"
        onClick={() => unsave(pro)}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-primary bg-brand-primary/10 px-3 py-2.5 text-[13px] font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <BookmarkCheck size={14} aria-hidden="true" />}
        {busy ? 'Removing…' : 'Saved'}
      </button>
    );
  };

  const Body = () => {
    if (loading) {
      return (
        <p className="flex items-center gap-2 py-10 text-[13px] text-brand-textSec">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Loading your saved list…
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
            onClick={load}
            className="mt-3 rounded-lg bg-brand-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            Try again
          </button>
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <Star size={20} aria-hidden="true" />
          </span>
          <p className="text-[14px] font-semibold text-brand-navy">Nothing saved yet</p>
          <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-brand-textSec">
            Save professionals while you are searching and they will collect here, so you can reach
            the people you liked without running the same search twice.
          </p>
          <Link
            to="/company/dashboard?tab=search"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            <Search size={13} aria-hidden="true" /> Find Crew
          </Link>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((pro) => (
            <ProfessionalCard
              key={pro.id || pro._id}
              professional={pro}
              lockedActions={<UnsaveButton pro={pro} />}
              actions={
                <div className="flex gap-2">
                  <div className="flex-1"><UnsaveButton pro={pro} /></div>
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-2 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <span className="text-[12px] tabular-nums text-brand-textSec">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
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
        <h2 className="text-xl font-semibold text-brand-navy">Saved Professionals</h2>
        <p className="mt-0.5 text-[13px] text-brand-textSec">
          {pagination.total > 0
            ? `${pagination.total} professional${pagination.total === 1 ? '' : 's'} you have bookmarked.`
            : 'Professionals you bookmark while searching.'}
        </p>
      </div>

      {saved.error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-brand-danger">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {saved.error}
        </p>
      )}

      {lockedCount > 0 && !loading && <SubscriptionLockNotice count={pagination.total} />}

      <Body />

      {booking && (
        <BookingRequestDialog professional={booking} onClose={() => setBooking(null)} />
      )}
    </div>
  );
}
