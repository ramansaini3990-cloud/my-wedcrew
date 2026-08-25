import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, X, Loader2, AlertCircle, Activity as ActivityIcon,
  User, CreditCard, IndianRupee, CalendarCheck, ClipboardList,
  MessageSquare, UserCog, Shield, FileText
} from 'lucide-react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

/**
 * Admin -> Live Activity.
 *
 * Reads the admin-only /api/admin/activity-logs API and subscribes to the
 * EXISTING Socket.IO connection for the `activity:new` event, which the server
 * only emits into an admin-only room. No new real-time technology is used.
 */

const CATEGORY_META = {
  users: { label: 'Users', icon: User, tone: 'text-blue-600 bg-blue-50 border-blue-200' },
  subscriptions: { label: 'Subscriptions', icon: CreditCard, tone: 'text-brand-primary bg-brand-primary/10 border-brand-primary/25' },
  payments: { label: 'Payments', icon: IndianRupee, tone: 'text-green-700 bg-green-50 border-green-200' },
  bookings: { label: 'Bookings', icon: CalendarCheck, tone: 'text-purple-700 bg-purple-50 border-purple-200' },
  requirements: { label: 'Requirements', icon: ClipboardList, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  applications: { label: 'Applications', icon: FileText, tone: 'text-teal-700 bg-teal-50 border-teal-200' },
  messages: { label: 'Messages', icon: MessageSquare, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  profiles: { label: 'Profiles', icon: UserCog, tone: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  admin: { label: 'Admin', icon: Shield, tone: 'text-brand-navy bg-brand-bg border-brand-border' },
  system: { label: 'System', icon: ActivityIcon, tone: 'text-brand-textSec bg-brand-bg border-brand-border' }
};

const SEVERITY_DOT = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500'
};

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'users', label: 'Users' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'payments', label: 'Payments' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'applications', label: 'Applications' },
  { id: 'messages', label: 'Messages' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'admin', label: 'Admin' }
];

const RANGES = [
  { id: '', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' }
];

const relativeTime = (value) => {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  const days = Math.floor(secs / 86400);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const clockTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

const dayLabel = (value) => {
  const d = new Date(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return 'Today';
  if (dd.getTime() === yest.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const inputClass =
  'w-full bg-brand-surface border border-brand-border rounded-lg px-3 h-9 text-[13px] text-brand-navy placeholder-brand-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 transition-shadow';

export default function ActivityLog() {
  const socket = useSocket();

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, has_more: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState('');
  const [range, setRange] = useState('');
  const [search, setSearch] = useState('');

  const [live, setLive] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [selected, setSelected] = useState(null);

  // Filters live in a ref too, so the socket handler always sees current values
  // without needing to re-subscribe on every keystroke.
  const filterRef = useRef({ category: '', range: '', search: '' });
  useEffect(() => { filterRef.current = { category, range, search }; }, [category, range, search]);

  const buildParams = useCallback((page) => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '30');
    if (category) p.set('category', category);
    if (range) p.set('range', range);
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [category, range, search]);

  const fetchPage = useCallback(async (page = 1, append = false) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(null); }
    try {
      const res = await api.get(`/api/admin/activity-logs?${buildParams(page)}`);
      const data = res.data?.data || [];
      setItems((prev) => (append ? [...prev, ...data] : data));
      setPagination(res.data?.pagination || { page, pages: 1, total: data.length, has_more: false });
      if (!append) setNewCount(0);
    } catch (err) {
      console.error('Failed to load activity', err);
      if (!append) { setError('Unable to load activity.'); setItems([]); }
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [buildParams]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/activity-logs/stats');
      setStats(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load activity stats', err);
    }
  }, []);

  // Debounced reload whenever a filter changes.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, false), 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ---- Real-time: reuse the existing Socket.IO connection --------- */
  useEffect(() => {
    if (!socket) { setLive(false); return undefined; }

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);

    const onActivity = (entry) => {
      const f = filterRef.current;
      // Respect the active filters so the stream stays consistent.
      if (f.category && entry.category !== f.category) return;
      if (f.search) {
        const hay = `${entry.title} ${entry.description || ''} ${entry.actor?.name || ''}`.toLowerCase();
        if (!hay.includes(f.search.toLowerCase())) return;
      }
      setItems((prev) => {
        if (prev.some((i) => String(i.id || i._id) === String(entry.id || entry._id))) return prev;
        return [entry, ...prev];
      });
      setNewCount((n) => n + 1);
      setStats((s) => (s ? { ...s, today_total: (s.today_total || 0) + 1 } : s));
    };

    setLive(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('activity:new', onActivity);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('activity:new', onActivity);
    };
  }, [socket]);

  /* ---------------------------------------------------------------- */

  const grouped = items.reduce((acc, item) => {
    const key = dayLabel(item.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const statTiles = stats
    ? [
        { label: "Today's Activity", value: stats.today_total },
        { label: 'New Users', value: stats.users },
        { label: 'Subscriptions', value: stats.subscriptions },
        { label: 'Bookings', value: stats.bookings },
        { label: 'Payments', value: stats.payments }
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-brand-navy">Live Activity</h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                live
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-brand-bg text-brand-textSec border-brand-border'
              }`}
              title={live ? 'Connected to the live stream' : 'Reconnecting to the live stream'}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-green-500' : 'bg-brand-muted animate-pulse'}`} />
              {live ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <p className="text-[13px] text-brand-textSec mt-0.5">
            System events as they happen, newest first.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {newCount > 0 && (
            <button
              onClick={() => { setNewCount(0); fetchStats(); }}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-[13px] font-semibold hover:bg-brand-primary/15 transition-colors"
            >
              {newCount} new {newCount === 1 ? 'activity' : 'activities'}
            </button>
          )}
          <button
            onClick={() => { fetchPage(1, false); fetchStats(); }}
            className="inline-flex items-center gap-2 px-3 h-9 border border-brand-border rounded-lg text-[13px] font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {statTiles.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {statTiles.map((tile) => (
            <div key={tile.label} className="bg-brand-surface rounded-xl border border-brand-border p-3.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-textSec">{tile.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-brand-navy tabular-nums leading-none">{tile.value ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              onClick={() => setCategory(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                category === f.id
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-surface border border-brand-border text-brand-navy hover:text-brand-primary hover:border-brand-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-primary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              className={`${inputClass} pl-8`}
            />
          </div>
          <select value={range} onChange={(e) => setRange(e.target.value)} className={`${inputClass} sm:w-44`}>
            {RANGES.map((r) => <option key={r.id || 'all'} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stream */}
      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
        {loading && (
          <div className="p-6 space-y-3 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-brand-bg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-brand-bg" />
                  <div className="h-3 w-1/2 rounded bg-brand-bg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-12 text-center">
            <AlertCircle size={22} className="mx-auto text-brand-danger mb-2.5" />
            <p className="text-[14px] font-semibold text-brand-navy">{error}</p>
            <button
              onClick={() => fetchPage(1, false)}
              className="mt-4 px-4 py-2 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="p-14 text-center">
            <ActivityIcon size={24} className="mx-auto text-brand-textSec/40 mb-2.5" />
            <p className="text-[15px] font-semibold text-brand-navy">No activity yet</p>
            <p className="mt-1 text-[13px] text-brand-textSec">
              Events appear here as users register, subscribe, book and post requirements.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div>
            {Object.entries(grouped).map(([day, entries]) => (
              <div key={day}>
                <p className="px-4 py-2 bg-brand-bg border-b border-brand-border text-[10px] font-bold uppercase tracking-wider text-brand-textSec sticky top-0">
                  {day}
                </p>
                <ul className="divide-y divide-brand-border">
                  {entries.map((item) => {
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
                    const Icon = meta.icon;
                    return (
                      <li key={item.id || item._id}>
                        <button
                          onClick={() => setSelected(item)}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-brand-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset"
                        >
                          <span className={`mt-0.5 h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.tone}`}>
                            <Icon size={15} aria-hidden="true" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[item.severity] || SEVERITY_DOT.info}`} />
                              <span className="text-[13px] font-semibold text-brand-navy">{item.title}</span>
                            </span>
                            {item.description && (
                              <span className="block mt-0.5 text-[12px] text-brand-textSec truncate">{item.description}</span>
                            )}
                            {item.actor?.name && (
                              <span className="block mt-0.5 text-[11px] text-brand-muted">
                                {item.actor.name}{item.actor.role ? ` · ${item.actor.role}` : ''}
                              </span>
                            )}
                          </span>

                          <span className="shrink-0 text-right">
                            <span className="block text-[11px] text-brand-textSec tabular-nums">{clockTime(item.created_at)}</span>
                            <span className="block text-[10px] text-brand-muted">{relativeTime(item.created_at)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {pagination.has_more && (
              <div className="p-4 border-t border-brand-border text-center">
                <button
                  onClick={() => fetchPage(pagination.page + 1, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
                <p className="mt-2 text-[11px] text-brand-textSec">
                  Showing {items.length} of {pagination.total}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-brand-navy/50 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-brand-surface border border-brand-border rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Activity details"
          >
            <div className="flex justify-between items-start gap-3 px-5 py-4 border-b border-brand-border">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-brand-navy">{selected.title}</h3>
                <p className="text-[12px] text-brand-textSec mt-0.5">
                  {new Date(selected.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-brand-textSec hover:text-brand-primary transition-colors shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-[13px]">
              {selected.description && (
                <p className="text-brand-navy leading-relaxed">{selected.description}</p>
              )}

              <dl className="space-y-2.5 pt-3 border-t border-brand-border">
                <Row label="Category" value={CATEGORY_META[selected.category]?.label || selected.category} />
                <Row label="Event" value={selected.event_type} mono />
                <Row label="Severity" value={selected.severity} />
                {selected.actor?.name && <Row label="Actor" value={selected.actor.name} />}
                {selected.actor?.role && <Row label="Actor role" value={selected.actor.role} />}
                {selected.target?.type && <Row label="Target type" value={selected.target.type} />}
                {selected.target?.label && <Row label="Target" value={selected.target.label} />}
                {Object.entries(selected.metadata || {}).map(([k, v]) => (
                  <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                ))}
                <Row label="Activity ID" value={selected.id || selected._id} mono />
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value, mono = false }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-brand-textSec capitalize shrink-0">{label}</dt>
    <dd className={`text-brand-navy font-medium text-right break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
  </div>
);
