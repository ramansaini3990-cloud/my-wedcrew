import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan_name: { type: String, required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  amount: { type: Number, required: true },

  // `started_at` / `expires_at` are aliases so future payment code can use the
  // gateway-friendly names without migrating existing documents.
  start_date: { type: Date, required: true, alias: 'started_at' },
  end_date: { type: Date, required: true, alias: 'expires_at' },

  payment_status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  status: { type: String, enum: ['active', 'expired', 'paused', 'cancelled'], default: 'active' },
  autoRenew: { type: Boolean, default: false },

  // --- Payment-ready fields (unused while source === 'ADMIN') ---
  // 'RAZORPAY' is retained for backward compatibility with existing documents.
  source: { type: String, enum: ['ADMIN', 'PAYMENT', 'RAZORPAY', 'SYSTEM'], default: 'SYSTEM' },
  payment_provider: { type: String },
  payment_id: { type: String },
  transaction_id: { type: String },

  cancelled_at: { type: Date },
  notes: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

subscriptionSchema.index({ user_id: 1, status: 1, end_date: -1 });

subscriptionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Subscription', subscriptionSchema);
