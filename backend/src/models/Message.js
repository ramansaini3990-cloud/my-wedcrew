import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  message_type: { type: String, enum: ['text', 'system'], default: 'text' },
  read_at: { type: Date }
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
