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
        const finalMessage = text || messageText;
        
        // Check feature access
        const canChat = await hasFeature(socket.user.id || socket.user._id, 'chat');
        if (!canChat) {
          socket.emit('error', 'Active subscription required to send messages');
          if (callback) callback({ error: 'Active subscription required to send messages' });
          return;
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

        // Emit to the conversation room
        io.to(conversationId).emit('receive_message', message);
        
        // Optionally emit a notification to the receiver if they are online but not in the room
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_message_notification', message);
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
