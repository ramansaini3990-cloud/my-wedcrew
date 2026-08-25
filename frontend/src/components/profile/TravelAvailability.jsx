import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, MapPin, CalendarRange, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import api from '../../utils/api';
import useMasterData from '../../hooks/useMasterData';
import { selectClass, inputClass } from './formStyles';
import Field from './FormField';

const STATUS_META = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700 border-green-200' },
  booked: { label: 'Booked', className: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30' },
  busy: { label: 'Busy', className: 'bg-red-100 text-red-700 border-red-200' },
  traveling: { label: 'Traveling', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  unavailable: { label: 'Unavailable', className: 'bg-brand-bg text-brand-textSec border-brand-border' }
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * "Travel & Availability" - date-ranged, location-aware availability.
 *
 * Complements the existing day-calendar; it does not replace it. Overlaps are
 * rejected by the backend and the conflicting entries are surfaced here.
 */
export default function TravelAvailability({ baseLocation = null }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const emptyForm = {
    start_date: todayISO(),
    end_date: todayISO(),
    status: 'available',
    state_id: '',
    city_id: '',
    notes: ''
  };
  const [form, setForm] = useState(emptyForm);
  const master = useMasterData();

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/api/availability/blocks');
      setBlocks(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load availability blocks', err);
      setLoadError('Unable to load your travel schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const handleStateChange = async (stateId) => {
    setForm((f) => ({ ...f, state_id: stateId, city_id: '' }));
    await master.loadCities(stateId);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setConflicts([]);

    try {
      const res = await api.post('/api/availability/blocks', {
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        state_id: form.state_id || null,
        city_id: form.city_id || null,
        notes: form.notes
      });
      setFeedback({ type: 'success', message: res.data?.message || 'Availability saved successfully.' });
      setForm(emptyForm);
      setShowForm(false);
      await fetchBlocks();
    } catch (err) {
      const data = err.response?.data;
      setConflicts(data?.conflicts || []);
      setFeedback({ type: 'error', message: data?.message || 'Could not save this availability block.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (block) => {
    const where = block.city_id?.name || block.city || 'this location';
    if (!window.confirm(`Remove availability for ${where} (${formatDate(block.start_date)} – ${formatDate(block.end_date)})?`)) return;

    setDeletingId(block.id || block._id);
    setFeedback(null);
    try {
      await api.delete(`/api/availability/blocks/${block.id || block._id}`);
      setFeedback({ type: 'success', message: 'Availability removed.' });
      await fetchBlocks();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Could not remove that entry.' });
    } finally {
      setDeletingId(null);
    }
  };

  // Derived from the same blocks - never a second availability system.
  const today = new Date().setHours(0, 0, 0, 0);
  const currentBlock = blocks.find(
    (b) =>
      new Date(b.start_date).setHours(0, 0, 0, 0) <= today &&
      new Date(b.end_date).setHours(0, 0, 0, 0) >= today
  );
  const currentMeta = currentBlock ? STATUS_META[currentBlock.status] : null;
  const currentCity = currentBlock?.city_id?.name || currentBlock?.city;
  const currentState = currentBlock?.state_id?.name || currentBlock?.state;

  return (
    <div className="space-y-4">
      {/* Current location - from today's published block, or the base location */}
      {!loading && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-2">
            Current location
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-navy">
              <MapPin size={14} className="text-brand-primary shrink-0" aria-hidden="true" />
              {[currentCity || baseLocation?.city, currentState || baseLocation?.state]
                .filter(Boolean)
                .join(', ') || 'Location not set'}
            </span>
            {currentMeta && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${currentMeta.className}`}>
                {currentMeta.label}
              </span>
            )}
          </div>
          {!currentBlock && (
            <p className="mt-1.5 text-[12px] text-brand-textSec">
              {baseLocation?.city
                ? 'Showing your base location. Add availability below to publish your status.'
                : 'Set your base location in Profile Settings, or add availability below.'}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-brand-navy">Travel &amp; Availability</h3>
          <p className="text-[13px] text-brand-textSec mt-0.5">
            Tell companies where you will be and when, so they can find you in their city.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setFeedback(null); setConflicts([]); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add Location & Availability'}
        </button>
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
          <div>
            <p>{feedback.message}</p>
            {conflicts.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[12px]">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    • {STATUS_META[c.status]?.label || c.status}
                    {c.city ? ` in ${c.city}` : ''} · {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-brand-surface rounded-xl border border-brand-border p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Start date" required>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <Field label="End date" required>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={selectClass}
              >
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="State">
              <select
                value={form.state_id}
                onChange={(e) => handleStateChange(e.target.value)}
                className={selectClass}
                disabled={master.loadingLists}
              >
                <option value="">{master.loadingLists ? 'Loading...' : 'Select state'}</option>
                {master.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="City">
              <select
                value={form.city_id}
                onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                className={selectClass}
                disabled={!form.state_id || master.loadingCities}
              >
                <option value="">
                  {!form.state_id ? 'Select a state first' : master.loadingCities ? 'Loading cities...' : 'Select city'}
                </option>
                {master.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notes" hint="Optional, visible only to you.">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={500}
              placeholder="e.g. Destination wedding, arriving a day early"
              className={inputClass}
            />
          </Field>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
        {loading && (
          <div className="p-6 space-y-3 animate-pulse">
            {[0, 1].map((i) => <div key={i} className="h-12 bg-brand-bg rounded" />)}
          </div>
        )}

        {!loading && loadError && (
          <div className="p-8 text-center">
            <AlertCircle size={20} className="mx-auto text-brand-danger mb-2" />
            <p className="text-[13px] text-brand-navy font-semibold">{loadError}</p>
            <button onClick={fetchBlocks} className="mt-3 text-[13px] font-semibold text-brand-primary hover:underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && blocks.length === 0 && (
          <div className="p-10 text-center">
            <CalendarRange size={22} className="mx-auto text-brand-textSec/50 mb-2.5" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-brand-navy">No travel or availability added yet</p>
            <p className="text-[13px] text-brand-textSec mt-1 max-w-sm mx-auto">
              Add where you will be and when, so companies searching that city can find you.
            </p>
          </div>
        )}

        {!loading && !loadError && blocks.length > 0 && (
          <ul className="divide-y divide-brand-border">
            {blocks.map((block) => {
              const meta = STATUS_META[block.status] || STATUS_META.unavailable;
              const city = block.city_id?.name || block.city;
              const state = block.state_id?.name || block.state;
              const id = block.id || block._id;

              return (
                <li key={id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-brand-primary/5 transition-colors">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-brand-navy">
                        {city ? `${city}${state ? `, ${state}` : ''}` : 'Location not set'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-brand-textSec">
                      <CalendarRange size={12} className="shrink-0" aria-hidden="true" />
                      {formatDate(block.start_date)} – {formatDate(block.end_date)}
                    </p>
                    {block.notes && <p className="mt-1 text-[12px] text-brand-textSec italic">{block.notes}</p>}
                    {block.manual_location?.address && (
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-brand-textSec">
                        <MapPin size={12} className="shrink-0" aria-hidden="true" /> {block.manual_location.address}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(block)}
                    disabled={deletingId === id}
                    aria-label="Remove availability"
                    className="shrink-0 p-2 rounded-lg text-brand-textSec hover:text-brand-danger hover:bg-red-50 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    {deletingId === id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
