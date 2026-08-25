import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

/**
 * Loads the signed-in user's own profile from the existing
 * GET /api/profile/me endpoint (which also returns their availability blocks).
 *
 * Shared by the dashboard summary card and sidebar so the profile is fetched
 * once per dashboard, not once per component.
 */
export default function useMyProfile() {
  const { user, token } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !user || user.role === 'admin') {
      setProfile(null);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const res = await api.get('/api/profile/me');
      setProfile(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load profile', err);
      setError(true);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, error, refresh };
}
