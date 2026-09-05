import mongoose from 'mongoose';

/**
 * A freelancer's request to move their available balance out of the platform.
 *
 * The money itself is moved by the payment provider's payout API (see
 * services/paymentProviderService.js). This record tracks the request's state
 * and holds the provider reference; it is not a wallet.
 *
 * Amounts are integer PAISE.
 */

export const WITHDRAWAL_STATUSES = [
  'REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED'
];

/** No transition out of these. */
export const WITHDRAWAL_TERMINAL = ['COMPLETED', 'CANCELLED', 'REVERSED'];

const withdrawalSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },

  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  payout_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PayoutAccount', required: true },

  amount_paise: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },

  status: { type: String, enum: WITHDRAWAL_STATUSES, default: 'REQUESTED', index: true },

  /** Copied at request time so history survives an account edit. */
  method: { type: String, required: true },
  masked_destination: { type: String, required: true },

  provider: { type: String, default: null },
  provider_payout_id: { type: String, default: null, index: true },

  failure_reason: { type: String, trim: true, maxlength: 300, default: null },
  admin_note: { type: String, trim: true, maxlength: 500, default: null },
  processed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completed_at: { type: Date, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

withdrawalSchema.index({ user_id: 1, created_at: -1 });
withdrawalSchema.index({ status: 1, created_at: -1 });

withdrawalSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; }
});

export default mongoose.model('Withdrawal', withdrawalSchema);
