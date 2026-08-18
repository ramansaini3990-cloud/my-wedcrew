import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  billing_period: { type: String, enum: ['monthly', 'yearly', 'lifetime'], required: true },

  // Feature keys checked by subscriptionService.hasFeature(), e.g. 'chat'.
  features: [{ type: String }],

  // Numeric caps read by subscriptionService.getLimit(), e.g. { applications: 5 }.
  limits: { type: Map, of: Number, default: {} },

  // `is_active` alias keeps the documented field name available without
  // migrating existing documents that already use `isActive`.
  isActive: { type: Boolean, default: true, alias: 'is_active' },

  // Controls ordering in the admin UI (FREE < PRO < PREMIUM).
  sort_order: { type: Number, default: 0 }
}, { timestamps: true });

planSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Plan', planSchema);
