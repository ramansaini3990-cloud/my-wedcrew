import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// Helpers live in their own module so this file exports only a component.
import { toISODate, blockDateToISO, STATUS_META } from './availabilityConstants';

/**
 * Month calendar for availability blocks.
 *
 * Built from scratch rather than pulling in a date-picker: the interaction here
 * is range selection over blocks, which off-the-shelf pickers do not model, and
 * the project has no date library to build on.
 *
 * SELECTION
 * Pointer events cover mouse, pen and touch in one path, so drag-to-select
 * works on a phone without a second implementation. `touch-action: none` on the
 * grid stops the browser scrolling the page mid-drag. A plain click is just a
 * drag of length one, so single-day selection needs no special case.
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

export default function AvailabilityCalendar({
  blocks = [],
  selection = null,
  onSelect,
  onBlockClick,
  disabled = false
}) {
  const today = useMemo(() => toISODate(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [drag, setDrag] = useState(null); // { anchor, current }
  const gridRef = useRef(null);

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

  const inSelection = useCallback((iso) => {
    const range = drag
      ? [drag.anchor, drag.current].sort()
      : selection && selection.start
        ? [selection.start, selection.end || selection.start].sort()
        : null;
    if (!range) return false;
    return iso >= range[0] && iso <= range[1];
  }, [drag, selection]);

  /* ---------------- pointer selection ---------------- */

  const isPast = useCallback((iso) => iso < today, [today]);

  const beginDrag = (iso) => {
    if (disabled || isPast(iso)) return;
    // A day already inside a block opens that block rather than starting a new
    // selection - the block is the unit, not the loose day.
    const existing = byDate.get(iso);
    if (existing) { onBlockClick?.(existing); return; }
    setDrag({ anchor: iso, current: iso });
  };

  const extendDrag = (iso) => {
    if (!drag || disabled || isPast(iso)) return;
    setDrag((d) => (d && d.current !== iso ? { ...d, current: iso } : d));
  };

  const endDrag = useCallback(() => {
    if (!drag) return;
    const [start, end] = [drag.anchor, drag.current].sort();
    setDrag(null);
    onSelect?.({ start, end });
  }, [drag, onSelect]);

  // A pointer released outside the grid must still finish the selection.
  useEffect(() => {
    if (!drag) return undefined;
    const up = () => endDrag();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, endDrag]);

  /** Touch drags report only the starting element, so the day is resolved from
   *  the point under the finger. */
  const dayFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest('[data-day]')?.getAttribute('data-day') || null;
  };

  const monthLabel = `${MONTHS[cursor.month]} ${cursor.year}`;
  const atCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  const step = (delta) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

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
          if (!drag) return;
          const iso = dayFromPoint(e.clientX, e.clientY);
          if (iso) extendDrag(iso);
        }}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="aspect-square" />;

          const iso = toISODate(date);
          const past = isPast(iso);
          const block = byDate.get(iso);
          const meta = block ? STATUS_META[block.status] : null;
          const selected = inSelection(iso);
          const isToday = iso === today;

          const base = 'aspect-square rounded-lg border text-[12px] sm:text-[13px] font-medium flex items-center justify-center relative transition-colors';
          const tone = past
            ? 'border-transparent text-brand-muted/50 cursor-not-allowed'
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
              onPointerDown={(e) => { e.preventDefault(); beginDrag(iso); }}
              onPointerEnter={() => extendDrag(iso)}
              className={`${base} ${tone}`}
            >
              {date.getDate()}
              {isToday && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-brand-primary'}`}
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
