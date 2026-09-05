import mongoose from 'mongoose';

/**
 * Singleton platform finance configuration.
 *
 * The platform fee is NEVER hardcoded in business logic - services read it
 * from here. Stored in basis points (1% = 100 bps) and paise so no float ever
 * enters a fee calculation.
 */
const financeSettingSchema = new mongoose.Schema({
  // Guarantees a single row: every write targets key 'default'.
  key: { type: String, default: 'default', unique: true, index: true },

  /** Platform commission, in basis points. 1000 = 10%. */
  fee_bps: { type: Number, default: 1000, min: 0, max: 10000 },
  /** Optional floor/ceiling on the fee, in paise. null = no ceiling. */
  min_fee_paise: { type: Number, default: 0, min: 0 },
  max_fee_paise: { type: Number, default: null },

  /** Smallest withdrawal a freelancer may request, in paise. */
  min_withdrawal_paise: { type: Number, default: 50000, min: 0 }, // ₹500

  currency: { type: String, default: 'INR' },

  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

/** Reads the config, creating the default row on first use. Never throws. */
financeSettingSchema.statics.current = async function current() {
  const existing = await this.findOne({ key: 'default' }).lean();
  if (existing) return existing;
  const created = await this.create({ key: 'default' });
  return created.toObject();
};

export default mongoose.model('FinanceSetting', financeSettingSchema);
