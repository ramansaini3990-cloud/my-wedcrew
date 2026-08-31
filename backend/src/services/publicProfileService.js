import AvailabilityBlock, { BOOKABLE_STATUSES } from '../models/AvailabilityBlock.js';
import { hasActiveSubscription } from './subscriptionService.js';

/**
 * Public-safe serialisation for professional profiles.
 *
 * This is the ONLY shape returned by public endpoints. It is an allow-list, not
 * a deny-list: adding a private field to the User model can never accidentally
 * leak, because anything not named here is simply never copied.
 *
 * Deliberately EXCLUDED:
 *   email, phone, password, manual_location (address/landmark/coordinates),
 *   needs_master_review, role, subscription data, timestamps of internal use.
 */

/** Fields safe to `.select()` from the User collection for public consumption. */
export const PUBLIC_PROFESSIONAL_FIELDS =
  'name city state profession profession_id state_id city_id profile_picture bio experience_years equipment created_at';

const startOfToday = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Derives the professional's availability status for "today" from their
 * availability blocks. Falls back to `unknown` when nothing is published -
 * a base city is never treated as a statement of availability.
 */
export const deriveCurrentAvailability = (blocks = []) => {
  const today = startOfToday();
  const active = blocks.find(
    (b) => new Date(b.start_date) <= today && new Date(b.end_date) >= today
  );
  if (!active) return { status: 'unknown', city: null, state: null };

  return {
    status: active.status,
    // Approximate location only.
    city: active.city_id?.name || active.city || null,
    state: active.state_id?.name || active.state || null,
    start_date: active.start_date,
    end_date: active.end_date
  };
};

/** Upcoming bookable blocks, approximate location only. */
export const serialiseUpcoming = (blocks = []) => {
  const today = startOfToday();
  return blocks
    .filter((b) => new Date(b.end_date) >= today)
    .map((b) => ({
      start_date: b.start_date,
      end_date: b.end_date,
      status: b.status,
      city: b.city_id?.name || b.city || null,
      state: b.state_id?.name || b.state || null,
      is_bookable: BOOKABLE_STATUSES.includes(b.status)
    }));
};

/**
 * Builds the public DTO for one professional.
 * @param {object} user   lean User document selected with PUBLIC_PROFESSIONAL_FIELDS
 * @param {Array}  blocks their availability blocks (populated city/state)
 */
export const toPublicProfessional = (user, blocks = []) => {
  if (!user) return null;

  const upcoming = serialiseUpcoming(blocks);

  return {
    id: String(user._id || user.id),
    name: user.name || null,
    profile_picture: user.profile_picture || null,

    profession: user.profession_id?.name || user.profession || null,
    profession_id: user.profession_id?._id ? String(user.profession_id._id) : null,

    // Approximate location only - never the manual address or coordinates.
    city: user.city_id?.name || user.city || null,
    state: user.state_id?.name || user.state || null,
    city_id: user.city_id?._id ? String(user.city_id._id) : null,
    state_id: user.state_id?._id ? String(user.state_id._id) : null,

    bio: user.bio || null,
    experience_years: typeof user.experience_years === 'number' ? user.experience_years : null,
    equipment: Array.isArray(user.equipment) ? user.equipment : [],

    current_availability: deriveCurrentAvailability(blocks),
    upcoming_availability: upcoming,

    member_since: user.created_at || null
  };
};

/** Loads a user's availability blocks with populated (public) location names. */
export const loadPublicBlocks = async (userId) =>
  AvailabilityBlock.find({ user_id: userId, end_date: { $gte: startOfToday() } })
    .populate('city_id', 'name')
    .populate('state_id', 'name')
    .select('start_date end_date status city_id state_id city state')
    .sort({ start_date: 1 })
    .lean();

/**
 * Decides whether the caller may see identifying professional details.
 *
 * Mirrors the masking rule the requirements API already uses: an active
 * subscription unlocks the full view. Admins and the professional themselves
 * are always unlocked.
 *
 * @param {object|undefined} user  req.user from optionalAuth (may be absent)
 * @param {string} [professionalId] when checking a single profile
 */
export const canViewProfessionalDetails = async (user, professionalId = null) => {
  if (!user) return false;                       // anonymous visitor
  if (user.role === 'admin') return true;        // platform operator
  if (professionalId && String(user.id || user._id) === String(professionalId)) return true; // own profile
  return hasActiveSubscription(user.id || user._id);
};

/**
 * Masked DTO for callers without an active subscription.
 *
 * The professional's IDENTITY is removed server-side - name, photo, bio and
 * equipment are never serialised, so they cannot be recovered from the network
 * response, DevTools or by disabling frontend checks. What remains is enough to
 * show that a matching professional exists (craft, area, availability).
 */
export const toLockedProfessional = (user, blocks = []) => {
  if (!user) return null;

  return {
    id: String(user._id || user.id),
    locked: true,

    // Identity withheld.
    name: null,
    profile_picture: null,
    bio: null,
    equipment: [],

    // Non-identifying discovery data stays visible.
    profession: user.profession_id?.name || user.profession || null,
    profession_id: user.profession_id?._id ? String(user.profession_id._id) : null,
    city: user.city_id?.name || user.city || null,
    state: user.state_id?.name || user.state || null,
    city_id: user.city_id?._id ? String(user.city_id._id) : null,
    state_id: user.state_id?._id ? String(user.state_id._id) : null,
    experience_years: typeof user.experience_years === 'number' ? user.experience_years : null,

    current_availability: deriveCurrentAvailability(blocks),
    upcoming_availability: serialiseUpcoming(blocks),

    lock_reason: 'SUBSCRIPTION_REQUIRED'
  };
};

export default {
  PUBLIC_PROFESSIONAL_FIELDS,
  canViewProfessionalDetails,
  toLockedProfessional,
  toPublicProfessional,
  deriveCurrentAvailability,
  serialiseUpcoming,
  loadPublicBlocks
};
