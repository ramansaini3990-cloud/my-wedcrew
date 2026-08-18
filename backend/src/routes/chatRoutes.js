import express from 'express';
import { getConversations, createConversation, getMessages, markConversationAsRead } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.patch('/conversations/:conversationId/read', markConversationAsRead);

export default router;
