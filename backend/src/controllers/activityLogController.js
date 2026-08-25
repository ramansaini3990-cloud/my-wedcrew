import ActivityLog, { ACTIVITY_CATEGORIES } from '../models/ActivityLog.js';
import { escapeRegex } from '../services/masterDataService.js';

/**
 * Admin-only activity log API.
 *
 * Mounted behind protect + admin, so every handler here is already restricted;
 * nothing in this file is reachable by a company or freelancer account.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

/** Resolves the ?range= filter to a created_at lower bound. */
const rangeToDate = (range) => {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '7d':
      return new Date(now.getTime() - 7 * 86400000);
    case '30d':
      return new Date(now.getTime() - 30 * 86400000);
    default:
      return null;
  }
};

/** Builds the mongo filter from validated query params. */
const buildQuery = (query) => {
  const filter = {};

  if (query.category && ACTIVITY_CATEGORIES.includes(query.category)) {
    filter.category = query.category;
  }
  if (query.event_type) {
    filter.event_type = String(query.event_type).slice(0, 60);
  }
  if (query.severity && ['info', 'success', 'warning', 'error'].includes(query.severity)) {
    filter.severity = query.severity;
  }

  const since = rangeToDate(query.range);
  if (since) filter.created_at = { $gte: since };

  const search = (query.search || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search.slice(0, 80)), 'i');
    filter.$or = [
      { title: rx },
      { description: rx },
      { 'actor.name': rx },
      { 'target.label': rx }
    ];
  }

  return filter;
};

/**
 * GET /api/admin/activity-logs
 * Query: page, limit, category, event_type, severity, range, search
 */
export const listActivityLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    // Server-side cap - a client cannot request thousands of rows.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = buildQuery(req.query);

    const [items, total] = await Promise.all([
      ActivityLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items.map((i) => ({ ...i, id: String(i._id) })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
        has_more: skip + items.length < total
      }
    });
  } catch (error) {
    console.error('listActivityLogs error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load activity.' });
  }
};

/** GET /api/admin/activity-logs/stats - counts for the summary strip. */
export const getActivityStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayTotal, byCategory] = await Promise.all([
      ActivityLog.countDocuments({ created_at: { $gte: startOfToday } }),
      ActivityLog.aggregate([
        { $match: { created_at: { $gte: startOfToday } } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    const counts = {};
    for (const row of byCategory) counts[row._id] = row.count;

    res.json({
      success: true,
      data: {
        today_total: todayTotal,
        users: counts.users || 0,
        subscriptions: counts.subscriptions || 0,
        payments: counts.payments || 0,
        bookings: counts.bookings || 0,
        requirements: counts.requirements || 0,
        messages: counts.messages || 0,
        admin: counts.admin || 0,
        total_all_time: await ActivityLog.estimatedDocumentCount()
      }
    });
  } catch (error) {
    console.error('getActivityStats error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load activity statistics.' });
  }
};

/** GET /api/admin/activity-logs/:id - detail drawer. */
export const getActivityLog = async (req, res) => {
  try {
    const entry = await ActivityLog.findById(req.params.id).lean().catch(() => null);
    if (!entry) {
      return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: 'Activity entry not found.' });
    }
    res.json({ success: true, data: { ...entry, id: String(entry._id) } });
  } catch (error) {
    console.error('getActivityLog error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load activity entry.' });
  }
};
