import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient_role: { type: String, enum: ['company', 'freelancer', 'admin'], required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  requirement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  subscription_required: { type: Boolean, default: false },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_read: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

notificationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Notification', notificationSchema);