/**
 * Availability helpers and status metadata.
 *
 * Kept out of the calendar component so that file exports a component and
 * nothing else - a module that mixes the two breaks React Fast Refresh, which
 * the linter flags.
 *
 * DATES ARE PLAIN YYYY-MM-DD STRINGS throughout the availability UI. The API
 * stores midnight UTC; building local Date objects and converting back would
 * shift the day for anyone not on UTC, which is the classic way a calendar ends
 * up showing the wrong date. String comparison is correct for ISO dates.
 */

/** A local calendar day as YYYY-MM-DD, with no timezone conversion. */
export const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A stored block date (midnight UTC) as the YYYY-MM-DD it represents. */
export const blockDateToISO = (value) => {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** The day after an ISO day, computed in UTC so no DST shift can occur. */
export const nextISODay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return blockDateToISO(d);
};

/** Every ISO day from start to end, inclusive. */
export const eachISODay = (startISO, endISO) => {
  const out = [];
  for (let d = startISO; d <= endISO; d = nextISODay(d)) out.push(d);
  return out;
};

/**
 * Collapses scattered days into the fewest contiguous runs that cover them.
 *
 *   ['05','08','14','15','22']  ->  05, 08, 14-15, 22
 *
 * This is the bridge between what the user picks (individual days) and what
 * AvailabilityBlock stores (one row per continuous span). Grouping rather than
 * writing a row per day keeps 14-15 as the single entry a person would call it,
 * and keeps a block created here indistinguishable from one created before the
 * calendar toggled days.
 */
export const groupIntoRuns = (days) => {
  const sorted = [...new Set(days)].sort();
  const runs = [];
  for (const day of sorted) {
    const last = runs[runs.length - 1];
    if (last && nextISODay(last.end) === day) last.end = day;
    else runs.push({ start: day, end: day });
  }
  return runs;
};

/**
 * The five statuses from AvailabilityBlock's own enum - not a new set.
 *
 * `bookable` mirrors BOOKABLE_STATUSES on the server: only `available` keeps a
 * professional in date-filtered search. That consequence is surfaced in the UI
 * rather than left for the user to discover.
 */
export const STATUS_META = {
  available: { label: 'Available', bookable: true, dot: 'bg-green-500', cell: 'bg-green-100 text-green-800 border-green-300' },
  booked: { label: 'Booked', bookable: false, dot: 'bg-brand-primary', cell: 'bg-brand-primary/15 text-brand-primary border-brand-primary/40' },
  busy: { label: 'Busy', bookable: false, dot: 'bg-red-500', cell: 'bg-red-100 text-red-700 border-red-300' },
  traveling: { label: 'Traveling', bookable: false, dot: 'bg-blue-500', cell: 'bg-blue-100 text-blue-700 border-blue-300' },
  unavailable: { label: 'Unavailable', bookable: false, dot: 'bg-brand-muted', cell: 'bg-brand-bg text-brand-textSec border-brand-border' }
};
