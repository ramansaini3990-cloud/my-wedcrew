import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarDays, Loader2, AlertCircle, Trash2, X, Check,
  Eye, EyeOff, MapPin, List, Plus
} from 'lucide-react';
import api from '../../utils/api';
import useMasterData from '../../hooks/useMasterData';
import { describeApiError } from '../../utils/apiError';
import AvailabilityCalendar from './AvailabilityCalendar';
import { STATUS_META, toISODate, blockDateToISO, groupIntoRuns, eachISODay } from './availabilityConstants';

/**
 * The freelancer Availability tab.
 *
 * Manages AvailabilityBlock records - the date-ranged, location-aware model
 * that public date-filtered search actually consults. The previous version of
 * this tab wrote single-day `Availability` rows instead, which only ever fed a
 * display string on the public profile and had no effect on who appears in a
 * search. See the session report for that distinction.
 *
 * Nothing here changes what availability MEANS. Overlap rules, the status enum
 * and the bookable rule all come from the existing API; this file only decides
 * how a person edits them.
 *
 * SINGLE OWNER. Settings used to carry a second panel ("Travel & Availability")
 * writing the same AvailabilityBlock rows through the same endpoint, with
 * neither surface aware of the other - editing in one silently changed the
 * other. That panel is gone and Settings now links here. Its one unique
 * readout, "where am I today", was ported below.
 */

const inputClass =
  'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25';

const prettyDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });

const dayCount = (startISO, endISO) =>
  Math.round((new Date(`${endISO}T00:00:00Z`) - new Date(`${startISO}T00:00:00Z`)) / 86400000) + 1;

const emptyForm = { status: 'available', state_id: '', city_id: '', notes: '' };

export default function AvailabilityManager({ baseLocation = null }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // The days the user has picked, as YYYY-MM-DD. Owned here rather than in the
  // calendar so it survives month navigation and can be published in one go.
  const [selectedDays, setSelectedDays] = useState(() => new Set());
  const [editing, setEditing] = useState(null);       // an existing block
  const [editRange, setEditRange] = useState(null);   // { start, end } while editing
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [notice, setNotice] = useState('');
  const [showList, setShowList] = useState(false);
  const [jumpTo, setJumpTo] = useState(null);   // { iso, seq } - moves the grid
  const jumpSeq = useRef(0);

  const master = useMasterData(form.state_id || null);

  /* ---------------- data ---------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/api/availability/blocks', { timeout: 15_000 });
      setBlocks(res.data?.data || []);
    } catch (err) {
      setBlocks([]);
      setLoadError(describeApiError(err, 'Could not load your availability.'));
    } finally {
      // Always clears - this panel can never be left spinning.
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------------- the 30-day summary ---------------- */

  /**
   * What the calendar is actually doing for the user.
   *
   * Public date search is EXCLUSION-based: a professional appears on a given
   * date unless a non-bookable block covers it. An empty calendar therefore
   * means fully visible, not invisible - so this says which of the next 30 days
   * are blocked rather than claiming credit for days that were never blocked.
   */
  const summary = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      days.push(toISODate(d));
    }

    const covered = new Map();
    for (const b of blocks) {
      const start = blockDateToISO(b.start_date);
      const end = blockDateToISO(b.end_date);
      for (const iso of days) if (iso >= start && iso <= end) covered.set(iso, b.status);
    }

    let hidden = 0, publishedAvailable = 0;
    for (const iso of days) {
      const status = covered.get(iso);
      if (!status) continue;
      if (STATUS_META[status]?.bookable) publishedAvailable += 1;
      else hidden += 1;
    }

    return { total: 30, hidden, publishedAvailable, open: 30 - hidden };
  }, [blocks]);

  /**
   * Where you are today.
   *
   * Ported from the old Settings "Travel & Availability" panel, which was the
   * only surface that answered this. It is derived from the same blocks the
   * calendar draws - never a second availability system - and falls back to the
   * profile base location when no block covers today, because "no block" means
   * you are at home and bookable, not that your location is unknown.
   */
  const today = useMemo(() => {
    const iso = toISODate(new Date());
    const block = blocks.find(
      (b) => blockDateToISO(b.start_date) <= iso && blockDateToISO(b.end_date) >= iso
    );
    const city = block?.city_id?.name || block?.city || baseLocation?.city;
    const state = block?.state_id?.name || block?.state || baseLocation?.state;
    return {
      block,
      fromBase: !block,
      where: [city, state].filter(Boolean).join(', ')
    };
  }, [blocks, baseLocation]);

  /* ---------------- picking days ---------------- */

  const minDate = useMemo(() => toISODate(new Date()), []);

  const resetFeedback = () => { setFormError(''); setConflicts([]); };

  /** One tap, one day. Picking a loose day is always a create, never an edit. */
  const toggleDay = (iso) => {
    if (iso < minDate) return;
    setEditing(null);
    setEditRange(null);
    resetFeedback();
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const clearAll = () => {
    setSelectedDays(new Set());
    setEditing(null);
    setEditRange(null);
    setForm(emptyForm);
    resetFeedback();
  };

  /**
   * The from/to inputs ADD every day in the span to the selection rather than
   * replacing it. Thirty taps for a month is not a real option, and adding
   * means the user can then untick the two days in the middle they are free.
   *
   * `min` on the input handles the picker; this handles a typed or pasted past
   * date, which `min` does not block.
   */
  const [spanFrom, setSpanFrom] = useState('');
  const [spanTo, setSpanTo] = useState('');

  const addSpan = () => {
    if (!spanFrom || !spanTo) return;
    if (spanFrom < minDate || spanTo < minDate) {
      setFormError('Availability cannot start in the past.');
      return;
    }
    const [a, b] = [spanFrom, spanTo].sort();
    setEditing(null);
    setEditRange(null);
    resetFeedback();
    setSelectedDays((prev) => {
      const next = new Set(prev);
      for (const d of eachISODay(a, b)) if (d >= minDate) next.add(d);
      return next;
    });
    jumpSeq.current += 1;
    setJumpTo({ iso: a, seq: jumpSeq.current });
  };

  /* ---------------- form ---------------- */

  const openEdit = (block) => {
    setEditing(block);
    setEditRange({ start: blockDateToISO(block.start_date), end: blockDateToISO(block.end_date) });
    setForm({
      status: block.status || 'available',
      state_id: block.state_id?._id || block.state_id || '',
      city_id: block.city_id?._id || block.city_id || '',
      notes: block.notes || ''
    });
    resetFeedback();
    if (block.state_id) master.loadCities(block.state_id?._id || block.state_id);
  };

  const closeForm = () => {
    setEditing(null);
    setEditRange(null);
    setSelectedDays(new Set());
    setForm(emptyForm);
    resetFeedback();
  };

  /* ---------------- what will be written ---------------- */

  /**
   * AvailabilityBlock stores one continuous span per row, so scattered days are
   * grouped into the fewest runs that cover them: 5, 8, 14, 15, 22 becomes four
   * blocks, with 14-15 kept together. The user never sees this - they picked
   * days and those days are set - but it keeps the list readable and leaves
   * blocks indistinguishable from ones made before the calendar toggled days.
   */
  const runs = useMemo(() => groupIntoRuns([...selectedDays]), [selectedDays]);

  /**
   * Days already covered by a block. Tapping such a day opens it for editing
   * instead of selecting it, so this can only be reached through the span
   * inputs - which is exactly why the check exists.
   *
   * This is a pre-flight for the user's benefit, not a second copy of the rule:
   * the server's overlap check stays authoritative and still runs on every write.
   */
  const clashingDays = useMemo(() => {
    if (!selectedDays.size) return [];
    const covered = new Set();
    for (const b of blocks) {
      for (const d of eachISODay(blockDateToISO(b.start_date), blockDateToISO(b.end_date))) covered.add(d);
    }
    return [...selectedDays].filter((d) => covered.has(d)).sort();
  }, [blocks, selectedDays]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    resetFeedback();

    const shared = {
      status: form.status,
      state_id: form.state_id || null,
      city_id: form.city_id || null,
      notes: form.notes
    };

    try {
      if (editing) {
        await api.put(
          `/api/availability/blocks/${editing.id || editing._id}`,
          { start_date: editRange.start, end_date: editRange.end, ...shared },
          { timeout: 15_000 }
        );
        setNotice('Availability updated.');
        closeForm();
        await load();
        return;
      }

      if (!runs.length) return;

      /**
       * ALL OR NOTHING. One tap-and-publish can become several rows, and there
       * is no transaction spanning them, so a half-written selection would
       * leave the user unable to say what is set. Clashes are caught before
       * anything is written and the whole submission is refused with the days
       * named, leaving the selection intact to fix.
       */
      if (clashingDays.length) {
        setFormError(
          `${clashingDays.length} of the days you picked already have availability: ` +
          `${clashingDays.map((d) => prettyDate(d)).join(', ')}. ` +
          'Remove those days, or edit the existing block, then publish again.'
        );
        return;
      }

      let saved = 0;
      for (const run of runs) {
        try {
          await api.post(
            '/api/availability/blocks',
            { start_date: run.start, end_date: run.end, ...shared },
            { timeout: 15_000 }
          );
          saved += 1;
        } catch (err) {
          // Only reachable if something changed underneath us between the
          // pre-flight and the write - another tab, or another device.
          const data = err.response?.data || {};
          if (data.code === 'AVAILABILITY_OVERLAP') setConflicts(data.conflicts || []);
          setFormError(
            saved === 0
              ? describeApiError(err, 'Could not save this availability.')
              : `Saved ${saved} of ${runs.length} stretches and then stopped — ` +
                `${describeApiError(err, 'a later one clashed.')} Nothing after that point was written.`
          );
          await load();
          return;
        }
      }

      setNotice(
        `${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'} published` +
        `${runs.length > 1 ? ` across ${runs.length} entries` : ''}.`
      );
      closeForm();
      await load();
    } catch (err) {
      const data = err.response?.data || {};
      if (data.code === 'AVAILABILITY_OVERLAP') setConflicts(data.conflicts || []);
      setFormError(describeApiError(err, 'Could not save this availability.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (block) => {
    const id = block.id || block._id;
    if (!window.confirm('Remove this availability block?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/availability/blocks/${id}`, { timeout: 15_000 });
      setNotice('Availability removed.');
      closeForm();
      await load();
    } catch (err) {
      setFormError(describeApiError(err, 'Could not remove this block.'));
    } finally {
      setSaving(false);
    }
  };

  const handleState = async (stateId) => {
    setForm((f) => ({ ...f, state_id: stateId, city_id: '' }));
    await master.loadCities(stateId);
  };

  /** "5, 8, 14–15 & 22 Sept" - how a person would say what they picked. */
  const runsLabel = useMemo(
    () => runs
      .map((r) => (r.start === r.end ? prettyDate(r.start) : `${prettyDate(r.start)} – ${prettyDate(r.end)}`))
      .join(' · '),
    [runs]
  );

  const formOpen = Boolean(editing) || selectedDays.size > 0;

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-serif font-bold text-brand-navy">Manage Availability</h2>
        <p className="text-brand-textSec text-sm mt-1">
          Tap the days you want, then publish them together with a status and location.
        </p>
      </div>

      {/* What this is doing for you */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        {loading ? (
          <p className="flex items-center gap-2 text-[13px] text-brand-textSec">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking your next 30 days…
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                summary.hidden === 0 ? 'bg-green-100 text-green-700' : 'bg-brand-primary/10 text-brand-primary'
              }`}>
                {summary.hidden === 0 ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-brand-navy">
                  {summary.open} of the next 30 days are bookable
                </p>
                <p className="mt-0.5 max-w-lg text-[12.5px] leading-relaxed text-brand-textSec">
                  {summary.hidden === 0
                    ? 'Nothing is blocked, so companies searching any date in the next month will find you. Mark days as booked or busy to take yourself out of those searches.'
                    : `${summary.hidden} day${summary.hidden === 1 ? '' : 's'} ${summary.hidden === 1 ? 'is' : 'are'} marked booked, busy, traveling or unavailable — you will not appear in date searches for ${summary.hidden === 1 ? 'that day' : 'those days'}.`}
                </p>
                {summary.publishedAvailable > 0 && (
                  <p className="mt-1 text-[12.5px] text-brand-textSec">
                    <MapPin size={11} className="mr-1 inline" aria-hidden="true" />
                    {summary.publishedAvailable} day{summary.publishedAvailable === 1 ? '' : 's'} published as available with a location, which is what puts you in city-and-date searches.
                  </p>
                )}
              </div>
            </div>

            {/* Where you are today - the one readout the old Settings panel had. */}
            <div className="w-full border-t border-brand-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                Today
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-navy">
                  <MapPin size={13} className="shrink-0 text-brand-primary" aria-hidden="true" />
                  {today.where || 'Location not set'}
                </span>
                {today.block && (
                  <span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                    STATUS_META[today.block.status]?.cell || ''
                  }`}>
                    {STATUS_META[today.block.status]?.label || today.block.status}
                  </span>
                )}
              </div>
              {today.fromBase && (
                <p className="mt-1 text-[12px] text-brand-textSec">
                  {baseLocation?.city
                    ? 'Your base location. Nothing is published for today, so you are bookable here.'
                    : 'Set a base location in Settings, or publish a day below.'}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {notice && (
        <p className="flex items-start gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] font-medium text-green-700">
          <Check size={14} className="mt-px shrink-0" aria-hidden="true" /> {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Calendar */}
        <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
          {loading ? (
            <p className="flex items-center gap-2 py-16 text-[13px] text-brand-textSec">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Loading your calendar…
            </p>
          ) : loadError ? (
            <div className="py-10 text-center">
              <AlertCircle size={24} className="mx-auto mb-3 text-brand-danger" aria-hidden="true" />
              <p className="text-[13.5px] font-semibold text-brand-navy">{loadError}</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <AvailabilityCalendar
                blocks={blocks}
                selectedDays={selectedDays}
                editingBlockId={editing ? (editing.id || editing._id) : null}
                jumpTo={jumpTo}
                onToggleDay={toggleDay}
                onClearAll={clearAll}
                onBlockClick={openEdit}
                disabled={saving}
              />

              {/* Secondary input: a long stretch is faster typed than tapped.
                  It ADDS to the selection, so days can then be unticked. */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-border pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  Add a stretch
                </span>
                <label htmlFor="av-from" className="sr-only">From date</label>
                <input
                  id="av-from"
                  type="date"
                  value={spanFrom}
                  min={minDate}
                  onChange={(e) => setSpanFrom(e.target.value)}
                  disabled={saving}
                  className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[12.5px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
                />
                <span className="text-[12px] text-brand-textSec">to</span>
                <label htmlFor="av-to" className="sr-only">To date</label>
                <input
                  id="av-to"
                  type="date"
                  value={spanTo}
                  min={spanFrom || minDate}
                  onChange={(e) => setSpanTo(e.target.value)}
                  disabled={saving}
                  className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[12.5px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
                />
                <button
                  type="button"
                  onClick={addSpan}
                  disabled={saving || !spanFrom || !spanTo}
                  className="rounded-lg border border-brand-primary px-2.5 py-1 text-[12px] font-semibold text-brand-primary transition-colors hover:bg-brand-primary/5 disabled:opacity-40"
                >
                  Add days
                </button>
              </div>
            </>
          )}
        </section>

        {/* Create / edit */}
        <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
          {!formOpen ? (
            <div className="py-8 text-center">
              <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <CalendarDays size={18} aria-hidden="true" />
              </span>
              <p className="text-[13.5px] font-semibold text-brand-navy">No days picked</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-textSec">
                Tap the days you want on the calendar — they do not have to be next to each other.
                Tap a coloured day to edit what is already published there.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-brand-navy">
                    {editing ? 'Edit availability' : 'New availability'}
                  </h3>
                  {editing ? (
                    <p className="mt-0.5 text-[12px] text-brand-textSec">
                      {prettyDate(editRange.start)}
                      {editRange.end !== editRange.start && ` — ${prettyDate(editRange.end)}`}
                      {' · '}
                      <span className="tabular-nums">
                        {dayCount(editRange.start, editRange.end)} day
                        {dayCount(editRange.start, editRange.end) === 1 ? '' : 's'}
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="mt-0.5 text-[12px] text-brand-textSec">
                        <span className="tabular-nums font-semibold text-brand-navy">
                          {selectedDays.size} day{selectedDays.size === 1 ? '' : 's'}
                        </span>
                        {runs.length > 1 && ` · saved as ${runs.length} entries`}
                      </p>
                      <p className="mt-0.5 break-words text-[11.5px] leading-relaxed text-brand-textSec">
                        {runsLabel}
                      </p>
                    </>
                  )}
                </div>
                <button type="button" onClick={closeForm} aria-label="Cancel" className="shrink-0 text-brand-textSec hover:text-brand-primary">
                  <X size={16} />
                </button>
              </div>

              {/* Editing changes one continuous stretch, so its dates are set
                  here rather than by picking days on the grid. */}
              {editing && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="av-edit-from" className="sr-only">Block start date</label>
                  <input
                    id="av-edit-from"
                    type="date"
                    value={editRange.start}
                    min={minDate}
                    onChange={(e) => e.target.value && setEditRange((r) => ({
                      start: e.target.value,
                      end: r.end >= e.target.value ? r.end : e.target.value
                    }))}
                    className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[12.5px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
                  />
                  <span className="text-[12px] text-brand-textSec">to</span>
                  <label htmlFor="av-edit-to" className="sr-only">Block end date</label>
                  <input
                    id="av-edit-to"
                    type="date"
                    value={editRange.end}
                    min={editRange.start}
                    onChange={(e) => e.target.value && setEditRange((r) => ({ ...r, end: e.target.value }))}
                    className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[12.5px] text-brand-navy focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
                  />
                </div>
              )}

              <div>
                <label htmlFor="av-status" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  Status
                </label>
                <select
                  id="av-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputClass}
                >
                  {Object.entries(STATUS_META).map(([key, m]) => (
                    <option key={key} value={key}>{m.label}</option>
                  ))}
                </select>
                {/* The consequence of the choice, stated where the choice is made. */}
                <p className={`mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed ${
                  STATUS_META[form.status]?.bookable
                    ? 'bg-green-50 text-green-800'
                    : 'bg-brand-bg text-brand-textSec'
                }`}>
                  {STATUS_META[form.status]?.bookable
                    ? <><Eye size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> Companies can find you on these dates.</>
                    : <><EyeOff size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> You will not appear in date-filtered searches on these dates.</>}
                </p>
              </div>

              <div>
                <label htmlFor="av-state" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  State <span className="font-normal normal-case text-brand-muted">(optional)</span>
                </label>
                <select
                  id="av-state"
                  value={form.state_id}
                  onChange={(e) => handleState(e.target.value)}
                  disabled={master.loadingLists}
                  className={inputClass}
                >
                  <option value="">{master.loadingLists ? 'Loading…' : 'No specific state'}</option>
                  {master.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="av-city" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  City
                </label>
                <select
                  id="av-city"
                  value={form.city_id}
                  onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                  disabled={!form.state_id || master.loadingCities}
                  className={`${inputClass} disabled:bg-brand-bg disabled:text-brand-muted`}
                >
                  <option value="">
                    {!form.state_id ? 'Choose a state first' : master.loadingCities ? 'Loading cities…' : 'No specific city'}
                  </option>
                  {master.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="mt-1 text-[11.5px] leading-relaxed text-brand-textSec">
                  A city makes this a travel window — you show up when a company searches that city on these dates,
                  not just your home city.
                </p>
              </div>

              <div>
                <label htmlFor="av-notes" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
                  Notes <span className="font-normal normal-case text-brand-muted">(optional)</span>
                </label>
                <textarea
                  id="av-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 500) })}
                  rows={2}
                  maxLength={500}
                  placeholder="Shooting a wedding in Udaipur"
                  className={inputClass}
                />
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-brand-danger">
                    <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> {formError}
                  </p>
                  {conflicts.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {conflicts.map((c) => (
                        <li key={c.id} className="text-[12px] text-brand-danger">
                          • {STATUS_META[c.status]?.label || c.status}
                          {c.city ? ` in ${c.city}` : ''}{' '}
                          — {prettyDate(blockDateToISO(c.start_date))} to {prettyDate(blockDateToISO(c.end_date))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                  {saving
                    ? 'Saving…'
                    : editing
                      ? 'Save changes'
                      : `Publish ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'}`}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => remove(editing)}
                    disabled={saving}
                    aria-label="Delete this block"
                    className="rounded-lg border border-red-200 px-3 py-2 text-brand-danger transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Secondary: the flat list, for scanning many blocks */}
      <section className="rounded-xl border border-brand-border bg-brand-surface">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          aria-expanded={showList}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        >
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">
            <List size={13} aria-hidden="true" /> All availability
            <span className="tabular-nums normal-case tracking-normal text-brand-muted">
              ({blocks.length} block{blocks.length === 1 ? '' : 's'})
            </span>
          </span>
          <span className="text-[12px] font-semibold text-brand-primary">{showList ? 'Hide' : 'Show'}</span>
        </button>

        {showList && (
          <div className="border-t border-brand-border">
            {blocks.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-brand-textSec sm:px-5">
                No availability published yet. Tap a day above to add your first.
              </p>
            ) : (
              <ul className="divide-y divide-brand-border">
                {blocks.map((b) => {
                  const meta = STATUS_META[b.status] || {};
                  const where = b.city_id?.name || b.city || b.state_id?.name || b.state;
                  return (
                    <li key={b.id || b._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-brand-navy">
                          <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${meta.cell || ''}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot || ''}`} aria-hidden="true" />
                            {meta.label || b.status}
                          </span>
                          {prettyDate(blockDateToISO(b.start_date))} — {prettyDate(blockDateToISO(b.end_date))}
                        </p>
                        <p className="mt-0.5 text-[12px] text-brand-textSec">
                          {where ? <><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{where}</> : 'No location set'}
                          {b.notes ? ` · ${b.notes}` : ''}
                        </p>
                        {/* Only the old Settings list showed this. No UI writes it,
                            but a block that has one must not lose it here. */}
                        {b.manual_location?.address && (
                          <p className="mt-0.5 text-[12px] text-brand-textSec">
                            <MapPin size={11} className="mr-1 inline" aria-hidden="true" />
                            {b.manual_location.address}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="rounded-lg border border-brand-border px-3 py-1.5 text-[12px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(b)}
                          aria-label="Delete"
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-brand-danger transition-colors hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
