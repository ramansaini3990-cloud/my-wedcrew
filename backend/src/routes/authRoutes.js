import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  verifyEmail,
  resendVerification
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
// Both are unauthenticated by necessity (the user cannot sign in yet), so
// they carry the same strict authLimiter as login and register.
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);

router.get('/me', protect, getMe);

export default router;
