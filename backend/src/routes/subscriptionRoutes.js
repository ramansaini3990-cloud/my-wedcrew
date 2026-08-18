import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getMySubscription,
  getActivePlans,
  getChatAccess
} from '../controllers/subscriptionController.js';

const router = express.Router();

router.get('/plans', getActivePlans);
router.get('/me', protect, getMySubscription);
router.get('/chat-access/:otherUserId', protect, getChatAccess);

export default router;
