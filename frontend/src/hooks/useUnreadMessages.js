import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

/**
 * Total unread chat messages, for the sidebar "Messages" badge.
 *
 * Reuses the existing pieces rather than adding a parallel system:
 *   - the count comes from GET /api/chat/unread-count (same `read_at` field
 *     the conversation list already uses, so the two can never disagree)
 *   - live updates ride the existing `conversation_unread` socket event, which
 *     now carries an absolute `totalUnread` alongside the per-conversation count
 *
 * The value is always SET from the server, never incremented locally, so a
 * reconnect or a duplicate event cannot inflate the badge.
 *
 * Chat unread is deliberately separate from the global Notifications count -
 * see backend/src/socket.js: chat messages raise no Notification record.
 */
export const UNREAD_MESSAGES_EVENT = 'wedcrew:messages-read';

/** Lets the Messages page tell the sidebar a conversation was just read. */
export const publishUnreadTotal = (total) => {
  window.dispatchEvent(new CustomEvent(UNREAD_MESSAGES_EVENT, { detail: { total } }));
};

export default function useUnreadMessages() {
  const { user, token } = useContext(AuthContext);
  const socket = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refresh = useCallback(async () => {
    if (!token || !user || user.role === 'admin') {
      setUnreadMessages(0);
      return;
    }
    try {
      const res = await api.get('/api/chat/unread-count');
      setUnreadMessages(res.data?.total_unread || 0);
    } catch {
      // A failed count must never break the dashboard; the badge just stays put.
    }
  }, [token, user]);

  useEffect(() => { refresh(); }, [refresh]);

  /* Live: a new message arrived for this user. */
  useEffect(() => {
    if (!socket) return undefined;
    const onUnread = ({ totalUnread }) => {
      if (typeof totalUnread === 'number') setUnreadMessages(totalUnread);
      else refresh(); // older payload without the total
    };
    socket.on('conversation_unread', onUnread);
    return () => socket.off('conversation_unread', onUnread);
  }, [socket, refresh]);

  /* Local: the Messages page marked a conversation read. */
  useEffect(() => {
    const onRead = (e) => {
      const total = e.detail?.total;
      if (typeof total === 'number') setUnreadMessages(total);
      else refresh();
    };
    window.addEventListener(UNREAD_MESSAGES_EVENT, onRead);
    return () => window.removeEventListener(UNREAD_MESSAGES_EVENT, onRead);
  }, [refresh]);

  return { unreadMessages, refresh };
}
