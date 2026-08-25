import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { canChat, SUBSCRIPTION_ERRORS } from '../services/subscriptionService.js';
import { logFromRequest } from '../services/activityService.js';
import {
  getUnreadCountsByConversation,
  markConversationRead,
  countUnreadForConversation
} from '../services/chatUnreadService.js';

const idOf = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
};

/**
 * GET /api/chat/conversations
 *
 * Conversations always remain visible. When either participant lacks an active
 * chat subscription the conversation is flagged as locked and the last-message
 * preview is masked - the stored messages are never deleted.
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const conversations = await Conversation.find({
      $or: [{ company_id: userId }, { freelancer_id: userId }]
    })
      .populate('company_id', 'name email company_name profile_picture')
      .populate('freelancer_id', 'name email profession profile_picture')
      .populate('last_message')
      .sort({ last_message_at: -1 })
      .lean();

    // Unread counts for THIS user only - one aggregate for all conversations.
    // Another participant's unread state is never exposed.
    const unreadMap = await getUnreadCountsByConversation(
      conversations.map((c) => c._id),
      userId
    );

    for (const conv of conversations) {
      const companyId = idOf(conv.company_id);
      const freelancerId = idOf(conv.freelancer_id);
      const access = await canChat(companyId, freelancerId);

      conv.unread_count = unreadMap[String(conv._id)] || 0;

      conv.is_locked = !access.allowed;
      conv.lock_reason = access.reason;
      conv.company_has_chat = access.companyHasChat;
      conv.freelancer_has_chat = access.freelancerHasChat;
      // Tells the current user whether the block is on their side.
      conv.self_has_chat =
        companyId === String(userId) ? access.companyHasChat : access.freelancerHasChat;

      if (!access.allowed && conv.last_message) {
        conv.last_message.message = '🔒 Message Locked';
        if (conv.last_message.text) conv.last_message.text = '🔒 Message Locked';
      }
    }

    res.json(conversations);
  } catch (error) {
    console.error('getConversations error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load conversations' });
  }
};

/**
 * POST /api/chat/conversations
 *
 * Creating/opening a conversation requires an accepted application or an
 * accepted booking request. It deliberately does NOT require a subscription:
 * the conversation may exist while messaging stays locked (see getMessages).
 * Returns the existing conversation when one is already present so duplicates
 * are never created.
 */
export const createConversation = async (req, res) => {
  try {
    const { freelancer_id, company_id, requirement_id, proposal_id, booking_id } = req.body;
    const userId = (req.user.id || req.user._id).toString();

    if (!freelancer_id || !company_id) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'freelancer_id and company_id are required'
      });
    }

    if (userId !== String(freelancer_id) && userId !== String(company_id)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not a participant of this conversation'
      });
    }

    const Application = (await import('../models/Application.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;

    const acceptedApp = await Application.findOne({ freelancer_id, company_id, status: 'accepted' });
    const acceptedBooking = await BookingRequest.findOne({ freelancer_id, company_id, status: 'accepted' });

    if (!acceptedApp && !acceptedBooking) {
      return res.status(403).json({
        code: 'CHAT_NOT_UNLOCKED',
        message: 'Chat requires an accepted application or an accepted booking request.'
      });
    }

    // Duplicate protection - one conversation per company/freelancer pair.
    let conversation = await Conversation.findOne({ company_id, freelancer_id });
    let created = false;

    if (!conversation) {
      conversation = new Conversation({
        company_id,
        freelancer_id,
        requirement_id,
        proposal_id,
        booking_id
      });
      await conversation.save();
      created = true;
    }

    if (created) {
      await logFromRequest(req, {
        eventType: 'conversation.created',
        category: 'messages',
        title: 'New conversation created',
        description: 'A company and professional were connected',
        target: { type: 'conversation', id: conversation._id },
        metadata: { conversation_id: String(conversation._id) }
      });
    }

    const access = await canChat(company_id, freelancer_id);

    res.status(created ? 201 : 200).json({
      ...conversation.toObject(),
      id: conversation._id.toString(),
      is_locked: !access.allowed,
      lock_reason: access.reason
    });
  } catch (error) {
    console.error('createConversation error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to open conversation' });
  }
};

/**
 * GET /api/chat/conversations/:conversationId/messages
 *
 * Messages are only returned when BOTH participants hold an active
 * subscription whose plan includes chat. Otherwise a predictable
 * SUBSCRIPTION_REQUIRED payload is returned; the messages stay in the database
 * and become readable again the moment the subscription is reactivated.
 */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = (req.user.id || req.user._id).toString();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });
    }

    const companyId = conversation.company_id.toString();
    const freelancerId = conversation.freelancer_id.toString();

    if (companyId !== userId && freelancerId !== userId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not a participant of this conversation'
      });
    }

    const access = await canChat(companyId, freelancerId);

    if (!access.allowed) {
      return res.status(403).json({
        ...SUBSCRIPTION_ERRORS.CHAT_SUBSCRIPTION_REQUIRED,
        details: {
          company_has_chat: access.companyHasChat,
          freelancer_has_chat: access.freelancerHasChat,
          self_has_chat: companyId === userId ? access.companyHasChat : access.freelancerHasChat,
          reason: access.reason
        }
      });
    }

    const messages = await Message.find({ conversation_id: conversationId }).sort({ createdAt: 1 });

    // Opening a conversation marks the caller's received messages as read, so
    // the unread badge clears and stays cleared across refresh/login.
    await markConversationRead(conversationId, userId);

    res.json(messages);
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load messages' });
  }
};

/**
 * PATCH /api/chat/conversations/:conversationId/read
 *
 * Marks the caller's received messages in this conversation as read and returns
 * the resulting count. Used when a conversation is opened and when a message
 * arrives while the user is already viewing that conversation.
 *
 * Scoped to the caller: it can never clear another user's unread state, and it
 * never touches any other conversation.
 */
export const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = (req.user.id || req.user._id).toString();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });
    }

    const companyId = conversation.company_id.toString();
    const freelancerId = conversation.freelancer_id.toString();

    if (companyId !== userId && freelancerId !== userId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not a participant of this conversation'
      });
    }

    const marked = await markConversationRead(conversationId, userId);
    const unreadCount = await countUnreadForConversation(conversationId, userId);

    res.json({ success: true, conversation_id: String(conversationId), marked, unread_count: unreadCount });
  } catch (error) {
    console.error('markConversationAsRead error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update read state' });
  }
};
