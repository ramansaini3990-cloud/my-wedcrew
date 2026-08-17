import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import Conversation from './models/Conversation.js';
import { hasFeature } from './services/subscriptionService.js';

let io;
const userSockets = new Map(); // userId -> socketId

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

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, text, receiverId, messageType, message: messageText } = data;
        
        // Check feature access
        const conversation = await Conversation.findById(conversationId);
        const companyHasChat = await hasFeature(conversation.company_id.toString(), 'chat');
        const freelancerHasChat = await hasFeature(conversation.freelancer_id.toString(), 'chat');

        if (!companyHasChat || !freelancerHasChat) {
          if (callback) callback({ success: false, message: 'Active subscription required for both users' });
          return;
        }

        let finalMessage = text || messageText;
        if (typeof finalMessage === 'object') {
          if (finalMessage.text) {
             finalMessage = finalMessage.text;
          } else {
             finalMessage = JSON.stringify(finalMessage);
          }
        }

        const message = new Message({
          conversation_id: conversationId,
          sender_id: socket.user.id || socket.user._id,
          receiver_id: receiverId,
          message: finalMessage,
          message_type: messageType || 'text',
          read_at: null
        });
        await message.save();

        await Conversation.findByIdAndUpdate(conversationId, {
          last_message: message._id,
          last_message_at: new Date()
        });

        const User = (await import('./models/User.js')).default;
        const Notification = (await import('./models/Notification.js')).default;

        const receiverUser = await User.findById(receiverId);
        let receiverIsLocked = false;
        
        if (receiverUser && receiverUser.role === 'company') {
           const receiverHasChat = await hasFeature(receiverId, 'chat');
           if (!receiverHasChat) {
             receiverIsLocked = true;
           }
        }

        // Emit to the conversation room. 
        // Note: The unsubscribed receiver shouldn't even be in this room if they can't open the chat.
        // But to be perfectly safe, we can emit directly to sender if receiver is locked, or just leave it.
        // The sender definitely needs to receive it. 
        io.to(conversationId).emit('receive_message', message);
        
        if (receiverIsLocked) {
           const senderUser = await User.findById(socket.user.id || socket.user._id);
           const notification = new Notification({
             recipient_id: receiverId,
             recipient_role: receiverUser.role,
             type: 'locked_message',
             title: `New message from ${senderUser.name}`,
             message: 'Subscribe to view and reply.',
             conversation_id: conversationId,
             sender_id: senderUser._id,
             subscription_required: true
           });
           await notification.save();
           emitNotification(receiverId, notification);
        } else {
           const receiverSocketId = userSockets.get(receiverId);
           if (receiverSocketId) {
             io.to(receiverSocketId).emit('new_message_notification', message);
           }
        }

        if (callback) callback({ success: true, message });

      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('error', 'Failed to send message: ' + error.message);
        if (callback) callback({ error: 'Failed to send message: ' + error.message });
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

export const emitNotification = (userId, notification) => {
  if (!io) return;
  const idStr = userId.toString();
  const socketId = userSockets.get(idStr);
  if (socketId) {
    io.to(socketId).emit('new_notification', notification);
  }
};
