import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
// Helpers live in their own module so this file exports only a component.
import { toISODate, blockDateToISO, STATUS_META } from './availabilityConstants';

/**
 * Month calendar for availability blocks.
 *
 * Built from scratch rather than pulling in a date-picker: the interaction here
 * is range selection over blocks, which off-the-shelf pickers do not model, and
 * the project has no date library to build on.
 *
 * TWO WAYS TO SELECT A RANGE, and they must not fight each other.
 *
 *   drag        press a day, move across days, release. Fast with a mouse.
 *   tap -> tap  tap the first day, tap the last. Works on any screen, and is
 *               the only method that can span a month boundary, because you can
 *               navigate months between the two taps.
 *
 * A press is classified only on RELEASE: if the pointer visited another day it
 * was a drag and commits the range; if it never left the day it was a tap. That
 * single rule is what stops a drag being misread as two taps, and a tap from
 * starting a phantom drag - no timers, no distance threshold.
 *
 * THE DRAG STATE LIVES IN A REF, not just in state. Pointer handlers close over
 * the render that installed them, so a fast swipe whose first pointermove
 * arrives before React re-renders used to read `drag` as null and drop the
 * gesture - the range silently collapsed to one day. Measured on a phone
 * viewport: a slow drag across five cells worked, the same drag as one coarse
 * movement selected one day. The ref is read fresh every event; state only
 * mirrors it for rendering.
 *
 * DATES ARE HANDLED AS PLAIN YYYY-MM-DD STRINGS. The API stores midnight UTC;
 * building local Date objects and converting would shift days for anyone east
 * or west of UTC, which is exactly the bug that makes a calendar show the wrong
 * day. Comparisons are string comparisons, which are correct for ISO dates.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Every cell of the month grid, padded to whole weeks starting Monday. */
const buildGrid = (year, month) => {
  const first = new Date(year, month, 1);
  // getDay() is 0=Sun; shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const monthOf = (isoDay) => {
  const [y, m] = isoDay.split('-');
  return { year: Number(y), month: Number(m) - 1 };
};

const shortDate = (isoDay) =>
  new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC'
  });

export default function AvailabilityCalendar({
  blocks = [],
  selection = null,
  jumpTo = null,
  onSelect,
  onBlockClick,
  disabled = false
}) {
  const today = useMemo(() => toISODate(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Tap-to-tap: the first tap parks here until the second tap closes the range.
  // Deliberately independent of `cursor`, so navigating months keeps it alive -
  // that is what makes 28 Sep -> 5 Oct selectable at all.
  const [pendingStart, setPendingStart] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);

  const dragRef = useRef(null);          // { anchor, current, moved } - authoritative
  const [dragView, setDragView] = useState(null);  // mirror, for rendering only
  const gridRef = useRef(null);

  /** Pointer coarseness decides the wording of the hint, nothing else. */
  const coarsePointer = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);

  /** date string -> the block covering it. Built once per blocks change. */
  const byDate = useMemo(() => {
    const map = new Map();
    for (const b of blocks) {
      const start = blockDateToISO(b.start_date);
      const end = blockDateToISO(b.end_date);
      const cur = new Date(`${start}T00:00:00Z`);
      const last = new Date(`${end}T00:00:00Z`);
      while (cur <= last) {
        map.set(blockDateToISO(cur), b);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    return map;
  }, [blocks]);

  const cells = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);

  const isPast = useCallback((iso) => iso < today, [today]);

  /**
   * The range being shown, in priority order: an active drag, then a pending
   * tap-start previewing towards the hovered day, then the committed selection.
   */
  const activeRange = useMemo(() => {
    if (dragView) return [dragView.anchor, dragView.current].sort();
    if (pendingStart) {
      const other = hoverDay || pendingStart;
      return [pendingStart, other].sort();
    }
    if (selection?.start) return [selection.start, selection.end || selection.start].sort();
    return null;
  }, [dragView, pendingStart, hoverDay, selection]);

  const inSelection = useCallback(
    (iso) => Boolean(activeRange) && iso >= activeRange[0] && iso <= activeRange[1],
    [activeRange]
  );

  /* ---------------- month navigation ---------------- */

  const step = (delta) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // The date inputs set the selection without touching the grid, so bring the
  // grid to it - a selection you cannot see is not a selection you can check.
  // Carries a `seq` as well as the date so re-picking the same day after
  // navigating away still brings the grid back to it.
  useEffect(() => {
    if (!jumpTo?.iso) return;
    setCursor(monthOf(jumpTo.iso));
  }, [jumpTo]);

  /* ---------------- selection ---------------- */

  const clearAll = useCallback(() => {
    dragRef.current = null;
    setDragView(null);
    setPendingStart(null);
    setHoverDay(null);
    onSelect?.(null);
  }, [onSelect]);

  const commit = useCallback((a, b) => {
    const [start, end] = [a, b].sort();
    setPendingStart(null);
    setHoverDay(null);
    onSelect?.({ start, end });
  }, [onSelect]);

  const press = (iso) => {
    if (disabled || isPast(iso)) return;
    // A day already inside a block opens that block rather than starting a new
    // selection - the block is the unit, not the loose day.
    const existing = byDate.get(iso);
    if (existing) {
      setPendingStart(null);
      setHoverDay(null);
      onBlockClick?.(existing);
      return;
    }
    dragRef.current = { anchor: iso, current: iso, moved: false };
    setDragView({ anchor: iso, current: iso });
  };

  /** Called from pointermove; reads the ref so it is never a render behind. */
  const extend = useCallback((iso) => {
    const d = dragRef.current;
    if (!d || disabled || isPast(iso) || iso === d.current) return;
    d.current = iso;
    d.moved = true;
    setDragView({ anchor: d.anchor, current: iso });
  }, [disabled, isPast]);

  /** Release decides what the gesture was. */
  const release = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDragView(null);

    if (d.moved) {
      commit(d.anchor, d.current);   // it was a drag
      return;
    }
    // It was a tap.
    if (pendingStart) {
      commit(pendingStart, d.anchor);           // second tap closes the range
    } else {
      // First tap of a new range. Any previously committed selection is
      // dropped rather than extended, so a third tap reads as a fresh start.
      setPendingStart(d.anchor);
      setHoverDay(null);
      onSelect?.(null);
    }
  }, [commit, pendingStart, onSelect]);

  useEffect(() => {
    // A pointer released outside the grid must still finish the gesture.
    const up = () => release();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [release]);

  /** Touch drags report only the starting element, so the day is resolved from
   *  the point under the finger. */
  const dayFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest('[data-day]')?.getAttribute('data-day') || null;
  };

  const monthLabel = `${MONTHS[cursor.month]} ${cursor.year}`;
  const atCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  const hasSomething = Boolean(pendingStart || selection?.start);
  const hint = coarsePointer
    ? 'Tap the first day, then the last, to select a range.'
    : 'Drag across days — or tap the first day, then the last — to select a range.';

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={atCurrentMonth}
          aria-label="Previous month"
          className="p-1.5 rounded-lg border border-brand-border text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[14px] font-semibold text-brand-navy tabular-nums">{monthLabel}</p>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="p-1.5 rounded-lg border border-brand-border text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* How it works, worded for the device actually in use, plus the state of
          an open selection. Both live here rather than in a tooltip, because a
          gesture nobody is told about is a gesture nobody uses. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[11.5px] leading-relaxed text-brand-textSec" aria-live="polite">
          {pendingStart ? (
            <span className="font-semibold text-brand-primary">
              Start {shortDate(pendingStart)} — now tap the last day
              {' '}<span className="font-normal text-brand-textSec">(change month if you need to)</span>
            </span>
          ) : hint}
        </p>
        {hasSomething && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-border px-2 py-0.5 text-[11px] font-semibold text-brand-textSec transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <X size={11} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-brand-textSec py-1">
            {/* One letter on a narrow phone, three from `sm` up. */}
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-7 gap-1 select-none"
        style={{ touchAction: 'none' }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const iso = dayFromPoint(e.clientX, e.clientY);
          if (iso) extend(iso);
        }}
        onPointerLeave={() => setHoverDay(null)}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="aspect-square" />;

          const iso = toISODate(date);
          const past = isPast(iso);
          const block = byDate.get(iso);
          const meta = block ? STATUS_META[block.status] : null;
          const selected = inSelection(iso);
          const isToday = iso === today;
          const isAnchor = iso === pendingStart;

          const base = 'aspect-square rounded-lg border text-[12px] sm:text-[13px] font-medium flex items-center justify-center relative transition-colors';
          const tone = past
            ? 'border-transparent text-brand-muted/50 cursor-not-allowed'
            : isAnchor
              // The pending start reads as unfinished, not as a made choice.
              ? 'bg-brand-primary/15 text-brand-primary border-brand-primary border-dashed cursor-pointer'
              : selected
                ? 'bg-brand-primary text-white border-brand-primary cursor-pointer'
                : meta
                  ? `${meta.cell} cursor-pointer hover:brightness-95`
                  : 'border-brand-border text-brand-navy hover:border-brand-primary hover:bg-brand-primary/5 cursor-pointer';

          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              disabled={past || disabled}
              aria-label={`${iso}${block ? ` — ${STATUS_META[block.status]?.label}` : ''}`}
              aria-pressed={selected}
              title={block ? `${STATUS_META[block.status]?.label}${block.city_id?.name || block.city ? ' · ' + (block.city_id?.name || block.city) : ''}` : undefined}
              onPointerDown={(e) => { e.preventDefault(); press(iso); }}
              onPointerEnter={() => {
                if (dragRef.current) extend(iso);
                else if (pendingStart && !isPast(iso)) setHoverDay(iso);
              }}
              className={`${base} ${tone}`}
            >
              {date.getDate()}
              {isToday && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${selected && !isAnchor ? 'bg-white' : 'bg-brand-primary'}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11.5px] text-brand-textSec">
            <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden="true" />
            {m.label}
            {!m.bookable && <span className="text-brand-muted">(hidden from date search)</span>}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-brand-textSec">
          <span className="h-2 w-2 rounded-full bg-brand-primary ring-2 ring-brand-primary/30" aria-hidden="true" />
          Today
        </span>
      </div>
    </div>
  );
}
