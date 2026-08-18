import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Fetches the public data the homepage needs, ONCE, and shares it with every
 * section (categories, featured professionals, requirements, availability,
 * trust stats).
 *
 * Only pre-existing public endpoints are used - no new API is introduced:
 *   GET /api/public/freelancers   (public)
 *   GET /api/requirements         (optional auth; the backend masks private
 *                                  fields for unauthenticated visitors)
 *
 * Each section receives explicit loading / error / empty signals so nothing
 * renders a blank white block when the API is unavailable.
 */
export default function useHomeData() {
  const [state, setState] = useState({
    professionals: [],
    requirements: [],
    loadingProfessionals: true,
    loadingRequirements: true,
    professionalsError: false,
    requirementsError: false
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [proRes, reqRes] = await Promise.allSettled([
        api.get('/api/public/freelancers'),
        api.get('/api/requirements')
      ]);

      if (cancelled) return;

      const professionals =
        proRes.status === 'fulfilled'
          ? proRes.value.data?.data || proRes.value.data || []
          : [];
      const requirements =
        reqRes.status === 'fulfilled'
          ? reqRes.value.data?.data || reqRes.value.data || []
          : [];

      if (proRes.status === 'rejected') {
        console.error('Homepage: failed to load professionals', proRes.reason);
      }
      if (reqRes.status === 'rejected') {
        console.error('Homepage: failed to load requirements', reqRes.reason);
      }

      setState({
        professionals: Array.isArray(professionals) ? professionals : [],
        requirements: Array.isArray(requirements) ? requirements : [],
        loadingProfessionals: false,
        loadingRequirements: false,
        professionalsError: proRes.status === 'rejected',
        requirementsError: reqRes.status === 'rejected'
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived values, computed from the live data only.
  const cities = Array.from(
    new Set(
      state.professionals
        .map((p) => (p.city || '').trim())
        .filter(Boolean)
    )
  ).sort();

  const publishedRequirements = state.requirements.filter(
    (r) => !r.status || r.status === 'published'
  );

  return {
    ...state,
    cities,
    publishedRequirements,
    counts: {
      professionals: state.professionals.length,
      cities: cities.length,
      requirements: publishedRequirements.length
    }
  };
}
