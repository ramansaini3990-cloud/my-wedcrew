import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { hasFeature } from '../services/subscriptionService.js';
import User from '../models/User.js';

export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    // Find where the user is either company or freelancer
    const conversations = await Conversation.find({ 
      $or: [{ company_id: userId }, { freelancer_id: userId }] 
    })
      .populate('company_id', 'name email company_name profile_picture')
      .populate('freelancer_id', 'name email profession profile_picture')
      .populate('last_message')
      .sort({ last_message_at: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { freelancer_id, company_id, requirement_id, proposal_id, booking_id } = req.body;
    const userId = req.user.id || req.user._id;
    
    // Authorization check
    if (userId.toString() !== freelancer_id && userId.toString() !== company_id) {
      return res.status(403).json({ message: 'Unauthorized to create this conversation' });
    }

    const hasChat = await hasFeature(userId, 'chat');
    if (!hasChat) {
      return res.status(403).json({ message: 'Active subscription with chat feature required' });
    }

    let conversation = await Conversation.findOne({
      company_id,
      freelancer_id,
      requirement_id: requirement_id || { $exists: false }
    });

    if (!conversation) {
      conversation = new Conversation({
        company_id,
        freelancer_id,
        requirement_id,
        proposal_id,
        booking_id
      });
      await conversation.save();
    }

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id || req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    
    if (conversation.company_id.toString() !== userId.toString() && conversation.freelancer_id.toString() !== userId.toString()) {
       return res.status(403).json({ message: 'Unauthorized access to conversation' });
    }

    const messages = await Message.find({ conversation_id: conversationId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
