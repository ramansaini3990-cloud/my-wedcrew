import mongoose from 'mongoose';

/** Admin-managed state / union-territory master data. */
const stateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  country: { type: String, default: 'India', trim: true },
  is_active: { type: Boolean, default: true, index: true },
  sort_order: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

stateSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

stateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('State', stateSchema);
