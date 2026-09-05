import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

/**
 * "Resend verification email" with a visible cooldown.
 *
 * Shared by the signup confirmation screen and the login page, so the throttle
 * behaves identically in both.
 *
 * The server is the real throttle (60s, measured from email_verification_sent_at)
 * and answers 429 with `retry_after_seconds`. This countdown mirrors that so
 * the button explains itself instead of failing; if the server disagrees, its
 * value wins.
 */
const COOLDOWN_SECONDS = 60;

export default function useResendVerification(email) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  const resend = useCallback(async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.post('/api/auth/resend-verification', { email });
      setMessage(res.data?.message || 'Verification email sent.');
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      // The server's own remaining time is authoritative.
      const retry = err.response?.data?.retry_after_seconds;
      if (typeof retry === 'number') {
        setCooldown(retry);
        setError(err.response?.data?.message || 'Please wait before requesting another email.');
      } else {
        setError(err.response?.data?.message || 'Could not send the email. Try again shortly.');
      }
    } finally {
      setSending(false);
    }
  }, [email, sending, cooldown]);

  return { resend, sending, cooldown, message, error, COOLDOWN_SECONDS };
}
