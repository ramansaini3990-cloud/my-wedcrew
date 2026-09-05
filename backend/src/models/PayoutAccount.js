import mongoose from 'mongoose';

/**
 * A freelancer's payout destination.
 *
 * DELIBERATELY MINIMAL. We store only what is needed to identify the account
 * to the payment provider, plus a masked display string. In particular:
 *
 *   - the full account number is NEVER returned by any API (see maskedView)
 *   - no CVV / card data / netbanking credential is stored, ever
 *   - when the provider supports tokenised accounts, `provider_account_id` is
 *     the reference actually used for payouts and the raw fields become
 *     redundant
 *
 * One active account per freelancer keeps payout routing unambiguous.
 */

export const PAYOUT_METHODS = ['bank', 'upi'];

const payoutAccountSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: PAYOUT_METHODS, required: true },

  account_holder_name: { type: String, trim: true, maxlength: 120 },

  /**
   * Stored for provider submission only. `select: false` means it is never
   * returned unless a query explicitly asks, so it cannot leak through a
   * routine find().
   */
  account_number: { type: String, trim: true, select: false, default: null },
  ifsc: { type: String, trim: true, uppercase: true, default: null },
  upi_id: { type: String, trim: true, select: false, default: null },

  /** Safe to display: "XXXXXX1234" or "ra****@upi". */
  masked: { type: String, required: true },

  /** Provider-side token/fund-account reference, once linked. */
  provider: { type: String, default: null },
  provider_account_id: { type: String, default: null },

  is_active: { type: Boolean, default: true, index: true },
  verified: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

payoutAccountSchema.index({ user_id: 1, is_active: 1 });

/** The ONLY shape an API may return. Raw identifiers never appear. */
payoutAccountSchema.methods.publicView = function publicView() {
  return {
    id: String(this._id),
    method: this.method,
    account_holder_name: this.account_holder_name || '',
    masked: this.masked,
    ifsc: this.ifsc || null,
    verified: Boolean(this.verified),
    is_active: Boolean(this.is_active),
    created_at: this.created_at
  };
};

export default mongoose.model('PayoutAccount', payoutAccountSchema);
