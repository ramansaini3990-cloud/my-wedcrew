import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

/**
 * Reads the signed-in user's subscription snapshot from the backend.
 *
 * The backend remains the only authority on access; this hook exists purely so
 * the UI can DISPLAY plan / status / expiry / chat state without every
 * component re-implementing the rules.
 */
export default function useSubscription() {
  const { user, token } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!token || !user || user.role === 'admin') {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/api/subscriptions/me');
      setSubscription(res.data?.data || null);
    } catch (error) {
      console.error('Failed to load subscription', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { subscription, loading, refresh: fetchSubscription };
}
