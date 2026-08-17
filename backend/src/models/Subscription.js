import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan_name: { type: String, required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  amount: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  payment_status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  status: { type: String, enum: ['active', 'expired', 'paused', 'cancelled'], default: 'active' },
  autoRenew: { type: Boolean, default: false },
  source: { type: String, enum: ['ADMIN', 'RAZORPAY', 'SYSTEM'], default: 'SYSTEM' },
  payment_provider: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

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
