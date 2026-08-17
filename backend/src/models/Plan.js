import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  billing_period: { type: String, enum: ['monthly', 'yearly', 'lifetime'], required: true },
  features: [{ type: String }],
  limits: { type: Map, of: Number },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Plan', planSchema);
