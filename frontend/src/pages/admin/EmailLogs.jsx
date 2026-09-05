import { useState, useEffect, useCallback } from 'react';
import { Mail, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../utils/api';

/**
 * Admin view of transactional email delivery.
 *
 * PRIVACY: the EmailLog collection stores metadata only — no verification
 * token, no verification URL, no message body. There is deliberately nothing
 * on this page an admin could use to take over an account.
 *
 * Structured like the other admin pages (ActivityLog, Subscriptions): local
 * state, a fetch callback, filter chips, a scrollable table.
 */

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'SENT', label: 'Sent' },
  { id: 'FAILED', label: 'Failed' }
];

const StatusBadge = ({ status }) => {
  const sent = status === 'SENT';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${
        sent
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-brand-danger'
      }`}
    >
      {sent ? <CheckCircle2 size={10} aria-hidden="true" /> : <XCircle size={10} aria-hidden="true" />}
      {sent ? 'Sent' : 'Failed'}
    </span>
  );
};

export default function EmailLogs() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (status) params.status = status;
      const res = await api.get('/api/admin/email-logs', { params });
      setItems(res.data?.data || []);
      setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
      setError(null);
    } catch {
      setError('Could not load the email log.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Email log</h1>
        <p className="mt-0.5 text-[13px] text-brand-textSec">
          Delivery record for transactional email. Metadata only — verification links and tokens are never stored.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              onClick={() => { setStatus(f.id); setPage(1); }}
              aria-pressed={status === f.id}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                status === f.id
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                  : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-brand-textSec tabular-nums">
          {pagination.total} record{pagination.total === 1 ? '' : 's'}
        </p>
      </div>

      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        {loading ? (
          <p className="flex items-center gap-2 text-[13px] text-brand-textSec">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : error ? (
          <p className="flex items-center gap-1.5 text-[13px] text-brand-danger">
            <AlertCircle size={14} aria-hidden="true" /> {error}
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-bg px-6 py-10 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <Mail size={18} aria-hidden="true" />
            </span>
            <p className="text-[13.5px] font-semibold text-brand-navy">No emails logged yet</p>
            <p className="mt-1 max-w-sm text-[12.5px] text-brand-textSec">
              Verification emails appear here as soon as the first account is created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead>
                <tr className="border-b border-brand-border">
                  {['Sent at', 'Recipient', 'Subject', 'Template', 'Provider', 'Status', 'Error'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-brand-textSec">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">
                      {new Date(row.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] font-medium text-brand-navy">{row.to}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5 text-[12.5px] text-brand-textSec">{row.subject}</td>
                    <td className="px-3 py-2.5 text-[12px] text-brand-textSec">{row.template}</td>
                    <td className="px-3 py-2.5 text-[12px] text-brand-textSec">{row.provider}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
                    <td className="max-w-[14rem] truncate px-3 py-2.5 text-[12px] text-brand-danger">
                      {row.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[12px] text-brand-textSec tabular-nums">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
