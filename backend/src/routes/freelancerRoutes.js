import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateProfileAndAvailability, getMyProfile, getDashboardStats } from '../controllers/freelancerController.js';

const router = express.Router();

router.use(protect);

router.get('/dashboard/stats', getDashboardStats);
router.get('/profile', getMyProfile);
router.post('/profile', updateProfileAndAvailability);

export default router;
