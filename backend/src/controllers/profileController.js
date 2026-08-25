import User from '../models/User.js';
import { resolveProfileMasterData } from '../services/masterDataService.js';
import { getUpcomingBlocks } from '../services/availabilityService.js';
import { logFromRequest } from '../services/activityService.js';

/**
 * Role-agnostic profile management for freelancers and companies.
 *
 * The legacy `/api/freelancer/profile` endpoints are untouched and keep working
 * (they also manage the day-calendar `availableDates`). This endpoint is the
 * canonical one for the extended profile: master-data references, bio,
 * experience, equipment, manual location and profile photo.
 *
 * A user can only ever read/write their OWN profile here.
 */

const PUBLIC_SAFE_FIELDS =
  'name email phone role city state profession profession_id state_id city_id profile_picture bio experience_years equipment manual_location needs_master_review created_at';

const serialise = (user) => ({
  id: String(user._id),
  role: user.role,
  name: user.name || '',
  email: user.email || '',
  phone: user.phone || '',

  // Master-data selections
  profession_id: user.profession_id ? String(user.profession_id._id || user.profession_id) : null,
  profession: user.profession_id?.name || user.profession || '',
  state_id: user.state_id ? String(user.state_id._id || user.state_id) : null,
  state: user.state_id?.name || user.state || '',
  city_id: user.city_id ? String(user.city_id._id || user.city_id) : null,
  city: user.city_id?.name || user.city || '',

  // Extended profile
  profile_picture: user.profile_picture || '',
  bio: user.bio || '',
  experience_years: user.experience_years ?? null,
  equipment: user.equipment || [],
  manual_location: {
    address: user.manual_location?.address || '',
    landmark: user.manual_location?.landmark || '',
    latitude: user.manual_location?.latitude ?? null,
    longitude: user.manual_location?.longitude ?? null,
    shared_from_device: Boolean(user.manual_location?.shared_from_device)
  },

  // True when a legacy value could not be mapped to master data.
  needs_master_review: Boolean(user.needs_master_review)
});

/** GET /api/profile/me */
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId)
      .select(PUBLIC_SAFE_FIELDS)
      .populate('profession_id', 'name is_active')
      .populate('state_id', 'name is_active')
      .populate('city_id', 'name is_active state_id');

    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Profile not found.' });

    const blocks = await getUpcomingBlocks(userId);

    res.json({
      success: true,
      data: {
        ...serialise(user),
        availability_blocks: blocks
      }
    });
  } catch (error) {
    console.error('getMyProfile error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load profile.' });
  }
};

/**
 * PUT /api/profile/me
 *
 * Accepts only whitelisted fields. Master-data IDs are re-validated server-side
 * (existence, active flag, and that the city belongs to the state) - the
 * frontend cascade is never trusted.
 */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Profile not found.' });

    const update = {};

    // ---- Plain profile fields -------------------------------------------
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Name cannot be empty.' });
      update.name = name;
    }
    if (req.body.phone !== undefined) {
      const phone = String(req.body.phone).trim();
      if (!phone) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Phone cannot be empty.' });
      const clash = await User.findOne({ phone, _id: { $ne: user._id } });
      if (clash) return res.status(409).json({ code: 'PHONE_IN_USE', message: 'That phone number is already registered.' });
      update.phone = phone;
    }
    if (req.body.bio !== undefined) update.bio = String(req.body.bio).slice(0, 2000);
    if (req.body.profile_picture !== undefined) update.profile_picture = String(req.body.profile_picture).trim();

    if (req.body.experience_years !== undefined) {
      if (req.body.experience_years === null || req.body.experience_years === '') {
        update.experience_years = undefined;
      } else {
        const years = Number(req.body.experience_years);
        if (!Number.isFinite(years) || years < 0 || years > 80) {
          return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Experience must be between 0 and 80 years.' });
        }
        update.experience_years = years;
      }
    }

    if (req.body.equipment !== undefined) {
      const list = Array.isArray(req.body.equipment) ? req.body.equipment : [];
      update.equipment = list.map((i) => String(i).trim()).filter(Boolean).slice(0, 50);
    }

    // ---- Manual / shared location ---------------------------------------
    if (req.body.manual_location !== undefined) {
      const loc = req.body.manual_location || {};
      const manual = {
        address: String(loc.address || '').trim().slice(0, 300),
        landmark: String(loc.landmark || '').trim().slice(0, 200),
        shared_from_device: Boolean(loc.shared_from_device)
      };

      const lat = loc.latitude === '' || loc.latitude === null || loc.latitude === undefined ? null : Number(loc.latitude);
      const lng = loc.longitude === '' || loc.longitude === null || loc.longitude === undefined ? null : Number(loc.longitude);

      if (lat !== null) {
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90.' });
        }
        manual.latitude = lat;
      }
      if (lng !== null) {
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180.' });
        }
        manual.longitude = lng;
      }
      update.manual_location = manual;
    }

    // ---- Master data (validated, never trusted from the client) ---------
    const wantsMasterUpdate =
      req.body.profession_id !== undefined ||
      req.body.state_id !== undefined ||
      req.body.city_id !== undefined;

    if (wantsMasterUpdate) {
      const resolved = await resolveProfileMasterData(
        {
          profession_id: req.body.profession_id,
          state_id: req.body.state_id,
          city_id: req.body.city_id
        },
        {
          current: {
            profession_id: user.profession_id,
            state_id: user.state_id,
            city_id: user.city_id
          }
        }
      );

      if (!resolved.ok) return res.status(400).json(resolved.error);
      Object.assign(update, resolved.values);

      // Changing the state invalidates a city that no longer belongs to it.
      if (update.state_id !== undefined && req.body.city_id === undefined && user.city_id) {
        const stillValid =
          update.state_id && String(user.city_id) && (await User.db.model('City').findOne({
            _id: user.city_id,
            state_id: update.state_id
          }));
        if (!stillValid) {
          update.city_id = null;
          update.city = '';
        }
      }

      // Once every value maps to master data, clear the migration flag.
      const nextProfession = update.profession_id !== undefined ? update.profession_id : user.profession_id;
      const nextState = update.state_id !== undefined ? update.state_id : user.state_id;
      const nextCity = update.city_id !== undefined ? update.city_id : user.city_id;
      if (nextProfession && nextState && nextCity) update.needs_master_review = false;
    }

    await User.updateOne({ _id: user._id }, { $set: update });

    const fresh = await User.findById(user._id)
      .select(PUBLIC_SAFE_FIELDS)
      .populate('profession_id', 'name is_active')
      .populate('state_id', 'name is_active')
      .populate('city_id', 'name is_active state_id');

    await logFromRequest(req, {
      eventType: 'profile.updated',
      category: 'profiles',
      title: 'Profile updated',
      description: `${fresh.name} updated their ${user.role} profile`,
      target: { type: 'user', id: user._id, label: fresh.name },
      metadata: {
        account_type: user.role,
        profession: update.profession || undefined,
        city: update.city || undefined,
        state: update.state || undefined
      }
    });

    res.json({ success: true, message: 'Profile updated successfully.', data: serialise(fresh) });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update profile.' });
  }
};
