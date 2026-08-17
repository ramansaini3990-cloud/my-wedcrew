import express from 'express';
import {
  getAllSubscriptions,
  getPlans,
  createPlan,
  assignSubscription,
  updateSubscriptionStatus
} from '../controllers/adminSubscriptionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(admin); // Ensure only admin can access these

router.get('/subscriptions', getAllSubscriptions);
router.post('/subscriptions', assignSubscription);
router.put('/subscriptions/:id/status', updateSubscriptionStatus);

router.get('/plans', getPlans);
router.post('/plans', createPlan);

export default router;
