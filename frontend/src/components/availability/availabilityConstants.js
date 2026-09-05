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
