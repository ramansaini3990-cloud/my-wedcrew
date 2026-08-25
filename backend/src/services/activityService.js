import ActivityLog, { ACTIVITY_CATEGORIES } from '../models/ActivityLog.js';

/**
 * Writes admin activity entries.
 *
 * CONTRACT: `logActivity()` never throws and never rejects. Callers can invoke
 * it without a try/catch and without awaiting - a logging failure is swallowed
 * and reported to the server console, so it can never roll back or fail the
 * business operation that triggered it (subscription creation, booking, etc.).
 *
 * Events must be raised from trusted BACKEND business logic only, never from a
 * frontend action, so the stream cannot be forged or duplicated.
 */

/**
 * Metadata keys that are safe to persist. Anything else is dropped, so a
 * careless caller cannot leak a token, password, email or phone number into
 * the audit trail.
 */
const ALLOWED_METADATA_KEYS = new Set([
  'plan_name', 'plan_id', 'amount', 'currency', 'status', 'previous_status',
  'start_date', 'end_date', 'days', 'source',
  'city', 'state', 'profession', 'category', 'event_date', 'quantity',
  'requirement_id', 'application_id', 'booking_id', 'conversation_id',
  'subscription_id', 'availability_status', 'record_type', 'record_name',
  'account_type', 'reason', 'count'
]);

/** Values that must never be persisted regardless of key. */
const looksSensitive = (value) => {
  if (typeof value !== 'string') return false;
  return (
    value.includes('@') ||            // email address
    /^\$2[aby]\$/.test(value) ||      // bcrypt hash
    /^eyJ[\w-]+\./.test(value) ||     // JWT
    /^\d{10}$/.test(value)            // bare 10-digit phone number
  );
};

const sanitiseMetadata = (metadata = {}) => {
  const clean = {};
  if (!metadata || typeof metadata !== 'object') return clean;

  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (looksSensitive(value)) continue;
    clean[key] = value;
  }
  return clean;
};

/** Trims a display label and never lets a raw email through. */
const safeLabel = (value, fallback = null) => {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.includes('@') ? fallback : trimmed.slice(0, 120);
};

/**
 * Records one activity and pushes it to connected admins in real time.
 *
 * @returns {Promise<object|null>} the saved log, or null if logging failed
 */
export const logActivity = async ({
  eventType,
  category,
  title,
  description,
  severity = 'info',
  actor = {},
  target = {},
  metadata = {}
} = {}) => {
  try {
    if (!eventType || !title) return null;
    const safeCategory = ACTIVITY_CATEGORIES.includes(category) ? category : 'system';

    const entry = await ActivityLog.create({
      event_type: eventType,
      category: safeCategory,
      title: String(title).slice(0, 160),
      description: description ? String(description).slice(0, 500) : undefined,
      severity,
      actor: {
        user_id: actor.userId || undefined,
        name: safeLabel(actor.name, 'System'),
        role: actor.role || undefined
      },
      target: {
        type: target.type || undefined,
        id: target.id || undefined,
        label: safeLabel(target.label)
      },
      metadata: sanitiseMetadata(metadata)
    });

    // Push to admins. Imported lazily so this module stays usable in scripts
    // and tests where Socket.IO is not initialised.
    try {
      const { emitAdminActivity } = await import('../socket.js');
      emitAdminActivity(entry.toJSON());
    } catch (socketError) {
      console.error('activity: realtime emit skipped:', socketError.message);
    }

    return entry;
  } catch (error) {
    // Never propagate - business operations must succeed regardless.
    console.error('activity: failed to record event', eventType, '-', error.message);
    return null;
  }
};

/** Convenience wrapper for the common "actor did X" shape. */
export const logFromRequest = (req, payload) =>
  logActivity({
    ...payload,
    actor: {
      userId: req?.user?.id || req?.user?._id,
      name: req?.user?.name,
      role: req?.user?.role,
      ...(payload.actor || {})
    }
  });

export default { logActivity, logFromRequest };
