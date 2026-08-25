import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import Conversation from './models/Conversation.js';
import User from './models/User.js';
import Notification from './models/Notification.js';
import { canChat, SUBSCRIPTION_ERRORS } from './services/subscriptionService.js';
import { countUnreadForConversation } from './services/chatUnreadService.js';
import { logActivity } from './services/activityService.js';

let io;
const userSockets = new Map(); // userId -> socketId

// Socket.IO room that only authenticated admins are placed into. Membership is
// decided server-side from the verified JWT role, so a non-admin can never
// subscribe to the admin activity stream.
const ADMIN_ROOM = 'admin:activity';

/**
 * Notifies a user that somebody tried to message them while their subscription
 * is inactive. De-duplicated per conversation so it cannot spam the inbox.
 */
const notifyLockedMessage = async (recipientId, senderId, conversationId) => {
  try {
    const [recipient, sender] = await Promise.all([
      User.findById(recipientId),
      User.findById(senderId)
    ]);
    if (!recipient) return;

    const existing = await Notification.findOne({
      recipient_id: recipientId,
      conversation_id: conversationId,
      type: 'locked_message',
      is_read: false
    });
    if (existing) return;

    const notification = new Notification({
      recipient_id: recipientId,
      recipient_role: recipient.role,
      type: 'locked_message',
      title: `New message from ${sender ? sender.name : 'a user'}`,
      message: 'An active subscription is required to view and reply.',
      conversation_id: conversationId,
      sender_id: senderId,
      subscription_required: true
    });
    await notification.save();
    emitNotification(recipientId, notification);
  } catch (error) {
    console.error('notifyLockedMessage error:', error);
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust to frontend URL in production
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);
    userSockets.set(socket.user.id, socket.id);

    // Admins additionally join the activity room.
    if (socket.user.role === 'admin') {
      socket.join(ADMIN_ROOM);
    }

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, text, receiverId, messageType, message: messageText } = data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) {
            callback({ success: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });
          }
          return;
        }

        const senderId = String(socket.user.id || socket.user._id);
        const companyId = conversation.company_id.toString();
        const freelancerId = conversation.freelancer_id.toString();

        // Only participants may post into a conversation.
        if (senderId !== companyId && senderId !== freelancerId) {
          if (callback) {
            callback({ success: false, code: 'FORBIDDEN', message: 'You are not a participant of this conversation' });
          }
          return;
        }

        // Same authority the REST layer uses - both sides must have chat.
        const access = await canChat(companyId, freelancerId);
        if (!access.allowed) {
          const blockedReceiverId = senderId === companyId ? freelancerId : companyId;
          const senderHasChat = senderId === companyId ? access.companyHasChat : access.freelancerHasChat;
          const receiverHasChat = senderId === companyId ? access.freelancerHasChat : access.companyHasChat;

          // The sender is subscribed but the other side is not: let them know
          // someone is trying to reach them so they can reactivate.
          if (senderHasChat && !receiverHasChat) {
            await notifyLockedMessage(blockedReceiverId, senderId, conversationId);
          }

          if (callback) {
            callback({
              success: false,
              ...SUBSCRIPTION_ERRORS.CHAT_SUBSCRIPTION_REQUIRED,
              details: {
                company_has_chat: access.companyHasChat,
                freelancer_has_chat: access.freelancerHasChat,
                self_has_chat: senderId === companyId ? access.companyHasChat : access.freelancerHasChat,
                reason: access.reason
              }
            });
          }
          return;
        }

        let finalMessage = text || messageText;
        if (typeof finalMessage === 'object') {
          finalMessage = finalMessage.text ? finalMessage.text : JSON.stringify(finalMessage);
        }
        if (!finalMessage || !String(finalMessage).trim()) {
          if (callback) {
            callback({ success: false, code: 'VALIDATION_ERROR', message: 'Message cannot be empty' });
          }
          return;
        }

        // Derive the receiver from the conversation rather than trusting the client.
        const resolvedReceiverId = senderId === companyId ? freelancerId : companyId;
        if (receiverId && String(receiverId) !== resolvedReceiverId) {
          console.warn(`send_message receiverId mismatch on conversation ${conversationId}; using conversation participants.`);
        }

        const message = new Message({
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: resolvedReceiverId,
          message: finalMessage,
          message_type: messageType || 'text',
          read_at: null
        });
        await message.save();

        await Conversation.findByIdAndUpdate(conversationId, {
          last_message: message._id,
          last_message_at: new Date()
        });

        io.to(conversationId).emit('receive_message', message);

        // Audit only that a message occurred - the body is never recorded.
        {
          const senderUser = await User.findById(senderId).select('name role');
          const targetUser = await User.findById(resolvedReceiverId).select('name');
          await logActivity({
            eventType: 'message.sent',
            category: 'messages',
            title: 'New message',
            description: `${senderUser?.name || 'A user'} → ${targetUser?.name || 'a user'}`,
            actor: { userId: senderId, name: senderUser?.name, role: senderUser?.role },
            target: { type: 'conversation', id: conversationId, label: targetUser?.name },
            metadata: { conversation_id: String(conversationId) }
          });
        }

        // Chat messages deliberately do NOT create a system Notification.
        // Unread state lives on the conversation (Message.read_at) and is
        // pushed to the recipient as a conversation-scoped socket event, so the
        // global Notifications badge stays reserved for booking/application/
        // subscription events.
        const receiverUser = await User.findById(resolvedReceiverId);
        if (receiverUser) {
          const receiverSocketId = userSockets.get(String(resolvedReceiverId));
          if (receiverSocketId) {
            // Server-computed absolute count - the client sets rather than
            // increments, so duplicate events or a socket reconnect can never
            // double-count.
            const unreadCount = await countUnreadForConversation(conversationId, resolvedReceiverId);
            io.to(receiverSocketId).emit('conversation_unread', {
              conversationId: String(conversationId),
              unreadCount,
              lastMessageAt: message.createdAt
            });
            // Retained for backward compatibility with existing listeners.
            io.to(receiverSocketId).emit('new_message_notification', message);
          }
        }

        if (callback) callback({ success: true, message });
      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('error', 'Failed to send message');
        if (callback) callback({ success: false, code: 'SERVER_ERROR', message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
      userSockets.delete(socket.user.id);
    });
  });
};

export const getIo = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

/**
 * Pushes a new activity entry to every connected admin.
 * Safe to call before Socket.IO is initialised (scripts, tests) - it no-ops.
 */
export const emitAdminActivity = (activity) => {
  if (!io || !activity) return;
  io.to(ADMIN_ROOM).emit('activity:new', activity);
};

export const emitNotification = (userId, notification) => {
  if (!io) return;
  const socketId = userSockets.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit('new_notification', notification);
  }
};
