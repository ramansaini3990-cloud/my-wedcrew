import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import {
  getOverview, listPayments, listWithdrawals, updateWithdrawal,
  listDisputes, resolveDispute, updateSettings, createAdjustment
} from '../controllers/admin/financeController.js';

/** Admin finance panel. Mounted behind the existing protect + admin guards. */
const router = express.Router();
router.use(protect, admin);

router.get('/overview', getOverview);
router.get('/payments', listPayments);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id', updateWithdrawal);
router.get('/disputes', listDisputes);
router.post('/disputes/:id/resolve', resolveDispute);
router.put('/settings', updateSettings);
router.post('/adjustments', createAdjustment);

export default router;
