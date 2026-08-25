import mongoose from 'mongoose';

/**
 * Admin audit / activity stream.
 *
 * This is deliberately SEPARATE from `Notification`:
 *   Notification -> user-facing, per-recipient, read/unread, drives badges
 *   ActivityLog  -> admin-only system audit trail of business events
 *
 * Entries are written by services/activityService.js, which never throws, so a
 * logging failure can never roll back the business operation that triggered it.
 *
 * PRIVACY: this collection must never receive passwords, tokens, payment
 * credentials, message bodies, full phone numbers or email addresses. The
 * service strips unknown metadata keys against an allow-list before writing.
 */

export const ACTIVITY_CATEGORIES = [
  'users',
  'subscriptions',
  'payments',
  'bookings',
  'requirements',
  'applications',
  'messages',
  'profiles',
  'admin',
  'system'
];

export const ACTIVITY_SEVERITIES = ['info', 'success', 'warning', 'error'];

const activityLogSchema = new mongoose.Schema(
  {
    // Machine-readable event key, e.g. 'subscription.created'
    event_type: { type: String, required: true, index: true },
    category: { type: String, enum: ACTIVITY_CATEGORIES, required: true, index: true },

    // Human-readable summary shown in the admin stream
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },

    severity: { type: String, enum: ACTIVITY_SEVERITIES, default: 'info', index: true },

    // Who caused it. Name/role only - never contact details.
    actor: {
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
      name: { type: String, trim: true },
      role: { type: String, trim: true }
    },

    // What it happened to.
    target: {
      type: { type: String, trim: true, index: true },
      id: { type: mongoose.Schema.Types.ObjectId, index: true },
      label: { type: String, trim: true }
    },

    // Allow-listed, non-sensitive extras (plan name, city, amount, status...).
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

// Primary feed ordering, and the filtered variants the admin UI uses.
activityLogSchema.index({ created_at: -1 });
activityLogSchema.index({ category: 1, created_at: -1 });
activityLogSchema.index({ event_type: 1, created_at: -1 });
activityLogSchema.index({ 'actor.user_id': 1, created_at: -1 });
activityLogSchema.index({ 'target.type': 1, 'target.id': 1, created_at: -1 });

activityLogSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('ActivityLog', activityLogSchema);
