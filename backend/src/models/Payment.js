import mongoose from 'mongoose';

/**
 * One payment from a company to a freelancer for a booking.
 *
 * Covers BOTH methods - `method: 'online'` goes through the payment provider,
 * `method: 'cash'` is settled offline and confirmed by the freelancer. They
 * share one model because they share one lifecycle, one ledger and one UI;
 * a separate CashPayment collection would duplicate every query.
 *
 * Amounts are integer PAISE. See services/money.js.
 *
 * This record is the payment's STATE. The immutable history of what happened
 * to it lives in LedgerEntry.
 */

export const PAYMENT_METHODS = ['online', 'cash'];

/** Online lifecycle. */
export const ONLINE_STATUSES = [
  'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED',
  'REFUND_REQUESTED', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED'
];

/** Cash lifecycle. */
export const CASH_STATUSES = [
  'CASH_PENDING', 'CASH_CONFIRMED', 'CASH_DISPUTED', 'CASH_CANCELLED',
  'CASH_REFUND_REQUESTED', 'CASH_REFUND_CONFIRMED'
];

export const PAYMENT_STATUSES = [...ONLINE_STATUSES, ...CASH_STATUSES];

/** Statuses that mean the freelancer has actually earned the money. */
export const EARNED_STATUSES = ['SUCCESS', 'CASH_CONFIRMED'];

/** Terminal statuses - no further transition is allowed. */
export const TERMINAL_STATUSES = ['REFUNDED', 'CANCELLED', 'CASH_CANCELLED', 'CASH_REFUND_CONFIRMED'];

const paymentSchema = new mongoose.Schema({
  /** Public, human-quotable reference. Unique. */
  reference: { type: String, required: true, unique: true, index: true },

  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  /** Existing models - payments attach to them, they are never replaced. */
  booking_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest', index: true },
  requirement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', index: true },

  method: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, index: true },

  // ---- Money, all integer paise -------------------------------------
  amount_paise: { type: Number, required: true, min: 1 },
  fee_paise: { type: Number, required: true, min: 0, default: 0 },
  net_paise: { type: Number, required: true, min: 0, default: 0 },
  /** Fee rate captured at creation, so historical rows survive a config change. */
  fee_bps_applied: { type: Number, required: true, min: 0, default: 0 },
  currency: { type: String, default: 'INR' },

  // ---- Provider references (online only) ----------------------------
  provider: { type: String, default: null },
  provider_order_id: { type: String, default: null, index: true },
  provider_payment_id: { type: String, default: null, index: true },
  provider_refund_id: { type: String, default: null },

  /** Caller-supplied key that makes payment creation safe to retry. */
  idempotency_key: { type: String, default: null },

  // ---- Cash settlement ----------------------------------------------
  cash_confirmed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cash_confirmed_at: { type: Date, default: null },
  dispute_reason: { type: String, trim: true, maxlength: 500, default: null },
  dispute_resolution: { type: String, trim: true, maxlength: 500, default: null },
  dispute_resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dispute_resolved_at: { type: Date, default: null },

  refund_reason: { type: String, trim: true, maxlength: 500, default: null },
  failure_reason: { type: String, trim: true, maxlength: 300, default: null },
  note: { type: String, trim: true, maxlength: 500, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// "This company's payments, newest first" and the freelancer equivalent.
paymentSchema.index({ company_id: 1, created_at: -1 });
paymentSchema.index({ freelancer_id: 1, status: 1, created_at: -1 });
// Retrying a create with the same key must not produce a second payment.
paymentSchema.index(
  { company_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: 'string' } } }
);

paymentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; }
});

export default mongoose.model('Payment', paymentSchema);
