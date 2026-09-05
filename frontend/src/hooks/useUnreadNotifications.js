import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { NOTIFICATIONS_CHANGED } from '../components/NotificationsView';

/**
 * The signed-in user's unread system-notification count, kept live.
 *
 * Built for the admin topbar, whose bell previously rendered an unread dot
 * unconditionally - a permanent "you have something new" that was true only by
 * coincidence. Admins do receive real notifications (Notification.recipient_role
 * includes 'admin', and the finance and earnings flows address them), so the
 * dot is now driven by the same count and the same `new_notification` socket
 * event the freelancer and company dashboards already use.
 *
 * Deliberately NOT retrofitted into those two dashboards: their inline versions
 * work, and rewiring them would be a refactor rather than the removal of
 * something false.
 */
export default function useUnreadNotifications() {
  const socket = useSocket();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications/unread-count');
      setCount(Number(res.data?.count) || 0);
    } catch {
      // A failed count must not invent one. Zero means "nothing to show",
      // which is the honest default when we cannot ask.
      setCount(0);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // The inbox lives in a different component tree, so when something is read
  // there this listener is how the dot finds out - without it the count only
  // dropped on a page reload.
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange);
  }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = () => setCount((c) => c + 1);
    socket.on('new_notification', onNew);
    return () => socket.off('new_notification', onNew);
  }, [socket]);

  return { count, refresh };
}
