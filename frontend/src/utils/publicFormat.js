/**
 * Formatting shared by the two public browse pages and their cards.
 *
 * WHY DATES ARE FORMATTED EXPLICITLY
 * `toLocaleDateString()` with no arguments follows the browser locale, so the
 * same requirement rendered "9/8/2026" for one visitor and "8/9/2026" for
 * another - and in India neither reading is obviously right. Naming the parts
 * gives "8 Aug 2026", which cannot be misread as a different day.
 */

const DAY_OPTS = { day: 'numeric', month: 'short', year: 'numeric' };
const DAY_NO_YEAR = { day: 'numeric', month: 'short' };

/** "8 Aug 2026", or null when there is no usable date. */
export const formatDay = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', DAY_OPTS);
};

/**
 * "8 Aug 2026" for a single day, "8 – 10 Aug 2026" for a span.
 * The year is printed once when both ends share it.
 */
export const formatDayRange = (start, end) => {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || Number.isNaN(s.getTime())) return null;
  if (!e || Number.isNaN(e.getTime()) || s.getTime() === e.getTime()) return formatDay(s);

  const sameYear = s.getFullYear() === e.getFullYear();
  const left = s.toLocaleDateString('en-IN', sameYear ? DAY_NO_YEAR : DAY_OPTS);
  return `${left} – ${e.toLocaleDateString('en-IN', DAY_OPTS)}`;
};

/**
 * Money for display. Integers only - the API sends whole rupees here, and a
 * locked requirement sends the string "Hidden" instead of a number, which must
 * pass through as-is rather than rendering "₹NaN".
 */
export const formatRupees = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₹${n.toLocaleString('en-IN')}`;
};

/**
 * Grid classes for a result list.
 *
 * A responsive grid alone is not enough: with three or four columns and a
 * single result, that card sits in the top-left with the rest of a 1900px row
 * empty, which reads as a broken page rather than as one match. Under-full
 * rows are therefore capped and centred, so a lone card looks deliberate; from
 * three results up the grid fills the width and gains a fourth column on very
 * wide screens.
 */
export const resultGridClass = (count) => {
  if (count === 1) return 'grid gap-5 grid-cols-1 max-w-sm mx-auto';
  if (count === 2) return 'grid gap-5 grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
  return 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
};
