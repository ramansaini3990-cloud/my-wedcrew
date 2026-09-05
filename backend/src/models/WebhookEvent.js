import mongoose from 'mongoose';

/**
 * Every provider webhook we accept, recorded once.
 *
 * Payment providers retry webhooks until they get a 2xx, so the same event
 * WILL arrive more than once. The unique index on (provider, event_id) is what
 * makes processing idempotent: a duplicate insert fails, and the handler
 * returns 200 without re-applying any financial effect.
 *
 * The raw payload is kept for reconciliation, minus anything sensitive - the
 * signature header and secrets are never stored.
 */
const webhookEventSchema = new mongoose.Schema({
  provider: { type: String, required: true, index: true },
  /** The provider's own event id. */
  event_id: { type: String, required: true },
  event_type: { type: String, required: true, index: true },

  signature_valid: { type: Boolean, required: true },
  processed: { type: Boolean, default: false, index: true },
  process_error: { type: String, default: null },

  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  withdrawal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal', default: null },

  /** Trimmed payload for audit. Never contains headers or secrets. */
  payload: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// The idempotency guarantee.
webhookEventSchema.index({ provider: 1, event_id: 1 }, { unique: true });

export default mongoose.model('WebhookEvent', webhookEventSchema);
