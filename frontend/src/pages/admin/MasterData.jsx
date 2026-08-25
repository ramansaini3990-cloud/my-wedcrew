import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, X, Loader2, AlertCircle, CheckCircle2, Power, Trash2, Pencil } from 'lucide-react';
import api from '../../utils/api';

/**
 * Admin -> Master Data: professions, states and cities.
 *
 * Integrity rules enforced by the backend and surfaced here:
 *   - a record in use cannot be hard-deleted, only deactivated
 *   - deactivating never alters the profiles already using it
 *   - a city always belongs to a state
 */

const TABS = [
  { id: 'professions', label: 'Professions', singular: 'Profession' },
  { id: 'states', label: 'States', singular: 'State' },
  { id: 'cities', label: 'Cities', singular: 'City' }
];

const inputClass =
  'w-full bg-brand-surface border border-brand-border rounded-lg px-3 h-9 text-[13px] text-brand-navy placeholder-brand-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 transition-shadow';

const errorMessage = (err, fallback) => err.response?.data?.message || fallback;

export default function MasterData() {
  const [tab, setTab] = useState('professions');
  const [rows, setRows] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', row }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const current = TABS.find((t) => t.id === tab);

  /* ---------------------------------------------------------------- */

  const fetchStates = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/master/states');
      setStates(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load states', err);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tab === 'cities' && stateFilter) params.set('state_id', stateFilter);

      const res = await api.get(`/api/admin/master/${tab}?${params.toString()}`);
      setRows(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load master data', err);
      setLoadError(errorMessage(err, 'Unable to load records.'));
    } finally {
      setLoading(false);
    }
  }, [tab, search, statusFilter, stateFilter]);

  useEffect(() => { fetchStates(); }, [fetchStates]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 250); // debounce typing
    return () => clearTimeout(timer);
  }, [fetchRows]);

  /* ---------------------------------------------------------------- */

  const openModal = (mode, row = null) => {
    setFeedback(null);
    if (mode === 'create') {
      setForm(
        tab === 'cities'
          ? { name: '', state_id: stateFilter || states[0]?.id || '', sort_order: 0 }
          : { name: '', code: '', description: '', sort_order: 0 }
      );
    } else {
      setForm({
        name: row.name || '',
        code: row.code || '',
        description: row.description || '',
        state_id: row.state_id?._id || row.state_id || '',
        sort_order: row.sort_order || 0
      });
    }
    setModal({ mode, row });
  };

  const submitModal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = { name: form.name, sort_order: Number(form.sort_order) || 0 };
      if (tab === 'professions') payload.description = form.description;
      if (tab === 'states') payload.code = form.code;
      if (tab === 'cities') payload.state_id = form.state_id;

      if (modal.mode === 'create') {
        await api.post(`/api/admin/master/${tab}`, payload);
        setFeedback({ type: 'success', message: `${current.singular} created.` });
      } else {
        await api.put(`/api/admin/master/${tab}/${modal.row.id}`, payload);
        setFeedback({ type: 'success', message: `${current.singular} updated.` });
      }
      setModal(null);
      await fetchRows();
      if (tab === 'states') await fetchStates();
    } catch (err) {
      setFeedback({ type: 'error', message: errorMessage(err, 'Could not save.') });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    const nextActive = !row.is_active;
    const inUse = row.usage?.total > 0;

    if (!nextActive && inUse) {
      const ok = window.confirm(
        `"${row.name}" is used by ${row.usage.users} profile(s).\n\n` +
        'Deactivating hides it from NEW selections. Existing profiles keep their current value and are not changed.\n\nContinue?'
      );
      if (!ok) return;
    }

    setBusyId(row.id);
    setFeedback(null);
    try {
      const res = await api.patch(`/api/admin/master/${tab}/${row.id}/status`, { is_active: nextActive });
      setFeedback({ type: 'success', message: res.data?.message || 'Status updated.' });
      await fetchRows();
      if (tab === 'states') await fetchStates();
    } catch (err) {
      setFeedback({ type: 'error', message: errorMessage(err, 'Could not change status.') });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    if (row.usage?.total > 0) {
      setFeedback({
        type: 'error',
        message: `"${row.name}" is in use and cannot be deleted. Deactivate it instead.`
      });
      return;
    }
    if (!window.confirm(`Permanently delete "${row.name}"? This cannot be undone.`)) return;

    setBusyId(row.id);
    setFeedback(null);
    try {
      const res = await api.delete(`/api/admin/master/${tab}/${row.id}`);
      setFeedback({ type: 'success', message: res.data?.message || 'Deleted.' });
      await fetchRows();
      if (tab === 'states') await fetchStates();
    } catch (err) {
      setFeedback({ type: 'error', message: errorMessage(err, 'Could not delete.') });
    } finally {
      setBusyId(null);
    }
  };

  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Master Data</h2>
          <p className="text-[13px] text-brand-textSec mt-0.5">
            Professions and locations used across profiles, requirements and search.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={fetchRows}
            className="inline-flex items-center gap-2 px-3 h-9 border border-brand-border rounded-lg text-[13px] font-medium text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => openModal('create')}
            className="inline-flex items-center gap-2 px-3.5 h-9 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
          >
            <Plus size={15} /> Add {current.singular}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex p-1 rounded-lg bg-brand-bg border border-brand-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setSearch(''); setStatusFilter(''); setStateFilter(''); setFeedback(null); }}
            className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
              tab === t.id ? 'bg-brand-primary text-white' : 'text-brand-navy hover:text-brand-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-[13px] ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-brand-danger'
          }`}
          role="status"
        >
          {feedback.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-primary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${current.label.toLowerCase()}...`}
            className={`${inputClass} pl-8`}
          />
        </div>
        {tab === 'cities' && (
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={`${inputClass} sm:w-56`}>
            <option value="">All states</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-40`}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-brand-surface rounded-xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-brand-bg text-brand-navy text-xs uppercase tracking-wider border-b border-brand-border">
                <th className="p-3.5 font-semibold">Name</th>
                {tab === 'cities' && <th className="p-3.5 font-semibold">State</th>}
                {tab === 'states' && <th className="p-3.5 font-semibold">Code</th>}
                {tab === 'professions' && <th className="p-3.5 font-semibold">Description</th>}
                <th className="p-3.5 font-semibold">Usage</th>
                <th className="p-3.5 font-semibold">Status</th>
                <th className="p-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" className="p-12 text-center">
                  <Loader2 size={20} className="mx-auto animate-spin text-brand-primary" />
                </td></tr>
              )}

              {!loading && loadError && (
                <tr><td colSpan="6" className="p-12 text-center">
                  <AlertCircle size={20} className="mx-auto text-brand-danger mb-2" />
                  <p className="text-[13px] font-semibold text-brand-navy">{loadError}</p>
                </td></tr>
              )}

              {!loading && !loadError && rows.length === 0 && (
                <tr><td colSpan="6" className="p-12 text-center text-brand-textSec text-[13px]">
                  No {current.label.toLowerCase()} match these filters.
                </td></tr>
              )}

              {!loading && !loadError && rows.map((row) => {
                const inUse = row.usage?.total > 0;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-brand-border last:border-0 hover:bg-brand-primary/5 transition-colors ${busyId === row.id ? 'opacity-50' : ''}`}
                  >
                    <td className="p-3.5">
                      <span className="font-medium text-brand-navy text-[13px]">{row.name}</span>
                    </td>

                    {tab === 'cities' && (
                      <td className="p-3.5 text-[13px] text-brand-textSec">{row.state_id?.name || '—'}</td>
                    )}
                    {tab === 'states' && (
                      <td className="p-3.5 text-[13px] text-brand-textSec">{row.code || '—'}</td>
                    )}
                    {tab === 'professions' && (
                      <td className="p-3.5 text-[12px] text-brand-textSec max-w-xs truncate">{row.description || '—'}</td>
                    )}

                    <td className="p-3.5 text-[12px] text-brand-textSec">
                      {inUse ? (
                        <span className="text-brand-navy font-medium">
                          {row.usage.users} profile{row.usage.users === 1 ? '' : 's'}
                          {row.usage.requirements > 0 && `, ${row.usage.requirements} req.`}
                          {tab === 'states' && row.usage.cities > 0 && `, ${row.usage.cities} cities`}
                        </span>
                      ) : tab === 'states' && row.usage?.cities > 0 ? (
                        <span>{row.usage.cities} cities</span>
                      ) : (
                        <span className="text-brand-muted">Not used</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 inline-flex rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        row.is_active
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-brand-bg text-brand-textSec border-brand-border'
                      }`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() => openModal('edit', row)}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-brand-border text-brand-navy hover:text-brand-primary hover:border-brand-primary/40 transition-colors disabled:opacity-40"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(row)}
                          disabled={busyId === row.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-40 ${
                            row.is_active
                              ? 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <Power size={12} /> {row.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => remove(row)}
                          disabled={busyId === row.id || inUse}
                          title={inUse ? 'In use — deactivate instead' : 'Delete permanently'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-brand-textSec">
        Records in use cannot be deleted. Deactivating hides them from new selections while existing profiles keep their values.
      </p>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 backdrop-blur-sm p-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-brand-border">
              <h3 className="text-base font-semibold text-brand-navy">
                {modal.mode === 'create' ? `Add ${current.singular}` : `Edit ${current.singular}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-brand-textSec hover:text-brand-primary transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitModal} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">
                  Name <span className="text-brand-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  required
                  autoFocus
                />
              </div>

              {tab === 'cities' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">
                    State <span className="text-brand-primary">*</span>
                  </label>
                  <select
                    value={form.state_id}
                    onChange={(e) => setForm({ ...form, state_id: e.target.value })}
                    className={inputClass}
                    required
                  >
                    <option value="">Select state</option>
                    {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {tab === 'states' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. RJ"
                    className={inputClass}
                  />
                </div>
              )}

              {tab === 'professions' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">Sort order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving...' : modal.mode === 'create' ? `Create ${current.singular}` : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
