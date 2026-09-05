import SavedProfessional from '../models/SavedProfessional.js';
import User from '../models/User.js';
import {
  PUBLIC_PROFESSIONAL_FIELDS,
  toPublicProfessional,
  toLockedProfessional,
  canViewProfessionalDetails,
  loadPublicBlocks
} from './publicProfileService.js';

/**
 * Saved-professionals (bookmarks) authority.
 *
 * Every rule about who may save what, and what a saved row is allowed to
 * reveal, lives here - the controller only translates results into HTTP.
 *
 * PRIVACY
 * The list endpoint never returns a stored copy of a professional. It reads
 * the live User record and hands it to the SAME serialisers the public search
 * uses, behind the SAME canViewProfessionalDetails gate. A company without an
 * active plan gets locked cards from their saved list exactly as they do from
 * search - bookmarking is not a way to accumulate identities cheaply.
 */

/** Duplicate-key error from the unique {company_id, freelancer_id} index. */
const isDuplicateKey = (error) => error?.code === 11000;

/**
 * The professional must exist and actually be a professional. Without this a
 * company could bookmark another company, or a deleted id, and the list would
 * then contain rows that resolve to nothing.
 */
export const findSaveableProfessional = async (freelancerId) => {
  if (!freelancerId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'A professional id is required.' };
  }

  const professional = await User.findOne({ _id: freelancerId, role: 'freelancer' })
    .select('_id name profession profession_id city city_id')
    .populate('profession_id', 'name')
    .populate('city_id', 'name')
    .lean()
    .catch(() => null);

  if (!professional) {
    return { ok: false, code: 'PROFESSIONAL_NOT_FOUND', message: 'Professional not found.' };
  }

  return { ok: true, professional };
};

/**
 * Idempotent by design: saving something already saved is a success, not an
 * error. The button is a toggle, and a double tap should leave the user in the
 * state they asked for rather than showing a failure.
 *
 * @returns {Promise<{created: boolean}>}
 */
export const saveProfessional = async (companyId, freelancerId) => {
  try {
    await SavedProfessional.create({ company_id: companyId, freelancer_id: freelancerId });
    return { created: true };
  } catch (error) {
    if (isDuplicateKey(error)) return { created: false };
    throw error;
  }
};

/** @returns {Promise<{removed: boolean}>} - false when it was not saved. */
export const unsaveProfessional = async (companyId, freelancerId) => {
  const result = await SavedProfessional.deleteOne({
    company_id: companyId,
    freelancer_id: freelancerId
  });
  return { removed: result.deletedCount > 0 };
};

/**
 * Just the ids the caller has saved.
 *
 * The search grid needs to know which of the professionals on screen are
 * already bookmarked. Returning ids only means that check costs one small
 * request and leaks nothing - no name, no profession, nothing the lock
 * withholds.
 */
export const listSavedIds = async (companyId) => {
  const rows = await SavedProfessional.find({ company_id: companyId })
    .select('freelancer_id')
    .lean();
  return rows.map((r) => String(r.freelancer_id));
};

/**
 * A page of saved professionals, serialised through the public rules.
 *
 * @param {object} viewer  req.user - used for the subscription gate
 */
export const listSavedProfessionals = async (viewer, { page = 1, limit = 12 } = {}) => {
  const companyId = viewer.id || viewer._id;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

  const total = await SavedProfessional.countDocuments({ company_id: companyId });

  const rows = await SavedProfessional.find({ company_id: companyId })
    .sort({ created_at: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .lean();

  const ids = rows.map((r) => r.freelancer_id);

  const users = await User.find({ _id: { $in: ids }, role: 'freelancer' })
    .select(PUBLIC_PROFESSIONAL_FIELDS)
    .populate('profession_id', 'name')
    .populate('state_id', 'name')
    .populate('city_id', 'name')
    .lean();

  // One subscription check for the whole page, mirroring the search endpoint.
  const unlocked = await canViewProfessionalDetails(viewer);

  const byId = new Map(users.map((u) => [String(u._id), u]));

  const data = [];
  for (const row of rows) {
    const user = byId.get(String(row.freelancer_id));
    // A professional deleted since being saved simply drops out of the list.
    if (!user) continue;

    const blocks = await loadPublicBlocks(user._id);
    // `locked` is stated explicitly on both branches so the saved list and the
    // search endpoint hand the client the same contract. toPublicProfessional
    // does not set it - the search route adds it inline - and an absent field
    // would leave the card component inferring the state.
    const card = unlocked
      ? { ...toPublicProfessional(user, blocks), locked: false }
      : toLockedProfessional(user, blocks);

    data.push({ ...card, saved: true, saved_at: row.created_at });
  }

  return {
    data,
    pagination: { total, page: safePage, pages: Math.ceil(total / safeLimit) || 1 }
  };
};

export default {
  findSaveableProfessional,
  saveProfessional,
  unsaveProfessional,
  listSavedIds,
  listSavedProfessionals
};
