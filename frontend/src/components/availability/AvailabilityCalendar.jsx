import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
// Helpers live in their own module so this file exports only a component.
import { toISODate, blockDateToISO, STATUS_META } from './availabilityConstants';

/**
 * Month calendar for availability blocks.
 *
 * Built from scratch rather than pulling in a date-picker: the interaction here
 * is picking days over existing blocks, which off-the-shelf pickers do not
 * model, and the project has no date library to build on.
 *
 * SELECTION IS PER-DAY TOGGLING, like choosing seats. Every click flips exactly
 * one day; there is no anchor, no range and no gesture. That is what a wedding
 * freelancer's month actually looks like - busy on the 5th, 8th, 14th-15th and
 * 22nd, free in between - which a start-to-end range cannot express without
 * being run several times.
 *
 * The selected set is owned by the parent, so it survives month navigation and
 * can be published in one action.
 *
 * There is deliberately NO drag gesture. It used to exist and was removed with
 * the range model; keeping it would mean a swipe over the grid both selected
 * days and fought the page scroll. `touch-action: manipulation` is what lets a
 * phone scroll past the calendar while still removing the double-tap zoom delay
 * on the day buttons.
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

export default function AvailabilityCalendar({
  blocks = [],
  selectedDays = null,     // Set of YYYY-MM-DD
  editingBlockId = null,
  jumpTo = null,
  onToggleDay,
  onClearAll,
  onBlockClick,
  disabled = false
}) {
  const today = useMemo(() => toISODate(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const selected = selectedDays || new Set();

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

  const step = (delta) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // The date inputs extend the selection without touching the grid, so bring
  // the grid to them - days you cannot see are days you cannot check.
  useEffect(() => {
    if (!jumpTo?.iso) return;
    setCursor(monthOf(jumpTo.iso));
  }, [jumpTo]);

  const handleDay = (iso) => {
    if (disabled || isPast(iso)) return;
    // A day already inside a block opens that block rather than joining the
    // selection - the block is the unit there, not the loose day.
    const existing = byDate.get(iso);
    if (existing) { onBlockClick?.(existing); return; }
    onToggleDay?.(iso);
  };

  const monthLabel = `${MONTHS[cursor.month]} ${cursor.year}`;
  const atCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();
  const count = selected.size;

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

      {/* One line, true on every device, with no gesture to explain. The count
          is the total across all months, not just the one on screen. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[11.5px] leading-relaxed text-brand-textSec" aria-live="polite">
          {count > 0
            ? <span className="font-semibold text-brand-primary">
                {count} day{count === 1 ? '' : 's'} selected
                <span className="font-normal text-brand-textSec"> — keep tapping to add or remove</span>
              </span>
            : 'Tap the days you want. They do not have to be next to each other.'}
        </p>
        {count > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-border px-2 py-0.5 text-[11px] font-semibold text-brand-textSec transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <X size={11} aria-hidden="true" /> Clear {count}
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

      {/* `manipulation` keeps vertical page scrolling working over the grid -
          there is no drag to protect any more - while dropping the double-tap
          zoom delay so a tap registers immediately. */}
      <div className="grid grid-cols-7 gap-1 select-none" style={{ touchAction: 'manipulation' }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="aspect-square" />;

          const iso = toISODate(date);
          const past = isPast(iso);
          const block = byDate.get(iso);
          const meta = block ? STATUS_META[block.status] : null;
          const isSelected = selected.has(iso);
          const isToday = iso === today;
          const isEditing = Boolean(block) && String(block.id || block._id) === String(editingBlockId);

          const base = 'aspect-square rounded-lg border text-[12px] sm:text-[13px] font-medium flex items-center justify-center relative transition-colors';
          const tone = past
            ? 'border-transparent text-brand-muted/50 cursor-not-allowed'
            : isSelected
              ? 'bg-brand-primary text-white border-brand-primary cursor-pointer'
              : meta
                ? `${meta.cell} cursor-pointer hover:brightness-95 ${isEditing ? 'ring-2 ring-brand-primary ring-offset-1' : ''}`
                : 'border-brand-border text-brand-navy hover:border-brand-primary hover:bg-brand-primary/5 cursor-pointer';

          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              disabled={past || disabled}
              aria-label={`${iso}${block ? ` — ${STATUS_META[block.status]?.label}` : ''}`}
              aria-pressed={isSelected}
              title={block ? `${STATUS_META[block.status]?.label}${block.city_id?.name || block.city ? ' · ' + (block.city_id?.name || block.city) : ''}` : undefined}
              onClick={() => handleDay(iso)}
              className={`${base} ${tone}`}
            >
              {date.getDate()}
              {isToday && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-primary'}`}
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
