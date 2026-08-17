import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requirement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  proposal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  last_message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  last_message_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Conversation', conversationSchema);
