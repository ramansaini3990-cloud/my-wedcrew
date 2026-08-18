import express from 'express';
import {
  getAllSubscriptions,
  getSubscriptionOverview,
  getUserSubscriptionHistory,
  getPlans,
  createPlan,
  updatePlan,
  seedDefaultPlans,
  assignSubscription,
  updateSubscriptionStatus,
  extendSubscription,
  changeSubscriptionPlan,
  updateSubscriptionDates
} from '../controllers/adminSubscriptionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(admin); // Ensure only admin can access these

// Subscriptions
router.get('/subscriptions', getAllSubscriptions);
router.get('/subscriptions/overview', getSubscriptionOverview);
router.get('/subscriptions/user/:userId', getUserSubscriptionHistory);
router.post('/subscriptions', assignSubscription);
router.put('/subscriptions/:id/status', updateSubscriptionStatus);
router.put('/subscriptions/:id/extend', extendSubscription);
router.put('/subscriptions/:id/plan', changeSubscriptionPlan);
router.put('/subscriptions/:id/dates', updateSubscriptionDates);

// Plans
router.get('/plans', getPlans);
router.post('/plans', createPlan);
router.post('/plans/seed-defaults', seedDefaultPlans);
router.put('/plans/:id', updatePlan);

export default router;
