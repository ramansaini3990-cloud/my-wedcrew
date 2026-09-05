import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

/**
 * The company's saved-professional bookmarks.
 *
 * Called ONCE in CompanyDashboard and handed to both the Find Crew and Saved
 * Professionals tabs, so a save made in one is immediately reflected in the
 * other. Calling it separately per tab would give each its own copy of the
 * truth and let them disagree until a refresh.
 *
 * The set is fetched from /saved-professionals/ids, which returns nothing but
 * ids - so knowing what is bookmarked costs one small request and reveals
 * nothing the subscription lock withholds.
 *
 * Toggling is optimistic: the icon flips immediately and rolls back if the
 * request fails, because a bookmark is cheap to undo and waiting on a round
 * trip for a star to fill in feels broken.
 */
export default function useSavedProfessionals(enabled = true) {
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  // Ids with a request in flight, so the button can disable just that one.
  const [pending, setPending] = useState(() => new Set());
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/saved-professionals/ids', { timeout: 15_000 });
      if (!mounted.current) return;
      setSavedIds(new Set((res.data?.data || []).map(String)));
      setError('');
    } catch {
      if (!mounted.current) return;
      // Not fatal: search still works, the save state is just unknown.
      setError('Could not load your saved list.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const isSaved = useCallback((id) => savedIds.has(String(id)), [savedIds]);
  const isPending = useCallback((id) => pending.has(String(id)), [pending]);

  const markPending = (id, on) => setPending((prev) => {
    const next = new Set(prev);
    if (on) next.add(String(id)); else next.delete(String(id));
    return next;
  });

  /**
   * Unconditionally REMOVE, without inferring direction from the local set.
   *
   * The saved list uses this rather than toggle(): a row in that list is
   * definitionally saved, but if the shared id set has not finished loading
   * yet, toggle() would read `wasSaved === false` and helpfully re-save the
   * very row the user asked to remove.
   */
  const remove = useCallback(async (professional) => {
    const id = String(professional.id || professional._id);
    markPending(id, true);
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await api.delete(`/api/saved-professionals/${id}`, { timeout: 15_000 });
      setError('');
      return { saved: false };
    } catch (err) {
      if (mounted.current) {
        setSavedIds((prev) => new Set(prev).add(id));
        setError(err.response?.data?.message || 'Could not update your saved list.');
      }
      return { error: err.response?.data?.message || 'Could not update your saved list.' };
    } finally {
      if (mounted.current) markPending(id, false);
    }
  }, []);

  /**
   * @returns {Promise<{saved: boolean} | {error: string}>}
   */
  const toggle = useCallback(async (professional) => {
    const id = String(professional.id || professional._id);
    const wasSaved = savedIds.has(id);

    markPending(id, true);
    // Optimistic flip.
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });

    try {
      if (wasSaved) {
        await api.delete(`/api/saved-professionals/${id}`, { timeout: 15_000 });
      } else {
        await api.post('/api/saved-professionals', { freelancer_id: id }, { timeout: 15_000 });
      }
      setError('');
      return { saved: !wasSaved };
    } catch (err) {
      // Roll back to the state the server still believes in.
      if (mounted.current) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id); else next.delete(id);
          return next;
        });
        setError(err.response?.data?.message || 'Could not update your saved list.');
      }
      return { error: err.response?.data?.message || 'Could not update your saved list.' };
    } finally {
      if (mounted.current) markPending(id, false);
    }
  }, [savedIds]);

  return { savedIds, isSaved, isPending, toggle, remove, reload: load, loading, error, setError };
}
