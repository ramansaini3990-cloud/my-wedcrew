import { useState, useEffect, useCallback } from 'react';
import { IndianRupee, Wallet, AlertTriangle, Loader2, Percent } from 'lucide-react';
import api from '../../utils/api';
import { formatPaise, formatBps, METHOD_LABEL } from '../../utils/money';
import { StatCard, StatusBadge, EmptyState, Feedback, TableShell } from '../../components/payments/PaymentPrimitives';

/**
 * Admin finance panel.
 *
 * Rendered inside the EXISTING admin layout (sidebar, header and theme are
 * untouched); the sidebar already had a "Payments" entry pointing here, which
 * previously fell through to the Coming Soon page.
 *
 * Admins review and resolve. There is no control here that sets a balance
 * directly - corrections go through the ledger as adjustments on the server.
 */

const TABS = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'disputes', label: 'Cash disputes' },
  { id: 'settings', label: 'Settings' }
];

export default function Finance() {
  const [tab, setTab] = useState('transactions');
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [feeInput, setFeeInput] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/finance/overview');
      setOverview(data.data);
      setFeeInput(String((data.data?.settings?.fee_bps ?? 0) / 100));
    } catch {
      setError('Could not load the finance overview.');
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const path = {
        transactions: '/api/admin/finance/payments',
        withdrawals: '/api/admin/finance/withdrawals',
        disputes: '/api/admin/finance/disputes'
      }[tab];
      if (!path) { setRows([]); setLoading(false); return; }
      const { data } = await api.get(path);
      setRows(data.data || []);
      setError(null);
    } catch {
      setError('Could not load this list.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const flash = (t) => { setNotice(t); setTimeout(() => setNotice(null), 4000); };

  const updateWithdrawal = async (w, status) => {
    const note = status === 'FAILED' ? window.prompt('Why did this payout fail?') || 'Payout failed' : '';
    try {
      await api.patch(`/api/admin/finance/withdrawals/${w.id}`, { status, note });
      flash(`Withdrawal marked ${status.toLowerCase()}.`);
      loadRows(); loadOverview();
    } catch (err) {
      flash(err.response?.data?.message || 'Could not update this withdrawal.');
    }
  };

  const resolve = async (payment, resolution) => {
    const note = window.prompt(`Add a note for this ${resolution.toLowerCase()} resolution (optional):`) || '';
    try {
      await api.post(`/api/admin/finance/disputes/${payment.id}/resolve`, { resolution, note });
      flash(`Dispute resolved as ${resolution.toLowerCase()}.`);
      loadRows(); loadOverview();
    } catch (err) {
      flash(err.response?.data?.message || 'Could not resolve this dispute.');
    }
  };

  const saveFee = async (e) => {
    e.preventDefault();
    const percent = Number(feeInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return flash('Enter a percentage between 0 and 100.');
    try {
      await api.put('/api/admin/finance/settings', { fee_bps: Math.round(percent * 100) });
      flash('Platform fee updated.');
      loadOverview();
    } catch (err) {
      flash(err.response?.data?.message || 'Could not update settings.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-xl font-bold text-brand-navy">Finance</h1>
        <p className="mt-0.5 text-[12.5px] text-brand-textSec">Payments, withdrawals, cash disputes and platform fee.</p>
      </div>

      {notice && <Feedback type="success">{notice}</Feedback>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Settled volume" valuePaise={overview?.settled_total_paise} icon={IndianRupee} hint={`${overview?.settled_count ?? 0} payments`} />
        <StatCard label="Platform fees" valuePaise={overview?.platform_fees_paise} tone="positive" icon={Percent} />
        <StatCard
          label="Withdrawals pending"
          value={String((overview?.withdrawals_by_status || []).filter((w) => ['REQUESTED', 'PROCESSING'].includes(w.status)).reduce((a, w) => a + w.count, 0))}
          tone="warning"
          icon={Wallet}
        />
        <StatCard label="Open disputes" value={String(overview?.open_disputes ?? 0)} tone={overview?.open_disputes ? 'warning' : 'muted'} icon={AlertTriangle} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              tab === t.id ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        {error && <Feedback type="error">{error}</Feedback>}

        {tab === 'settings' ? (
          <form onSubmit={saveFee} className="max-w-sm space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Platform fee</h3>
            <label htmlFor="fee" className="block text-[12.5px] text-brand-textSec">
              Percentage deducted from each payment, currently {formatBps(overview?.settings?.fee_bps ?? 0)}.
            </label>
            <div className="flex gap-2">
              <input
                id="fee"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark">
                Save
              </button>
            </div>
            <p className="text-[11.5px] text-brand-textSec">
              Minimum withdrawal is currently {formatPaise(overview?.settings?.min_withdrawal_paise ?? 0)}.
              Changing the fee affects new payments only - existing records keep the rate they were created with.
            </p>
          </form>
        ) : loading ? (
          <p className="flex items-center gap-2 text-[13px] text-brand-textSec">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={tab === 'disputes' ? AlertTriangle : tab === 'withdrawals' ? Wallet : IndianRupee}
            title={{ transactions: 'No transactions found', withdrawals: 'No withdrawal requests', disputes: 'No cash disputes' }[tab]}
            description={tab === 'disputes' ? 'Disputed cash payments will appear here for review.' : undefined}
          />
        ) : tab === 'transactions' ? (
          <TableShell headers={['Date', 'Company', 'Professional', 'Amount', 'Fee', 'Net', 'Method', 'Status', 'Reference']}>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-brand-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-navy">{p.company?.name || '—'}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-navy">{p.freelancer?.name || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums text-brand-navy">{formatPaise(p.amount_paise)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums text-brand-textSec">{formatPaise(p.fee_paise)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums text-brand-navy">{formatPaise(p.net_paise)}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-textSec">{METHOD_LABEL[p.method]}</td>
                <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-brand-textSec">{p.reference}</td>
              </tr>
            ))}
          </TableShell>
        ) : tab === 'withdrawals' ? (
          <TableShell headers={['Requested', 'Professional', 'Amount', 'To', 'Status', 'Completed', '']}>
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-brand-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">{new Date(w.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-navy">{w.freelancer?.name || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] font-semibold tabular-nums text-brand-navy">{formatPaise(w.amount_paise)}</td>
                <td className="px-3 py-2.5 text-[12px] text-brand-textSec">{w.masked_destination}</td>
                <td className="px-3 py-2.5"><StatusBadge status={w.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-brand-textSec">{w.completed_at ? new Date(w.completed_at).toLocaleDateString('en-IN') : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {['REQUESTED', 'PROCESSING'].includes(w.status) && (
                    <span className="inline-flex gap-1">
                      {w.status === 'REQUESTED' && (
                        <button onClick={() => updateWithdrawal(w, 'PROCESSING')} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand-textSec hover:bg-brand-primary/10 hover:text-brand-primary">Approve</button>
                      )}
                      <button onClick={() => updateWithdrawal(w, 'COMPLETED')} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-green-700 hover:bg-green-50">Complete</button>
                      <button onClick={() => updateWithdrawal(w, 'FAILED')} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand-danger hover:bg-red-50">Fail</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <TableShell headers={['Date', 'Company', 'Professional', 'Amount', 'Reason', '']}>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-brand-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-navy">{p.company?.name || '—'}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-brand-navy">{p.freelancer?.name || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] font-semibold tabular-nums text-brand-navy">{formatPaise(p.amount_paise)}</td>
                <td className="max-w-[16rem] px-3 py-2.5 text-[12px] text-brand-textSec">{p.dispute_reason || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className="inline-flex gap-1">
                    <button onClick={() => resolve(p, 'CONFIRMED')} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-green-700 hover:bg-green-50">Confirm</button>
                    <button onClick={() => resolve(p, 'REJECTED')} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand-danger hover:bg-red-50">Reject</button>
                  </span>
                </td>
              </tr>
            ))}
          </TableShell>
        )}
      </section>
    </div>
  );
}
