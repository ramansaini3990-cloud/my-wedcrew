import mongoose from 'mongoose';

const requirementSchema = new mongoose.Schema({
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  event_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true },
  payment_per_freelancer: { type: Number, required: true },
  number_of_days: { type: Number, required: true },
  event_type: { type: String },
  venue: { type: String },
  working_hours: { type: String },
  accommodation: { type: Boolean, default: false },
  travel: { type: Boolean, default: false },
  food: { type: Boolean, default: false },
  description: { type: String },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
  applications_count: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

requirementSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Requirement', requirementSchema);
