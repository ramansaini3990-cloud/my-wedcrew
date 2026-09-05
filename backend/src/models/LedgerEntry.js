import mongoose from 'mongoose';

/**
 * Append-only financial ledger.
 *
 * Entries are NEVER updated or deleted. A correction is a new entry (an
 * ADJUSTMENT or a REVERSAL), so the history of what the platform believed at
 * any point in time is always recoverable.
 *
 * Balances are DERIVED by summing entries (see ledgerService), never stored on
 * a user document where they could drift from the transactions that produced
 * them.
 *
 * Amounts are integer PAISE, signed from the point of view of `user_id`:
 *   positive = money owed to / received by that user
 *   negative = money leaving that user
 */

export const LEDGER_TYPES = [
  'DEPOSIT',
  'BOOKING_PAYMENT',
  'PLATFORM_FEE',
  'FREELANCER_EARNING',
  'WITHDRAWAL',
  'REFUND',
  'CASH_PAYMENT',
  'CASH_CONFIRMATION',
  'ADJUSTMENT',
  'REVERSAL'
];

const ledgerEntrySchema = new mongoose.Schema({
  /** Unique per financial event; the idempotency anchor for the whole ledger. */
  transaction_id: { type: String, required: true, unique: true, index: true },

  type: { type: String, enum: LEDGER_TYPES, required: true, index: true },

  /** Whose balance this entry moves. */
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  user_role: { type: String, enum: ['company', 'freelancer', 'admin', 'platform'], required: true },

  /** Counterparties, for reporting. */
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', index: true },
  withdrawal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal', index: true },
  booking_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest' },

  /** Signed, integer paise. */
  amount_paise: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  /**
   * Does this entry count toward a freelancer's WITHDRAWABLE balance?
   * Earnings from a disputed cash payment are recorded but not available.
   */
  available: { type: Boolean, default: true, index: true },

  method: { type: String, default: null },
  provider: { type: String, default: null },
  provider_reference: { type: String, default: null },

  description: { type: String, trim: true, maxlength: 300 },
  /** Set when this entry reverses an earlier one. */
  reverses_transaction_id: { type: String, default: null, index: true },

  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
  // Financial history is immutable: there is no updated_at because nothing
  // is ever updated.
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Balance derivation reads by (user, available) and sums amounts.
ledgerEntrySchema.index({ user_id: 1, available: 1, type: 1 });
ledgerEntrySchema.index({ user_id: 1, created_at: -1 });

/** Blocks accidental mutation of financial history at the model level. */
const refuseMutation = function refuseMutation(next) {
  next(new Error('Ledger entries are immutable. Post an ADJUSTMENT or REVERSAL instead.'));
};
ledgerEntrySchema.pre('updateOne', refuseMutation);
ledgerEntrySchema.pre('updateMany', refuseMutation);
ledgerEntrySchema.pre('findOneAndUpdate', refuseMutation);
ledgerEntrySchema.pre('deleteOne', refuseMutation);
ledgerEntrySchema.pre('deleteMany', refuseMutation);

ledgerEntrySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; }
});

export default mongoose.model('LedgerEntry', ledgerEntrySchema);
