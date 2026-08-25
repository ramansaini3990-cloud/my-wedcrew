import Profession from '../models/Profession.js';
import State from '../models/State.js';
import City from '../models/City.js';
import User from '../models/User.js';
import Requirement from '../models/Requirement.js';
import AvailabilityBlock from '../models/AvailabilityBlock.js';

/**
 * Central authority for profession / state / city master data.
 *
 * Every profile write goes through `resolveProfileMasterData()`, so frontend
 * IDs are never trusted: existence, active state and the city->state
 * relationship are all re-checked server-side.
 */

export const MASTER_ERRORS = {
  PROFESSION_NOT_FOUND: { code: 'PROFESSION_NOT_FOUND', message: 'The selected profession does not exist.' },
  PROFESSION_INACTIVE: { code: 'PROFESSION_INACTIVE', message: 'The selected profession is no longer available.' },
  STATE_NOT_FOUND: { code: 'STATE_NOT_FOUND', message: 'The selected state does not exist.' },
  STATE_INACTIVE: { code: 'STATE_INACTIVE', message: 'The selected state is no longer available.' },
  CITY_NOT_FOUND: { code: 'CITY_NOT_FOUND', message: 'The selected city does not exist.' },
  CITY_INACTIVE: { code: 'CITY_INACTIVE', message: 'The selected city is no longer available.' },
  CITY_STATE_MISMATCH: { code: 'CITY_STATE_MISMATCH', message: 'The selected city does not belong to the selected state.' },
  STATE_REQUIRED_FOR_CITY: { code: 'STATE_REQUIRED_FOR_CITY', message: 'Select a state before selecting a city.' },
  IN_USE: { code: 'MASTER_RECORD_IN_USE', message: 'This record is in use and cannot be deleted. Deactivate it instead.' }
};

/** URL/lookup friendly key derived from a display name. */
export const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Validates a profession/state/city selection and returns the resolved
 * documents plus the denormalised strings to persist alongside the IDs.
 *
 * `allowInactive` is used when a user re-saves a profile that already points at
 * a record an admin has since deactivated - their existing selection is kept
 * rather than wiped, which protects existing data (requirement: deactivating
 * must not corrupt profiles).
 *
 * @returns {Promise<{ok: boolean, error?: object, values?: object}>}
 */
export const resolveProfileMasterData = async (
  { profession_id, state_id, city_id },
  { current = {}, allowInactive = false } = {}
) => {
  const values = {};

  // ---- Profession -------------------------------------------------------
  if (profession_id !== undefined) {
    if (profession_id === null || profession_id === '') {
      values.profession_id = null;
    } else {
      const profession = await Profession.findById(profession_id).catch(() => null);
      if (!profession) return { ok: false, error: MASTER_ERRORS.PROFESSION_NOT_FOUND };

      const unchanged = String(current.profession_id || '') === String(profession._id);
      if (!profession.is_active && !allowInactive && !unchanged) {
        return { ok: false, error: MASTER_ERRORS.PROFESSION_INACTIVE };
      }
      values.profession_id = profession._id;
      values.profession = profession.name; // keep legacy string in sync
    }
  }

  // ---- State ------------------------------------------------------------
  let resolvedState = null;
  if (state_id !== undefined) {
    if (state_id === null || state_id === '') {
      values.state_id = null;
    } else {
      resolvedState = await State.findById(state_id).catch(() => null);
      if (!resolvedState) return { ok: false, error: MASTER_ERRORS.STATE_NOT_FOUND };

      const unchanged = String(current.state_id || '') === String(resolvedState._id);
      if (!resolvedState.is_active && !allowInactive && !unchanged) {
        return { ok: false, error: MASTER_ERRORS.STATE_INACTIVE };
      }
      values.state_id = resolvedState._id;
      values.state = resolvedState.name;
    }
  }

  // ---- City (must belong to the state) ----------------------------------
  if (city_id !== undefined) {
    if (city_id === null || city_id === '') {
      values.city_id = null;
    } else {
      const city = await City.findById(city_id).catch(() => null);
      if (!city) return { ok: false, error: MASTER_ERRORS.CITY_NOT_FOUND };

      const unchanged = String(current.city_id || '') === String(city._id);
      if (!city.is_active && !allowInactive && !unchanged) {
        return { ok: false, error: MASTER_ERRORS.CITY_INACTIVE };
      }

      // The state to validate against: the one being set now, otherwise the
      // one already stored on the record.
      const effectiveStateId =
        values.state_id !== undefined ? values.state_id : current.state_id;

      if (!effectiveStateId) return { ok: false, error: MASTER_ERRORS.STATE_REQUIRED_FOR_CITY };
      if (String(city.state_id) !== String(effectiveStateId)) {
        return { ok: false, error: MASTER_ERRORS.CITY_STATE_MISMATCH };
      }

      values.city_id = city._id;
      values.city = city.name;
    }
  }

  return { ok: true, values };
};

/* ------------------------------------------------------------------ */
/* Usage counting - powers "Used by N profiles" and safe delete         */
/* ------------------------------------------------------------------ */

export const getProfessionUsage = async (professionId, professionName) => {
  const [byId, byLegacyName, requirements] = await Promise.all([
    User.countDocuments({ profession_id: professionId }),
    professionName
      ? User.countDocuments({
          profession_id: { $exists: false },
          profession: new RegExp(`^${escapeRegex(professionName)}$`, 'i')
        })
      : 0,
    professionName
      ? Requirement.countDocuments({ category: new RegExp(`^${escapeRegex(professionName)}$`, 'i') })
      : 0
  ]);
  return { users: byId + byLegacyName, requirements, total: byId + byLegacyName + requirements };
};

export const getStateUsage = async (stateId, stateName) => {
  const [users, cities, requirements, blocks] = await Promise.all([
    User.countDocuments({ state_id: stateId }),
    City.countDocuments({ state_id: stateId }),
    stateName ? Requirement.countDocuments({ state: new RegExp(`^${escapeRegex(stateName)}$`, 'i') }) : 0,
    AvailabilityBlock.countDocuments({ state_id: stateId })
  ]);
  return { users, cities, requirements, availability_blocks: blocks, total: users + requirements + blocks };
};

export const getCityUsage = async (cityId, cityName) => {
  const [users, requirements, blocks] = await Promise.all([
    User.countDocuments({ city_id: cityId }),
    cityName ? Requirement.countDocuments({ city: new RegExp(`^${escapeRegex(cityName)}$`, 'i') }) : 0,
    AvailabilityBlock.countDocuments({ city_id: cityId })
  ]);
  return { users, requirements, availability_blocks: blocks, total: users + requirements + blocks };
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  slugify,
  resolveProfileMasterData,
  getProfessionUsage,
  getStateUsage,
  getCityUsage,
  MASTER_ERRORS
};
