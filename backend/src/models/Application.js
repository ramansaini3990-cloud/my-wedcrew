import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  requirement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposed_rate: { type: String, required: true },
  availability: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'shortlisted', 'accepted', 'rejected'], default: 'pending' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

applicationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

applicationSchema.index({ requirement_id: 1, freelancer_id: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);