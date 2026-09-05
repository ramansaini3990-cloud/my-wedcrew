import mongoose from 'mongoose';

/**
 * One row per transactional email attempt.
 *
 * METADATA ONLY. This collection deliberately stores NO verification token, NO
 * verification URL and NO message body — an admin reading the log must not be
 * able to take over an account from it, and a database dump must not contain
 * live credentials. The same discipline as the `select: false` payout
 * identifiers on PayoutAccount.
 *
 * Written by emailService.recordAttempt(); a write failure there is swallowed
 * so logging can never break sending.
 */

export const EMAIL_STATUSES = ['SENT', 'FAILED'];

const emailLogSchema = new mongoose.Schema(
  {
    /** Recipient address. Needed to answer "did this user get their mail?". */
    to: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },

    /** Which template was used, e.g. "verification". */
    template: { type: String, required: true, trim: true, index: true },

    /** Adapter that handled it: console | brevo. */
    provider: { type: String, required: true, trim: true },

    status: { type: String, enum: EMAIL_STATUSES, required: true, index: true },

    /** Coarse provider reason on failure. Never contains the link or token. */
    error_message: { type: String, trim: true, maxlength: 300, default: null },

    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }
  },
  {
    // Send history is a fact about the past; nothing updates a row.
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

// "Newest first", the only ordering the admin page uses.
emailLogSchema.index({ created_at: -1 });

/**
 * Automatic cleanup: MongoDB drops each row 90 days after it is written, so
 * this collection cannot grow unbounded.
 *
 * Note: a TTL index is applied by a background thread roughly once a minute,
 * so deletion is eventual rather than exact. If TTL is ever unavailable on the
 * deployment tier, the manual equivalent is:
 *   db.emaillogs.deleteMany({ created_at: { $lt: <90 days ago> } })
 */
emailLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

emailLogSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('EmailLog', emailLogSchema);
