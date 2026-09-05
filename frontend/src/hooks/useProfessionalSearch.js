import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';

/**
 * Professional search, shared by the public /freelancers page and the company
 * dashboard's Find Crew tab.
 *
 * It exists so the two surfaces cannot drift: one place builds the query, one
 * place owns pagination, one place decides what "no results" means. Previously
 * only the public page had this logic, and it built its query inline.
 *
 * URL IS THE SOURCE OF TRUTH
 * Filters live in the query string, so a search can be shared, survives a
 * refresh, and Back steps through it. Writes go through a functional update on
 * the existing params, so the dashboard's own `?tab=` is preserved rather than
 * clobbered.
 *
 * NO INFINITE SPINNERS
 * Every request has a timeout and every path out of the fetch clears loading in
 * a `finally`. A stale response can never win over a newer one - each run
 * carries a sequence number and only the latest is allowed to write state.
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** Everything the search endpoint understands, plus the legacy string filters. */
export const EMPTY_FILTERS = {
  profession_id: '',
  state_id: '',
  city_id: '',
  date: '',
  profession: '',
  city: ''
};

export default function useProfessionalSearch({ limit = 12 } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    profession_id: searchParams.get('profession_id') || '',
    state_id: searchParams.get('state_id') || '',
    city_id: searchParams.get('city_id') || '',
    date: searchParams.get('date') || '',
    // Legacy string filters - still accepted by the API and by old links.
    profession: searchParams.get('profession') || '',
    city: searchParams.get('city') || '',
    // Travel-inclusive by default, matching the endpoint's own default.
    include_travel: searchParams.get('include_travel') !== 'false'
  }), [searchParams]);

  const page = Math.max(parseInt(searchParams.get('page'), 10) || 1, 1);

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hasFilters = Boolean(
    filters.profession_id || filters.state_id || filters.city_id ||
    filters.date || filters.profession || filters.city || !filters.include_travel
  );

  /** Merge into the existing query string; never drop params we do not own. */
  const writeParams = useCallback((mutate) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    });
  }, [setSearchParams]);

  /** Changing any filter returns to page 1 - page 4 of the old result set is meaningless. */
  const setFilter = useCallback((name, value) => {
    writeParams((next) => {
      if (value === '' || value === null || value === undefined) next.delete(name);
      else next.set(name, String(value));

      // A city belongs to a state; changing the state invalidates it.
      if (name === 'state_id') next.delete('city_id');
      next.delete('page');
    });
  }, [writeParams]);

  const setIncludeTravel = useCallback((on) => {
    writeParams((next) => {
      // Only the non-default is worth carrying in the URL.
      if (on) next.delete('include_travel');
      else next.set('include_travel', 'false');
      next.delete('page');
    });
  }, [writeParams]);

  const setPage = useCallback((n) => {
    writeParams((next) => {
      if (n <= 1) next.delete('page');
      else next.set('page', String(n));
    });
  }, [writeParams]);

  const clearFilters = useCallback(() => {
    writeParams((next) => {
      for (const key of [...Object.keys(EMPTY_FILTERS), 'include_travel', 'page']) next.delete(key);
    });
  }, [writeParams]);

  // Bumped by retry() to re-run the effect without changing any filter.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Only the newest request may write state, so a slow earlier response cannot
  // overwrite a faster later one.
  const runRef = useRef(0);

  const queryKey = useMemo(() => {
    const q = new URLSearchParams();
    if (filters.profession_id) q.set('profession_id', filters.profession_id);
    else if (filters.profession) q.set('profession', filters.profession);
    if (filters.state_id) q.set('state_id', filters.state_id);
    if (filters.city_id) q.set('city_id', filters.city_id);
    else if (filters.city) q.set('city', filters.city);
    if (filters.date) q.set('date', filters.date);
    if (!filters.include_travel) q.set('include_travel', 'false');
    q.set('page', String(page));
    q.set('limit', String(limit));
    return q.toString();
  }, [filters, page, limit]);

  useEffect(() => {
    const run = ++runRef.current;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const res = await api.get(`/api/public/freelancers?${queryKey}`, {
          timeout: REQUEST_TIMEOUT_MS
        });
        if (run !== runRef.current) return;
        setResults(Array.isArray(res.data?.data) ? res.data.data : []);
        setPagination(res.data?.pagination || { total: 0, page: 1, pages: 1 });
      } catch (err) {
        if (run !== runRef.current) return;
        setResults([]);
        setPagination({ total: 0, page: 1, pages: 1 });
        setError(
          !err.response
            ? err.code === 'ECONNABORTED'
              ? 'That search took too long. Check your connection and try again.'
              : 'We could not reach the server. Check your connection and try again.'
            : err.response?.data?.message || 'Something went wrong loading professionals.'
        );
      } finally {
        // Runs on every path, including the stale-run early returns above being
        // skipped - the guard below keeps a stale run from clearing a newer
        // request's spinner.
        if (run === runRef.current) setLoading(false);
      }
    })();
  }, [queryKey, attempt]);

  return {
    filters, page, results, pagination, loading, error, hasFilters,
    setFilter, setIncludeTravel, setPage, clearFilters, retry
  };
}
