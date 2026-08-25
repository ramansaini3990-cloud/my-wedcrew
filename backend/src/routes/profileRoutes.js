import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMyProfile, updateMyProfile } from '../controllers/profileController.js';

/** Canonical profile endpoints for freelancers and companies. */
const router = express.Router();

router.use(protect);

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);

export default router;
