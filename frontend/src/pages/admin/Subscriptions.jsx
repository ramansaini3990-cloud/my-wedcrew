import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, X, Settings2 } from 'lucide-react';
import api from '../../utils/api';

const STATUS_BADGES = {
  active: 'bg-green-100 text-green-700 border-green-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  none: 'bg-brand-bg text-brand-textSec border-brand-border'
};

const todayISO = () => new Date().toISOString().split('T')[0];
const isoPlusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

/* ------------------------------------------------------------------ */

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 backdrop-blur-sm p-4">
    <div className="bg-brand-surface border border-brand-border rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center px-4 py-3 border-b border-brand-border sticky top-0 bg-brand-surface">
        <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
        <button onClick={onClose} className="text-brand-textSec hover:text-brand-primary transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold uppercase tracking-wider text-brand-textSec mb-1.5">{label}</label>
    {children}
  </div>
);

const inputClass =
  'w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 text-sm text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 transition-shadow';

/* ------------------------------------------------------------------ */

const Subscriptions = () => {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // modal: { type: 'assign' | 'plan' | 'extend' | 'plans', row }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/plans');
      setPlans(res.data || []);
    } catch (error) {
      console.error('Failed to load plans', error);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`/api/admin/subscriptions/overview?${params.toString()}`);
      setRows(res.data?.data || []);
    } catch (error) {
      console.error('Failed to load subscription overview', error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 300); // debounce search typing
    return () => clearTimeout(timer);
  }, [fetchRows]);

  /* ---------------------------------------------------------------- */

  const runAction = async (row, request, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      setBusyUserId(row.user_id);
      await request();
      await fetchRows();
    } catch (error) {
      alert(errorMessage(error, 'Action failed'));
    } finally {
      setBusyUserId(null);
    }
  };

  const setStatus = (row, status) => {
    const id = row.subscription.subscription_id;
    if (!id) return alert('Assign a plan to this user first.');
    const labels = { active: 'activate', paused: 'pause (deactivate)', cancelled: 'cancel', expired: 'expire' };
    runAction(
      row,
      () => api.put(`/api/admin/subscriptions/${id}/status`, { status }),
      `Are you sure you want to ${labels[status]} the subscription for ${row.name}?`
    );
  };

  const quickExtend = (row, days) => {
    const id = row.subscription.subscription_id;
    if (!id) return alert('Assign a plan to this user first.');
    runAction(row, () => api.put(`/api/admin/subscriptions/${id}/extend`, { days }));
  };

  const openModal = (type, row) => {
    if (type === 'assign') {
      setForm({
        planId: plans[0]?.id || plans[0]?._id || '',
        start_date: todayISO(),
        end_date: isoPlusDays(30),
        amount: ''
      });
    } else if (type === 'plan') {
      setForm({ planId: row.subscription.plan_id || plans[0]?.id || '' });
    } else if (type === 'extend') {
      setForm({ mode: 'days', days: 30, end_date: row.subscription.end_date?.slice(0, 10) || isoPlusDays(30) });
    }
    setModal({ type, row });
  };

  const submitModal = async (e) => {
    e.preventDefault();
    const { type, row } = modal;
    const subId = row?.subscription?.subscription_id;

    try {
      setSaving(true);
      if (type === 'assign') {
        await api.post('/api/admin/subscriptions', { user_id: row.user_id, ...form });
      } else if (type === 'plan') {
        await api.put(`/api/admin/subscriptions/${subId}/plan`, { planId: form.planId });
      } else if (type === 'extend') {
        const body = form.mode === 'days' ? { days: Number(form.days) } : { end_date: form.end_date };
        await api.put(`/api/admin/subscriptions/${subId}/extend`, body);
      }
      setModal(null);
      await fetchRows();
    } catch (error) {
      alert(errorMessage(error, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const seedPlans = async () => {
    try {
      const res = await api.post('/api/admin/plans/seed-defaults');
      await fetchPlans();
      alert(
        `Plans ready.\nCreated: ${res.data.created.join(', ') || 'none'}\nAlready present: ${
          res.data.skipped.join(', ') || 'none'
        }`
      );
    } catch (error) {
      alert(errorMessage(error, 'Failed to seed plans'));
    }
  };

  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Subscriptions</h2>
          <p className="text-[13px] text-brand-textSec mt-0.5">
            Manually assign, activate, extend or cancel plans. No payment gateway required.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setModal({ type: 'plans' })}
            className="inline-flex items-center gap-2 px-4 py-2 border border-brand-border rounded-lg text-sm font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
          >
            <Settings2 size={16} /> Manage Plans
          </button>
          <button
            onClick={fetchRows}
            className="inline-flex items-center gap-2 px-4 py-2 border border-brand-border rounded-lg text-sm font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`${inputClass} sm:w-48`}>
          <option value="">All roles</option>
          <option value="company">Companies</option>
          <option value="freelancer">Freelancers</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-48`}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="paused">Paused</option>
          <option value="none">No subscription</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-brand-surface rounded-xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-brand-bg text-brand-navy text-xs uppercase tracking-wider border-b border-brand-border">
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Plan</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Start Date</th>
                <th className="p-4 font-semibold">Expiry Date</th>
                <th className="p-4 font-semibold">Chat</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto"></div>
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-brand-textSec font-medium">
                    No users match these filters.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => {
                  const sub = row.subscription;
                  const status = sub.status || 'none';
                  const hasSub = sub.has_subscription;
                  const busy = busyUserId === row.user_id;

                  return (
                    <tr
                      key={row.user_id}
                      className={`border-b border-brand-border last:border-0 hover:bg-brand-primary/5 transition-colors ${
                        busy ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-medium text-brand-navy">{row.name}</div>
                        <div className="text-xs text-brand-textSec">{row.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-brand-bg border border-brand-border text-brand-textSec rounded-md text-[10px] font-bold uppercase tracking-wider">
                          {row.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={hasSub ? 'font-semibold text-brand-primary' : 'text-brand-textSec'}>
                          {hasSub ? sub.plan_name : '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 inline-flex rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                            STATUS_BADGES[status] || STATUS_BADGES.none
                          }`}
                        >
                          {hasSub ? status : 'none'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-brand-textSec">{formatDate(sub.start_date)}</td>
                      <td className="p-4 text-sm text-brand-textSec">
                        {formatDate(sub.end_date)}
                        {sub.is_active && sub.days_remaining !== null && (
                          <div className="text-[10px] text-brand-textSec">{sub.days_remaining} days left</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            sub.chat_enabled
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-brand-bg text-brand-textSec border-brand-border'
                          }`}
                        >
                          {sub.chat_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <button
                            onClick={() => openModal('assign', row)}
                            disabled={busy}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10 transition-colors disabled:opacity-40"
                          >
                            {hasSub ? 'Reassign' : 'Assign Plan'}
                          </button>

                          {hasSub && (
                            <>
                              <button
                                onClick={() => openModal('plan', row)}
                                disabled={busy}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-brand-border text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 transition-colors disabled:opacity-40"
                              >
                                Change Plan
                              </button>
                              <button
                                onClick={() => openModal('extend', row)}
                                disabled={busy}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-brand-border text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 transition-colors disabled:opacity-40"
                              >
                                Extend
                              </button>

                              {status === 'active' ? (
                                <button
                                  onClick={() => setStatus(row, 'paused')}
                                  disabled={busy}
                                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-yellow-200 text-yellow-700 hover:bg-yellow-50 transition-colors disabled:opacity-40"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => setStatus(row, 'active')}
                                  disabled={busy}
                                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40"
                                >
                                  Activate
                                </button>
                              )}

                              {status !== 'cancelled' && (
                                <button
                                  onClick={() => setStatus(row, 'cancelled')}
                                  disabled={busy}
                                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {hasSub && (
                          <div className="flex gap-1.5 justify-end mt-1.5">
                            <button
                              onClick={() => quickExtend(row, 30)}
                              disabled={busy}
                              className="text-[10px] text-brand-textSec hover:text-brand-primary transition-colors disabled:opacity-40"
                            >
                              +30d
                            </button>
                            <span className="text-[10px] text-brand-border">|</span>
                            <button
                              onClick={() => quickExtend(row, 365)}
                              disabled={busy}
                              className="text-[10px] text-brand-textSec hover:text-brand-primary transition-colors disabled:opacity-40"
                            >
                              +1y
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-brand-textSec">
        Chat unlocks only when <span className="font-medium text-brand-navy">both</span> participants have an active
        subscription on a plan that includes the <code className="text-brand-primary">chat</code> feature.
      </p>

      {/* ---------------- Modals ---------------- */}

      {modal?.type === 'assign' && (
        <Modal title={`Assign plan to ${modal.row.name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitModal} className="space-y-4">
            <Field label="Plan">
              <select
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
                className={inputClass}
                required
              >
                {plans.map((p) => (
                  <option key={p.id || p._id} value={p.id || p._id}>
                    {p.name} — ₹{p.price} ({p.features.includes('chat') ? 'chat enabled' : 'no chat'})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Expiry Date">
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
            </div>
            <Field label="Amount (optional — defaults to plan price)">
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Leave blank to use plan price"
                className={inputClass}
              />
            </Field>
            <p className="text-xs text-brand-textSec">
              Any previous subscription for this user is superseded, so exactly one plan stays in effect.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Assign Subscription'}
            </button>
          </form>
        </Modal>
      )}

      {modal?.type === 'plan' && (
        <Modal title={`Change plan for ${modal.row.name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitModal} className="space-y-4">
            <Field label="New Plan">
              <select
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
                className={inputClass}
                required
              >
                {plans.map((p) => (
                  <option key={p.id || p._id} value={p.id || p._id}>
                    {p.name} — ₹{p.price} ({p.features.includes('chat') ? 'chat enabled' : 'no chat'})
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-brand-textSec">
              Dates stay unchanged. Feature access follows the new plan immediately.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Change Plan'}
            </button>
          </form>
        </Modal>
      )}

      {modal?.type === 'extend' && (
        <Modal title={`Extend subscription for ${modal.row.name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitModal} className="space-y-4">
            <Field label="Method">
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
                className={inputClass}
              >
                <option value="days">Add days</option>
                <option value="date">Set a specific expiry date</option>
              </select>
            </Field>

            {form.mode === 'days' ? (
              <Field label="Days to add">
                <input
                  type="number"
                  min="1"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
            ) : (
              <Field label="New expiry date">
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
            )}
            <p className="text-xs text-brand-textSec">
              Extending past today reactivates an expired or paused subscription.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Extend Subscription'}
            </button>
          </form>
        </Modal>
      )}

      {modal?.type === 'plans' && (
        <Modal title="Plans" onClose={() => setModal(null)}>
          <div className="space-y-3">
            {plans.length === 0 && <p className="text-sm text-brand-textSec">No plans yet.</p>}
            {plans.map((p) => (
              <div key={p.id || p._id} className="border border-brand-border rounded-lg p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold text-brand-navy">{p.name}</p>
                    <p className="text-xs text-brand-textSec mt-0.5">{p.description}</p>
                  </div>
                  <span className="font-semibold text-brand-primary whitespace-nowrap">
                    ₹{p.price}
                    <span className="text-xs text-brand-textSec">/{p.billing_period}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.features.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-[10px] font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={seedPlans}
              className="w-full py-3 border border-brand-primary/40 text-brand-primary font-bold rounded-lg hover:bg-brand-primary/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Create missing default plans (FREE / PRO / PREMIUM)
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Subscriptions;
