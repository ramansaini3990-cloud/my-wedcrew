import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, Wallet, Clock, ArrowDownToLine, Loader2, X, Check,
  AlertTriangle, Landmark, Banknote
} from 'lucide-react';
import api from '../../utils/api';
import { formatPaise, formatBps, METHOD_LABEL } from '../../utils/money';
import { StatCard, StatusBadge, EmptyState, Feedback, TableShell, inputClass } from './PaymentPrimitives';
import { AUTOMATIC_PAYOUTS_ENABLED } from '../../config/features';

/**
 * Freelancer "Earnings" panel.
 *
 * Replaces the placeholder that previously occupied the existing Earnings tab -
 * the tab, sidebar and dashboard shell are unchanged.
 *
 * Every figure is derived server-side from the ledger. The browser never
 * computes a balance and never sends one.
 */

/* ================================================================== */
/* Payout account                                                      */
/* ================================================================== */
function PayoutAccountForm({ account, onSaved }) {
  const [editing, setEditing] = useState(!account);
  const [method, setMethod] = useState(account?.method || 'upi');
  const [form, setForm] = useState({ account_holder_name: account?.account_holder_name || '', account_number: '', ifsc: '', upi_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/api/payout-account', { method, ...form });
      onSaved(data.data);
      setEditing(false);
      setForm({ account_holder_name: data.data.account_holder_name || '', account_number: '', ifsc: '', upi_id: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your payout account.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Payout account</h3>
            <p className="mt-1.5 flex items-center gap-2 text-[13.5px] font-semibold text-brand-navy">
              {account.method === 'bank' ? <Landmark size={14} className="text-brand-primary" aria-hidden="true" /> : <Banknote size={14} className="text-brand-primary" aria-hidden="true" />}
              {/* Only the masked form ever leaves the server. */}
              {account.masked}
            </p>
            {account.account_holder_name && (
              <p className="mt-0.5 text-[12px] text-brand-textSec">{account.account_holder_name}</p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary">
            Change
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3.5 rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Payout account</h3>

      <div className="flex gap-2">
        {[{ id: 'upi', label: 'UPI', icon: Banknote }, { id: 'bank', label: 'Bank account', icon: Landmark }].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              method === m.id ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
            }`}
          >
            <m.icon size={13} aria-hidden="true" /> {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="po-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Account holder name</label>
          <input id="po-name" value={form.account_holder_name} onChange={(e) => set('account_holder_name', e.target.value)} className={inputClass} />
        </div>
        {method === 'upi' ? (
          <div>
            <label htmlFor="po-upi" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">UPI ID</label>
            <input id="po-upi" value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} placeholder="name@bank" className={inputClass} />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="po-acc" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Account number</label>
              <input id="po-acc" value={form.account_number} onChange={(e) => set('account_number', e.target.value)} inputMode="numeric" className={inputClass} />
            </div>
            <div>
              <label htmlFor="po-ifsc" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">IFSC</label>
              <input id="po-ifsc" value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} placeholder="HDFC0001234" className={inputClass} />
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-brand-textSec">
        Only a masked form of these details is ever shown or stored for display.
      </p>

      <Feedback type="error">{error}</Feedback>

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60">
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Save account
        </button>
        {account && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */
export default function FreelancerEarnings() {
  const [data, setData] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [pendingCash, setPendingCash] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [earnings, wd, cash] = await Promise.all([
        api.get('/api/earnings'),
        api.get('/api/withdrawals'),
        api.get('/api/payments', { params: { status: 'CASH_PENDING' } })
      ]);
      setData(earnings.data?.data || null);
      setWithdrawals(wd.data?.data || []);
      setPendingCash(cash.data?.data || []);
      setError(null);
    } catch {
      setError('Could not load your earnings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(null), 4000); };

  const act = async (payment, action) => {
    let body = {};
    if (action === 'cash-dispute') {
      const reason = window.prompt('What went wrong with this cash payment?');
      if (!reason) return;
      body = { reason };
    }
    try {
      await api.post(`/api/payments/${payment.id}/${action}`, body);
      flash(action === 'cash-confirm' ? 'Cash payment confirmed.' : 'Dispute raised. Our team will review it.');
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Could not update this payment.');
    }
  };

  const withdraw = async (e) => {
    e.preventDefault();
    setBusy(true); setFormError(null);
    try {
      await api.post('/api/withdrawals', { amount });
      setWithdrawOpen(false); setAmount('');
      flash('Withdrawal requested.');
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not request this withdrawal.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-brand-textSec">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading your earnings…
      </p>
    );
  }
  if (error) return <Feedback type="error">{error}</Feedback>;

  const balance = data?.balance || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-brand-navy">Earnings</h2>
          <p className="mt-0.5 text-[12.5px] text-brand-textSec">
            Your booking earnings, platform fees and withdrawals.
          </p>
        </div>
        {data?.payout_account && balance.available > 0 && !withdrawOpen && (
          <button
            onClick={() => setWithdrawOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            <ArrowDownToLine size={15} aria-hidden="true" /> Withdraw
          </button>
        )}
      </div>

      {notice && <Feedback type="success">{notice}</Feedback>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total earnings" valuePaise={balance.total_earned} icon={IndianRupee} />
        <StatCard label="Available" valuePaise={balance.available} tone="positive" icon={Wallet} hint="ready to withdraw" />
        <StatCard label="Pending" valuePaise={balance.pending} tone="warning" icon={Clock} hint="awaiting settlement" />
        <StatCard label="Withdrawn" valuePaise={balance.withdrawn} tone="muted" icon={ArrowDownToLine} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
        <StatCard
          label="Platform fees"
          valuePaise={balance.platform_fees}
          tone="muted"
          hint={data?.fee_bps !== undefined ? `${formatBps(data.fee_bps)} of each payment` : undefined}
        />
        <StatCard label="Net earnings" valuePaise={balance.net_earned} tone="positive" hint="after platform fees" />
      </div>

      {/* Withdraw form */}
      {withdrawOpen && (
        <form onSubmit={withdraw} className="space-y-3 rounded-xl border border-brand-primary/30 bg-brand-surface p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-bold text-brand-navy">Withdraw funds</h4>
            <button type="button" onClick={() => setWithdrawOpen(false)} aria-label="Cancel" className="text-brand-textSec hover:text-brand-primary"><X size={16} /></button>
          </div>
          <p className="text-[12.5px] text-brand-textSec">
            Available <span className="font-semibold text-brand-navy">{formatPaise(balance.available)}</span>
            {data?.min_withdrawal_paise ? <> · minimum {formatPaise(data.min_withdrawal_paise)}</> : null}
            {data?.payout_account ? <> · to {data.payout_account.masked}</> : null}
          </p>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount (₹)" className={inputClass} aria-label="Withdrawal amount" />
          {!AUTOMATIC_PAYOUTS_ENABLED && (
            <p className="rounded-lg border border-yellow-200 bg-yellow-50/70 px-3 py-2 text-[12px] leading-relaxed text-yellow-900">
              <strong className="font-semibold">Payouts are made by hand at the moment.</strong>{' '}
              Your request is recorded straight away and stays marked <em>Processing</em> until our
              team transfers the money and marks it paid. Automatic bank transfers are not switched
              on yet, so please allow a few working days.
            </p>
          )}
          <Feedback type="error">{formError}</Feedback>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60">
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Request withdrawal
          </button>
        </form>
      )}

      {/* Cash awaiting confirmation */}
      {pendingCash.length > 0 && (
        <section className="rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 sm:p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-yellow-800">Cash payments awaiting your confirmation</h3>
          <ul className="mt-3 space-y-2.5">
            {pendingCash.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-brand-surface p-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-brand-navy">{formatPaise(p.amount_paise)}</p>
                  <p className="text-[11.5px] text-brand-textSec">
                    {p.company?.name || 'A company'} · {new Date(p.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => act(p, 'cash-confirm')} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-primaryDark">
                    <Check size={13} aria-hidden="true" /> Confirm received
                  </button>
                  <button onClick={() => act(p, 'cash-dispute')} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy transition-colors hover:border-brand-danger hover:text-brand-danger">
                    <AlertTriangle size={13} aria-hidden="true" /> Dispute
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PayoutAccountForm account={data?.payout_account} onSaved={() => load()} />

      {/* Booking-wise earnings */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Booking earnings</h3>
        <div className="mt-4">
          {(data?.recent || []).length === 0 ? (
            <EmptyState icon={IndianRupee} title="No earnings yet" description="Payments you receive for bookings will be listed here with the platform fee and your net amount." />
          ) : (
            <TableShell headers={['Date', 'Company', 'Amount', 'Fee', 'Net', 'Method', 'Status']}>
              {data.recent.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium text-brand-navy">{p.company?.name || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-brand-navy">{formatPaise(p.amount_paise)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums text-brand-textSec">−{formatPaise(p.fee_paise)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold tabular-nums text-green-700">{formatPaise(p.net_paise)}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-brand-textSec">{METHOD_LABEL[p.method]}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </TableShell>
          )}
        </div>
      </section>

      {/* Withdrawal history */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Withdrawals</h3>
        {!AUTOMATIC_PAYOUTS_ENABLED && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-brand-textSec">
            Requests are settled manually right now, so a withdrawal stays on{' '}
            <span className="font-semibold text-brand-navy">Processing</span> until our team has
            transferred the money. That status is real - it is not a display placeholder.
          </p>
        )}
        <div className="mt-4">
          {withdrawals.length === 0 ? (
            <EmptyState icon={ArrowDownToLine} title="No withdrawal requests" description="Once you have an available balance and a payout account, you can withdraw here." />
          ) : (
            <TableShell headers={['Date', 'Amount', 'To', 'Status', 'Reference']}>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-textSec">
                    {new Date(w.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold tabular-nums text-brand-navy">{formatPaise(w.amount_paise)}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-brand-textSec">{w.masked_destination}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={w.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-brand-textSec">{w.reference}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </div>
      </section>
    </div>
  );
}
