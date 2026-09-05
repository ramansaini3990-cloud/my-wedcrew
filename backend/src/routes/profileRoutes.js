import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { getMyProfile, updateMyProfile, changeMyPassword } from '../controllers/profileController.js';

/** Canonical profile endpoints for freelancers and companies. */
const router = express.Router();

router.use(protect);

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);

// Rate limited with the SAME strict bucket as login and registration: this is
// a credential-guessing surface too, because it accepts the current password.
router.patch('/password', authLimiter, changeMyPassword);

export default router;
