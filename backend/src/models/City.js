import mongoose from 'mongoose';

/**
 * Admin-managed city master data. Every city belongs to exactly one state, and
 * the backend validates that relationship on every profile write - the frontend
 * cascade is a convenience, never the authority.
 */
const citySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true, index: true },
  state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true, index: true },
  is_active: { type: Boolean, default: true, index: true },
  sort_order: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// A city name is unique WITHIN a state (many states have a "Bijapur").
citySchema.index({ state_id: 1, slug: 1 }, { unique: true });

citySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('City', citySchema);
