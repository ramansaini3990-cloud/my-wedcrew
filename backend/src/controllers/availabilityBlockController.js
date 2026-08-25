import AvailabilityBlock from '../models/AvailabilityBlock.js';
import {
  validateRange,
  findOverlappingBlocks,
  getUpcomingBlocks,
  AVAILABILITY_ERRORS
} from '../services/availabilityService.js';
import { resolveProfileMasterData, MASTER_ERRORS } from '../services/masterDataService.js';
import { logFromRequest } from '../services/activityService.js';

/**
 * Travel & Availability blocks - a user's own date-ranged, location-aware
 * availability. Users may only read and modify their own blocks.
 *
 * The existing single-day `Availability` calendar is untouched; this is the
 * complementary location layer.
 */

const formatOverlap = (blocks) =>
  blocks.slice(0, 3).map((b) => ({
    id: String(b._id),
    status: b.status,
    city: b.city || null,
    start_date: b.start_date,
    end_date: b.end_date
  }));

/** GET /api/availability/blocks - the caller's upcoming blocks. */
export const listMyBlocks = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const includePast = req.query.include_past === 'true';

    const blocks = includePast
      ? await AvailabilityBlock.find({ user_id: userId })
          .populate('state_id', 'name')
          .populate('city_id', 'name')
          .sort({ start_date: 1 })
      : await getUpcomingBlocks(userId);

    res.json({ success: true, data: blocks });
  } catch (error) {
    console.error('listMyBlocks error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load availability.' });
  }
};

/** Shared validation + master-data resolution for create and update. */
const buildBlockPayload = async (body, current = {}) => {
  const range = validateRange(body.start_date, body.end_date, body.status);
  if (!range.ok) return { ok: false, error: range.error };

  const payload = {
    start_date: range.start,
    end_date: range.end,
    status: body.status || current.status || 'available',
    notes: body.notes !== undefined ? String(body.notes).trim().slice(0, 500) : current.notes
  };

  // Location is optional, but when supplied it is validated exactly like a
  // profile location: active records, and the city must belong to the state.
  if (body.state_id !== undefined || body.city_id !== undefined) {
    const resolved = await resolveProfileMasterData(
      { state_id: body.state_id, city_id: body.city_id },
      { current: { state_id: current.state_id, city_id: current.city_id } }
    );
    if (!resolved.ok) return { ok: false, error: resolved.error };

    if (resolved.values.state_id !== undefined) {
      payload.state_id = resolved.values.state_id;
      payload.state = resolved.values.state || '';
    }
    if (resolved.values.city_id !== undefined) {
      payload.city_id = resolved.values.city_id;
      payload.city = resolved.values.city || '';
    }
  }

  if (body.manual_location !== undefined) {
    const loc = body.manual_location || {};
    const manual = {
      address: String(loc.address || '').trim().slice(0, 300),
      landmark: String(loc.landmark || '').trim().slice(0, 200)
    };
    const lat = loc.latitude === '' || loc.latitude == null ? null : Number(loc.latitude);
    const lng = loc.longitude === '' || loc.longitude == null ? null : Number(loc.longitude);
    if (lat !== null) {
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90.' } };
      }
      manual.latitude = lat;
    }
    if (lng !== null) {
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180.' } };
      }
      manual.longitude = lng;
    }
    payload.manual_location = manual;
  }

  return { ok: true, payload, start: range.start, end: range.end };
};

/** POST /api/availability/blocks */
export const createBlock = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const built = await buildBlockPayload(req.body);
    if (!built.ok) return res.status(400).json(built.error);

    const overlaps = await findOverlappingBlocks(userId, built.start, built.end);
    if (overlaps.length) {
      return res.status(409).json({
        ...AVAILABILITY_ERRORS.OVERLAP,
        message: `This period overlaps ${overlaps.length} existing block(s). Adjust the dates or edit the existing entry.`,
        conflicts: formatOverlap(overlaps)
      });
    }

    const block = await AvailabilityBlock.create({ user_id: userId, ...built.payload });
    const populated = await AvailabilityBlock.findById(block._id)
      .populate('state_id', 'name')
      .populate('city_id', 'name');

    await logFromRequest(req, {
      eventType: 'availability.published',
      category: 'profiles',
      title: 'Availability published',
      description: `${req.user.name || 'A professional'} published availability${built.payload.city ? ' in ' + built.payload.city : ''}`,
      target: { type: 'availability_block', id: block._id, label: built.payload.city || undefined },
      metadata: { availability_status: built.payload.status, city: built.payload.city || undefined, state: built.payload.state || undefined }
    });

    res.status(201).json({ success: true, message: 'Availability saved successfully.', data: populated });
  } catch (error) {
    console.error('createBlock error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to save availability.' });
  }
};

/** PUT /api/availability/blocks/:id */
export const updateBlock = async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const block = await AvailabilityBlock.findById(req.params.id).catch(() => null);
    if (!block) return res.status(404).json(AVAILABILITY_ERRORS.NOT_FOUND);
    if (String(block.user_id) !== userId) return res.status(403).json(AVAILABILITY_ERRORS.FORBIDDEN);

    const body = {
      start_date: req.body.start_date ?? block.start_date,
      end_date: req.body.end_date ?? block.end_date,
      ...req.body
    };

    const built = await buildBlockPayload(body, block);
    if (!built.ok) return res.status(400).json(built.error);

    const overlaps = await findOverlappingBlocks(userId, built.start, built.end, block._id);
    if (overlaps.length) {
      return res.status(409).json({
        ...AVAILABILITY_ERRORS.OVERLAP,
        message: `This period overlaps ${overlaps.length} other block(s).`,
        conflicts: formatOverlap(overlaps)
      });
    }

    Object.assign(block, built.payload);
    await block.save();

    const populated = await AvailabilityBlock.findById(block._id)
      .populate('state_id', 'name')
      .populate('city_id', 'name');

    res.json({ success: true, message: 'Availability updated.', data: populated });
  } catch (error) {
    console.error('updateBlock error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update availability.' });
  }
};

/** DELETE /api/availability/blocks/:id */
export const deleteBlock = async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const block = await AvailabilityBlock.findById(req.params.id).catch(() => null);
    if (!block) return res.status(404).json(AVAILABILITY_ERRORS.NOT_FOUND);
    if (String(block.user_id) !== userId) return res.status(403).json(AVAILABILITY_ERRORS.FORBIDDEN);

    await block.deleteOne();
    res.json({ success: true, message: 'Availability removed.' });
  } catch (error) {
    console.error('deleteBlock error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to remove availability.' });
  }
};

export { MASTER_ERRORS };
