import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema({
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requirement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  message: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

bookingRequestSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('BookingRequest', bookingRequestSchema);
