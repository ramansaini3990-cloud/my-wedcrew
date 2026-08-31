import express from 'express';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import AvailabilityBlock, { BOOKABLE_STATUSES } from '../models/AvailabilityBlock.js';
import { escapeRegex } from '../services/masterDataService.js';
import { startOfDay } from '../services/availabilityService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import {
  PUBLIC_PROFESSIONAL_FIELDS,
  toPublicProfessional,
  toLockedProfessional,
  canViewProfessionalDetails,
  deriveCurrentAvailability,
  loadPublicBlocks
} from '../services/publicProfileService.js';

const router = express.Router();

/**
 * GET /api/public/freelancers/:id
 *
 * Public professional profile. Returns ONLY the allow-listed public DTO -
 * email, phone, manual address and coordinates are never included, regardless
 * of what the User document holds.
 */
router.get('/freelancers/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'freelancer' })
      .select(PUBLIC_PROFESSIONAL_FIELDS)
      .populate('profession_id', 'name')
      .populate('state_id', 'name')
      .populate('city_id', 'name')
      .lean()
      .catch(() => null);

    if (!user) {
      return res.status(404).json({ code: 'PROFESSIONAL_NOT_FOUND', message: 'Professional not found.' });
    }

    const blocks = await loadPublicBlocks(user._id);

    // Subscription gate. Without an active plan the identity fields are never
    // serialised, so they cannot be recovered from the response.
    const unlocked = await canViewProfessionalDetails(req.user, user._id);
    if (!unlocked) {
      return res.json({ success: true, data: toLockedProfessional(user, blocks) });
    }

    // Published open days from the existing day-calendar.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const openDays = await Availability.find({
      freelancer_id: user._id,
      status: 'available',
      date: { $gte: today }
    }).select('date').lean();

    res.json({
      success: true,
      data: {
        ...toPublicProfessional(user, blocks),
        available_dates: openDays.map((a) => {
          const d = new Date(a.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
      }
    });
  } catch (error) {
    console.error('Get Public Professional Error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Unable to load this profile.' });
  }
});

/**
 * GET /api/public/freelancers
 *
 * Public professional search. Backwards compatible: the original `city` /
 * `profession` string filters and the `{ data, pagination }` response shape are
 * unchanged. New optional filters:
 *
 *   profession_id, state_id, city_id   master-data filtering
 *   date (YYYY-MM-DD)                  availability on a specific day
 *   include_travel=false               restrict to base location only
 *
 * Location matching considers BOTH the base location and travel blocks:
 *
 *   1. base       - user.city_id matches
 *   2. travel     - an AvailabilityBlock in that city covers `date`
 *   3. blocked    - a non-bookable block covers `date` (excluded when a date
 *                   is supplied, so a BOOKED freelancer never shows as free)
 *
 * Privacy: exact coordinates and manual addresses are never returned here -
 * only the approximate "City, State".
 */
router.get('/freelancers', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const skip = (page - 1) * limit;

    const query = { role: 'freelancer' };

    // ---- Master-data filters (preferred) --------------------------------
    if (req.query.profession_id) query.profession_id = req.query.profession_id;
    if (req.query.state_id) query.state_id = req.query.state_id;

    // ---- Legacy string filters (kept for backward compatibility) --------
    const cityFilter = (req.query.city || '').trim();
    const professionFilter = (req.query.profession || '').trim();
    if (cityFilter && !req.query.city_id) {
      query.city = new RegExp(`^${escapeRegex(cityFilter)}$`, 'i');
    }
    if (professionFilter && !req.query.profession_id) {
      query.profession = new RegExp(escapeRegex(professionFilter), 'i');
    }

    const cityId = req.query.city_id || null;
    const searchDate = req.query.date ? startOfDay(req.query.date) : null;
    const includeTravel = req.query.include_travel !== 'false';

    /* ---------------------------------------------------------------- */
    /* Location + availability resolution                                */
    /* ---------------------------------------------------------------- */
    let travelUserIds = [];
    let blockedUserIds = [];

    if (cityId || searchDate) {
      // Users temporarily available in the requested city on that date.
      if (cityId && includeTravel) {
        const travelQuery = { city_id: cityId, status: { $in: BOOKABLE_STATUSES } };
        if (searchDate) {
          travelQuery.start_date = { $lte: searchDate };
          travelQuery.end_date = { $gte: searchDate };
        }
        const travelBlocks = await AvailabilityBlock.find(travelQuery).select('user_id').lean();
        travelUserIds = travelBlocks.map((b) => String(b.user_id));
      }

      // Users who are NOT bookable on that date (anywhere) must be excluded.
      if (searchDate) {
        const blocked = await AvailabilityBlock.find({
          start_date: { $lte: searchDate },
          end_date: { $gte: searchDate },
          status: { $nin: BOOKABLE_STATUSES }
        }).select('user_id').lean();
        blockedUserIds = blocked.map((b) => String(b.user_id));
      }
    }

    if (cityId) {
      // Base location in that city OR travelling there.
      const orClauses = [{ city_id: cityId }];
      if (travelUserIds.length) orClauses.push({ _id: { $in: travelUserIds } });
      query.$or = orClauses;
    }

    if (blockedUserIds.length) {
      // Someone travelling INTO the searched city with a bookable block should
      // not be removed by a different, non-bookable block elsewhere.
      const excluded = blockedUserIds.filter((id) => !travelUserIds.includes(id));
      if (excluded.length) query._id = { ...(query._id || {}), $nin: excluded };
    }

    const users = await User.find(query)
      .select('id name city state profession profession_id state_id city_id profile_picture bio experience_years created_at')
      .populate('profession_id', 'name')
      .populate('state_id', 'name')
      .populate('city_id', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // ---- Day-calendar availability (existing behaviour, unchanged) ------
    const freelancerIds = users.map((u) => u._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availabilityData = await Availability.find({
      freelancer_id: { $in: freelancerIds },
      status: 'available',
      date: { $gte: today }
    }).lean();

    const availabilityMap = {};
    for (const a of availabilityData) {
      const fId = a.freelancer_id.toString();
      if (!availabilityMap[fId]) availabilityMap[fId] = [];
      const d = new Date(a.date);
      availabilityMap[fId].push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }

    // ---- ALL current/upcoming blocks --------------------------------
    // Current status must reflect non-bookable blocks too, so a BOOKED
    // professional reads "Booked" rather than falling back to "unknown".
    const allBlocks = await AvailabilityBlock.find({
      user_id: { $in: freelancerIds },
      end_date: { $gte: today }
    })
      .populate('city_id', 'name')
      .populate('state_id', 'name')
      .select('user_id start_date end_date status city_id state_id city state')
      .lean();

    const allBlocksByUser = {};
    for (const b of allBlocks) {
      const key = String(b.user_id);
      if (!allBlocksByUser[key]) allBlocksByUser[key] = [];
      allBlocksByUser[key].push(b);
    }

    // ---- Upcoming BOOKABLE blocks, for "Available in Jaipur - 4-8 Sept" -
    const upcomingBlocks = await AvailabilityBlock.find({
      user_id: { $in: freelancerIds },
      end_date: { $gte: today },
      status: { $in: BOOKABLE_STATUSES }
    })
      .populate('city_id', 'name')
      .populate('state_id', 'name')
      .select('user_id start_date end_date status city_id state_id city state')
      .lean();

    const blocksByUser = {};
    for (const b of upcomingBlocks) {
      const key = String(b.user_id);
      if (!blocksByUser[key]) blocksByUser[key] = [];
      blocksByUser[key].push({
        start_date: b.start_date,
        end_date: b.end_date,
        status: b.status,
        // Approximate location only - never coordinates or manual addresses.
        city: b.city_id?.name || b.city || null,
        state: b.state_id?.name || b.state || null
      });
    }

    const travelSet = new Set(travelUserIds);

    // One subscription check for the whole page, not per row.
    const unlocked = await canViewProfessionalDetails(req.user);

    const formattedUsers = users.map((u) => {
      const fId = u.id || u._id.toString();

      // Locked callers get the masked shape - identity fields are dropped here,
      // on the server, rather than hidden by the client.
      if (!unlocked) {
        return {
          ...toLockedProfessional(u, allBlocksByUser[fId] || []),
          _id: u._id,
          available_dates: availabilityMap[fId] ? availabilityMap[fId].join(',') : null,
          upcoming_availability: blocksByUser[fId] || [],
          match_type: cityId ? (String(u.city_id?._id || u.city_id) === String(cityId) ? 'base' : travelSet.has(fId) ? 'travel' : 'base') : 'base'
        };
      }

      return {
        ...u,
        locked: false,
        profession: u.profession_id?.name || u.profession || null,
        state: u.state_id?.name || u.state || null,
        city: u.city_id?.name || u.city || null,
        profession_id: u.profession_id?._id ? String(u.profession_id._id) : null,
        state_id: u.state_id?._id ? String(u.state_id._id) : null,
        city_id: u.city_id?._id ? String(u.city_id._id) : null,
        available_dates: availabilityMap[fId] ? availabilityMap[fId].join(',') : null,
        upcoming_availability: blocksByUser[fId] || [],
        // Real availability for today, derived from published blocks only.
        current_availability: deriveCurrentAvailability(allBlocksByUser[fId] || []),
        // How this result matched the searched location.
        match_type: cityId ? (String(u.city_id?._id || u.city_id) === String(cityId) ? 'base' : travelSet.has(fId) ? 'travel' : 'base') : 'base'
      };
    });

    // Base-location matches rank above travelling professionals.
    if (cityId) {
      formattedUsers.sort((a, b) => (a.match_type === 'base' ? -1 : 1) - (b.match_type === 'base' ? -1 : 1));
    }

    const total = await User.countDocuments(query);

    res.json({
      data: formattedUsers,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Public Freelancers Error:', error);
    res.status(500).json({ message: 'Server error retrieving freelancers' });
  }
});

export default router;
