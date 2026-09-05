import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter, loginAccountLimiter, emailLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);

// Two limiters, because they defend different things. loginAccountLimiter
// counts FAILED attempts against the submitted address, which is what stops
// somebody grinding one account from a rotating pool of IPs; authLimiter is
// the per-IP backstop for everything else. Order matters only for which one
// reports first - both must pass.
router.post('/login', loginAccountLimiter, authLimiter, loginUser);

// Unauthenticated by necessity (the user cannot sign in yet), so they keep the
// per-IP credential limiter.
router.post('/verify-email', authLimiter, verifyEmail);

// These put mail in somebody's inbox, so they also carry the per-address email
// limiter - an unthrottled resend is a way to flood a stranger's mailbox.
router.post('/resend-verification', emailLimiter, authLimiter, resendVerification);

// Password reset. forgot-password mails a stranger's address on request, so it
// carries the per-address email limiter; reset-password is a credential write
// and carries the auth limiter.
router.post('/forgot-password', emailLimiter, authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

router.get('/me', protect, getMe);

export default router;
