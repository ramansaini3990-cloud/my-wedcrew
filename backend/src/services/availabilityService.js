import AvailabilityBlock, { AVAILABILITY_STATUSES } from '../models/AvailabilityBlock.js';

/**
 * Validation and querying for date-ranged, location-aware availability.
 *
 * Overlap rule: a user cannot hold two blocks covering the same day, because
 * that would let them appear both AVAILABLE and BOOKED in the same window.
 * Ranges are inclusive of both endpoints.
 */

export const AVAILABILITY_ERRORS = {
  INVALID_DATES: { code: 'INVALID_DATES', message: 'Provide a valid start and end date.' },
  END_BEFORE_START: { code: 'END_BEFORE_START', message: 'The end date must be on or after the start date.' },
  RANGE_TOO_LONG: { code: 'RANGE_TOO_LONG', message: 'An availability block cannot span more than 365 days.' },
  INVALID_STATUS: { code: 'INVALID_STATUS', message: 'Unknown availability status.' },
  OVERLAP: { code: 'AVAILABILITY_OVERLAP', message: 'This period overlaps an existing availability block.' },
  NOT_FOUND: { code: 'AVAILABILITY_NOT_FOUND', message: 'Availability block not found.' },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'You can only modify your own availability.' }
};

const MAX_RANGE_DAYS = 365;

/** Normalises to midnight UTC so whole-day comparisons are stable. */
export const startOfDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Validates the date range and status of a block payload.
 * @returns {{ok: boolean, error?: object, start?: Date, end?: Date}}
 */
export const validateRange = (startInput, endInput, status) => {
  const start = startOfDay(startInput);
  const end = startOfDay(endInput);

  if (!start || !end) return { ok: false, error: AVAILABILITY_ERRORS.INVALID_DATES };
  if (end < start) return { ok: false, error: AVAILABILITY_ERRORS.END_BEFORE_START };

  const days = Math.round((end - start) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) return { ok: false, error: AVAILABILITY_ERRORS.RANGE_TOO_LONG };

  if (status && !AVAILABILITY_STATUSES.includes(status)) {
    return { ok: false, error: AVAILABILITY_ERRORS.INVALID_STATUS };
  }

  return { ok: true, start, end };
};

/**
 * Finds this user's blocks that intersect [start, end].
 * Two inclusive ranges overlap when  A.start <= B.end  AND  A.end >= B.start.
 *
 * @param {string} excludeId block being edited, excluded from the check
 */
export const findOverlappingBlocks = async (userId, start, end, excludeId = null) => {
  const query = {
    user_id: userId,
    start_date: { $lte: end },
    end_date: { $gte: start }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return AvailabilityBlock.find(query).sort({ start_date: 1 });
};

/**
 * Blocks covering a given date, optionally filtered by city, for a set of users.
 * Used by location-aware professional search.
 */
export const findBlocksCoveringDate = async ({ date, cityId, stateId, statuses, userIds }) => {
  const day = startOfDay(date);
  if (!day) return [];

  const query = { start_date: { $lte: day }, end_date: { $gte: day } };
  if (cityId) query.city_id = cityId;
  if (stateId) query.state_id = stateId;
  if (statuses && statuses.length) query.status = { $in: statuses };
  if (userIds && userIds.length) query.user_id = { $in: userIds };

  return AvailabilityBlock.find(query).lean();
};

/** Blocks that end today or later, for profile display. */
export const getUpcomingBlocks = async (userId, limit = 50) => {
  const today = startOfDay(new Date());
  return AvailabilityBlock.find({ user_id: userId, end_date: { $gte: today } })
    .populate('state_id', 'name')
    .populate('city_id', 'name')
    .sort({ start_date: 1 })
    .limit(limit);
};

export default {
  validateRange,
  findOverlappingBlocks,
  findBlocksCoveringDate,
  getUpcomingBlocks,
  startOfDay,
  AVAILABILITY_ERRORS
};
