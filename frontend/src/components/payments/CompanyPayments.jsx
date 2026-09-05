import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, X, IndianRupee, Wallet, RotateCcw, Clock, Banknote, CreditCard } from 'lucide-react';
import api from '../../utils/api';
import { formatPaise, formatBps, METHOD_LABEL } from '../../utils/money';
import { StatCard, StatusBadge, EmptyState, Feedback, TableShell, inputClass } from './PaymentPrimitives';
import UnderConstruction from '../ui/UnderConstruction';
import { ONLINE_PAYMENTS_ENABLED } from '../../config/features';
import { describeApiError } from '../../utils/apiError';

/**
 * Company "Payments" panel.
 *
 * Renders inside the existing company dashboard shell - no layout, sidebar or
 * theme change. Every amount shown comes from the server as integer paise;
 * this component formats but never calculates.
 */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online', method: 'online' },
  { id: 'cash', label: 'Cash', method: 'cash' },
  { id: 'pending', label: 'Pending', status: 'PENDING,INITIATED,PROCESSING,CASH_PENDING' },
  { id: 'completed', label: 'Completed', status: 'SUCCESS,CASH_CONFIRMED' },
  { id: 'failed', label: 'Failed', status: 'FAILED,REFUND_FAILED' },
  { id: 'refunded', label: 'Refunded', status: 'REFUNDED,CASH_REFUND_CONFIRMED' },
  { id: 'disputed', label: 'Disputed', status: 'CASH_DISPUTED' }
];

/* ================================================================== */
/* New payment form                                                    */
/* ================================================================== */
function NewPayment({ connections, config, onDone, onCancel }) {
  // Always starts on cash. While ONLINE_PAYMENTS_ENABLED is false it can never
  // move off it - the online chip is disabled and the guard in submit() below
  // refuses an online method even if the state were forced.
  const [form, setForm] = useState({ freelancer_id: '', amount: '', method: 'cash', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.freelancer_id) return setError('Choose a professional.');
    if (!form.amount) return setError('Enter an amount.');
    // Belt and braces: the UI cannot select 'online' while the gate is closed,
    // so reaching here means the state was tampered with.
    if (!ONLINE_PAYMENTS_ENABLED && form.method === 'online') {
      return setError('Online payments are not available yet. Record this as a cash payment instead.');
    }

    setBusy(true);
    try {
      // An idempotency key makes a double submit safe: the server returns the
      // original payment instead of creating a second one.
      const key = `pay_${form.freelancer_id}_${form.amount}_${Date.now()}`;
      const { data } = await api.post('/api/payments', {
        freelancer_id: form.freelancer_id,
        amount: form.amount,
        method: form.method,
        note: form.note
      }, { headers: { 'Idempotency-Key': key } });

      if (form.method === 'online') {
        // Sandbox has no hosted checkout, so the payment stays PENDING until
        // the provider webhook confirms it. Nothing is marked paid here.
        onDone(
          data.checkout?.sandbox
            ? 'Payment created in sandbox mode. It stays pending until the provider confirms it.'
            : 'Payment created. Complete the checkout to finish.'
        );
      } else {
        onDone('Cash payment recorded. The professional will confirm receipt.');
      }
    } catch (err) {
      setError(describeApiError(err, 'Could not start this payment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5 rounded-xl border border-brand-primary/30 bg-brand-surface p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-brand-navy">New payment</h4>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="text-brand-textSec hover:text-brand-primary">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pay-freelancer" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Professional</label>
          <select id="pay-freelancer" value={form.freelancer_id} onChange={(e) => set('freelancer_id', e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {connections.length === 0 && (
            <p className="mt-1 text-[11px] text-brand-textSec">You can pay professionals you are connected with.</p>
          )}
        </div>
        <div>
          <label htmlFor="pay-amount" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Amount (₹)</label>
          <input id="pay-amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} inputMode="decimal" placeholder="25000" className={inputClass} />
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Payment method</span>
        <div className="flex gap-2">
          {[{ id: 'online', label: 'Online payment', icon: CreditCard }, { id: 'cash', label: 'Cash payment', icon: Banknote }].map((m) => {
            const locked = m.id === 'online' && !ONLINE_PAYMENTS_ENABLED;
            return (
              <button
                key={m.id}
                type="button"
                disabled={locked}
                aria-disabled={locked}
                title={locked ? 'Online payments are being set up' : undefined}
                onClick={() => !locked && set('method', m.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  locked
                    ? 'cursor-not-allowed border-dashed border-brand-border bg-brand-bg text-brand-muted'
                    : form.method === m.id
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
                }`}
              >
                <m.icon size={13} aria-hidden="true" /> {m.label}
                {locked && <span className="font-normal">(coming soon)</span>}
              </button>
            );
          })}
        </div>
        {!ONLINE_PAYMENTS_ENABLED && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-brand-textSec">
            Online card and UPI payments are still being set up. Cash payments work normally --
            record the amount here and your professional confirms receipt.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="pay-note" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Note (optional)</label>
        <input id="pay-note" value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} className={inputClass} />
      </div>

      {config?.fee_bps !== undefined && (
        <p className="text-[11.5px] text-brand-textSec">
          A platform fee of {formatBps(config.fee_bps)} is deducted from the professional&apos;s payout.
        </p>
      )}

      <Feedback type="error">{error}</Feedback>

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60">
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {busy ? 'Starting…' : 'Create payment'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */
export default function CompanyPayments() {
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState(null);
  const [config, setConfig] = useState(null);
  const [connections, setConnections] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
      const params = {};
      if (active.method) params.method = active.method;
      if (active.status) params.status = active.status;

      const { data } = await api.get('/api/payments', { params });
      setPayments(data.data || []);
      setTotals(data.totals || null);
      setError(null);
    } catch {
      setError('Could not load your payments.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/api/payments/config').then((r) => setConfig(r.data?.data || null)).catch(() => {});
    // Connected professionals come from the existing accepted booking requests.
    api.get('/api/booking-requests/company')
      .then((r) => {
        const rows = (r.data?.data || []).filter((b) => b.status === 'accepted');
        const seen = new Map();
        for (const b of rows) {
          const f = b.freelancer_id;
          if (f && typeof f === 'object' && !seen.has(String(f._id || f.id))) {
            seen.set(String(f._id || f.id), { id: String(f._id || f.id), name: f.name });
          }
        }
        setConnections([...seen.values()]);
      })
      .catch(() => setConnections([]));
  }, []);

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(null), 4000); };

  const refund = async (payment) => {
    if (!window.confirm(`Request a refund of ${formatPaise(payment.amount_paise)}?`)) return;
    try {
      const { data } = await api.post(`/api/payments/${payment.id}/refund`, { reason: 'Requested by company' });
      flash(data.message || 'Refund requested.');
      load();
    } catch (err) {
      flash(describeApiError(err, 'Could not request a refund.'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-brand-navy">Payments</h2>
          <p className="mt-0.5 text-[12.5px] text-brand-textSec">
            {ONLINE_PAYMENTS_ENABLED
              ? 'Pay your crew online or record a cash settlement.'
              : 'Record a cash settlement with your crew. Online payments are coming soon.'}
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            <Plus size={15} aria-hidden="true" /> Make a payment
          </button>
        )}
      </div>

      {notice && <Feedback type="success">{notice}</Feedback>}

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total paid" valuePaise={totals?.total_paid || 0} icon={IndianRupee} />
        <StatCard label="Refunded" valuePaise={totals?.refunded || 0} tone="muted" icon={RotateCcw} />
        <StatCard label="Net paid" valuePaise={totals?.net_paid || 0} tone="positive" icon={Wallet} />
        <StatCard
          label="Awaiting settlement"
          value={String(payments.filter((p) => ['CASH_PENDING', 'PENDING', 'INITIATED', 'PROCESSING'].includes(p.status)).length)}
          hint="on this page"
          tone="warning"
          icon={Clock}
        />
      </div>

      {creating && (
        <NewPayment
          connections={connections}
          config={config}
          onCancel={() => setCreating(false)}
          onDone={(msg) => { setCreating(false); flash(msg); load(); }}
        />
      )}

      {/* History */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Payment history</h3>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  filter === f.id
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {/* The Online tab is the online-payment surface, so the gate shows here.
              Historic online payments, if any exist, are still reachable from
              the All tab - nothing is hidden from the record. */}
          {filter === 'online' && !ONLINE_PAYMENTS_ENABLED ? (
            <UnderConstruction
              title="Online payments"
              description="Card, UPI and netbanking payments are being set up with our payment provider and are not available yet. Cash payments work today: use Make a payment, choose Cash, and your professional confirms receipt."
            />
          ) : loading ? (
            <p className="flex items-center gap-2 text-[13px] text-brand-textSec">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading…
            </p>
          ) : error ? (
            <Feedback type="error">{error}</Feedback>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title="No payments yet"
              description="Payments you make to your crew will appear here with their status and transaction reference."
            />
          ) : (
            <TableShell headers={['Date', 'Professional', 'Amount', 'Method', 'Status', 'Reference', '']}>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium text-brand-navy">{p.freelancer?.name || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold tabular-nums text-brand-navy">
                    {formatPaise(p.amount_paise)}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-brand-textSec">{METHOD_LABEL[p.method]}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-brand-textSec">{p.reference}</td>
                  <td className="px-3 py-2.5 text-right">
                    {['SUCCESS', 'CASH_CONFIRMED'].includes(p.status) && (
                      <button
                        onClick={() => refund(p)}
                        className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand-textSec transition-colors hover:bg-brand-primary/10 hover:text-brand-primary"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </div>
      </section>
    </div>
  );
}
