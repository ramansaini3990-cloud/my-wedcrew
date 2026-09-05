import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { describeApiError } from '../utils/apiError';

/**
 * The shared system-notification list.
 *
 * Used by the freelancer dashboard, the company dashboard and the admin inbox.
 * Everything below the default props is OPT-IN, so the two dashboards render
 * exactly what they always did; the admin inbox switches on pagination and the
 * mark-all control rather than getting a second implementation of the same
 * list.
 *
 * @param {function} [onNotificationClick] existing behaviour, unchanged
 * @param {boolean}  [paginated]           ask the API for pages
 * @param {number}   [pageSize]
 * @param {boolean}  [showMarkAll]         render the "mark all read" control
 */

/**
 * Broadcast so the topbar's unread dot can drop the moment something is read
 * here. The dot lives in a different component tree, and a window event is a
 * far smaller change than lifting notification state into a provider.
 */
export const NOTIFICATIONS_CHANGED = 'notifications:changed';
const announceChange = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export default function NotificationsView({
  onNotificationClick,
  paginated = false,
  pageSize = 20,
  showMarkAll = false
}) {
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, unread: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/notifications', {
        params: paginated ? { page, limit: pageSize } : undefined,
        timeout: 15_000
      });
      setNotifications(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      // Previously a failure fell through to the empty state, which told the
      // user they had no notifications when the truth was that we could not ask.
      setNotifications([]);
      setError(describeApiError(err, 'Could not load your notifications.'));
    } finally {
      // Always clears - this list can never be left spinning.
      setLoading(false);
    }
  }, [paginated, page, pageSize]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // A notification arriving while the list is open should appear in it.
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = () => fetchNotifications();
    socket.on('new_notification', onNew);
    return () => socket.off('new_notification', onNew);
  }, [socket, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setPagination((p) => ({ ...p, unread: Math.max(0, p.unread - 1) }));
      announceChange();
    } catch (err) {
      setError(describeApiError(err, 'Could not mark that as read.'));
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setPagination((p) => ({ ...p, unread: 0 }));
      announceChange();
    } catch (err) {
      setError(describeApiError(err, 'Could not mark everything as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = (notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (onNotificationClick) onNotificationClick(notification);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-brand-textSec">
        <Loader2 size={18} className="mx-auto mb-2 animate-spin" aria-hidden="true" />
        Loading notifications...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto mb-3 text-brand-danger" aria-hidden="true" />
        <p className="text-sm font-semibold text-brand-navy">{error}</p>
        <button
          type="button"
          onClick={fetchNotifications}
          className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
        >
          Try again
        </button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <div className="h-16 w-16 bg-brand-bg rounded-full flex items-center justify-center mb-4">
          <Bell className="text-brand-textSec/50" size={32} />
        </div>
        <h3 className="text-lg font-bold text-brand-navy mb-1">No notifications</h3>
        <p className="text-brand-textSec text-sm">You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div>
      {showMarkAll && (
        <div className="flex items-center justify-between gap-3 border-b border-brand-border px-6 py-3">
          <p className="text-[12.5px] text-brand-textSec tabular-nums">
            {pagination.unread > 0
              ? `${pagination.unread} unread of ${pagination.total}`
              : `${pagination.total} notification${pagination.total === 1 ? '' : 's'}, all read`}
          </p>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll || pagination.unread === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {markingAll ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={13} aria-hidden="true" />}
            Mark all read
          </button>
        </div>
      )}

      <div className="divide-y divide-brand-border">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => handleItemClick(notif)}
            className={`group p-6 cursor-pointer border-l-[3px] hover:bg-brand-primary/5 transition-colors ${!notif.is_read ? 'bg-brand-primary/[0.07] border-l-brand-primary' : 'border-l-transparent'}`}
          >
            <div className="flex gap-4">
              <div className={`mt-1 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                notif.type.includes('accepted') ? 'bg-green-100 text-green-600' :
                notif.type.includes('rejected') ? 'bg-red-100 text-red-600' :
                notif.type.includes('shortlisted') ? 'bg-blue-100 text-blue-600' :
                'bg-brand-primary/10 text-brand-primary'
              }`}>
                <Bell size={18} />
              </div>
              <div>
                <h4 className={`text-sm font-bold group-hover:text-brand-primary transition-colors ${!notif.is_read ? 'text-brand-navy' : 'text-brand-textSec'}`}>{notif.title}</h4>
                <p className="text-sm text-brand-textSec mt-1">{notif.message}</p>
                <p className="text-xs text-brand-muted mt-2">{new Date(notif.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {paginated && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-brand-border px-6 py-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
          >
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </button>
          <span className="text-[12px] text-brand-textSec tabular-nums">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
          >
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
