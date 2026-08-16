import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['available', 'booked', 'tentative'], default: 'available' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

availabilitySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Availability', availabilitySchema);
