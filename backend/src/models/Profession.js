import mongoose from 'mongoose';

/**
 * Admin-managed profession / business-category master data.
 *
 * Users reference this by `profession_id`. The denormalised `profession` string
 * on User is kept in sync for backward compatibility with existing code and
 * data, so nothing that already reads `user.profession` breaks.
 */
const professionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  description: { type: String, trim: true },
  is_active: { type: Boolean, default: true, index: true },
  sort_order: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

professionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

professionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Profession', professionSchema);
