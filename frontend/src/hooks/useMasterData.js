import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

/**
 * Loads Admin-managed professions and states once, and fetches cities on demand
 * for the selected state (the cascade).
 *
 * Nothing is hardcoded in components - every option comes from
 * /api/master/*, which returns only ACTIVE records by default.
 *
 * Cities are cached per state so switching back and forth does not refetch.
 */
export default function useMasterData(initialStateId = null) {
  const [professions, setProfessions] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState(null);
  const [cityError, setCityError] = useState(null);

  const cityCache = useRef({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingLists(true);
      setError(null);
      try {
        const [profRes, stateRes] = await Promise.all([
          api.get('/api/master/professions'),
          api.get('/api/master/states')
        ]);
        if (cancelled) return;
        setProfessions(profRes.data?.data || []);
        setStates(stateRes.data?.data || []);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load master data', err);
        setError('Unable to load professions and states.');
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  /** Fetches (and caches) the cities belonging to one state. */
  const loadCities = useCallback(async (stateId) => {
    if (!stateId) {
      setCities([]);
      setCityError(null);
      return [];
    }
    if (cityCache.current[stateId]) {
      setCities(cityCache.current[stateId]);
      setCityError(null);
      return cityCache.current[stateId];
    }

    setLoadingCities(true);
    setCityError(null);
    try {
      const res = await api.get(`/api/master/cities?state_id=${stateId}`);
      const list = res.data?.data || [];
      cityCache.current[stateId] = list;
      setCities(list);
      return list;
    } catch (err) {
      console.error('Failed to load cities', err);
      setCityError('Unable to load cities for this state.');
      setCities([]);
      return [];
    } finally {
      setLoadingCities(false);
    }
  }, []);

  // Preload cities for an already-selected state (editing an existing profile).
  useEffect(() => {
    if (initialStateId) loadCities(initialStateId);
  }, [initialStateId, loadCities]);

  return {
    professions,
    states,
    cities,
    loadingLists,
    loadingCities,
    error,
    cityError,
    loadCities
  };
}
