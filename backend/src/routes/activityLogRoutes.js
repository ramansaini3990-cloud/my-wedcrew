import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import {
  listActivityLogs,
  getActivityStats,
  getActivityLog
} from '../controllers/activityLogController.js';

/**
 * Admin activity log. Mounted at /api/admin/activity-logs.
 * Both guards are applied at the router level, so every route below is
 * admin-only - there is no public activity endpoint anywhere in the app.
 */
const router = express.Router();

router.use(protect);
router.use(admin);

// `/stats` must precede `/:id` so it is not swallowed by the param route.
router.get('/stats', getActivityStats);
router.get('/', listActivityLogs);
router.get('/:id', getActivityLog);

export default router;
