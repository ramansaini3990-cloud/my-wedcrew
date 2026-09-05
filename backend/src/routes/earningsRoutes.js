import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import {
  getEarnings, getLedger, getPayoutAccount, savePayoutAccount,
  listWithdrawals, createWithdrawal, getWithdrawal
} from '../controllers/earningsController.js';

/**
 * Freelancer earnings, payout account and withdrawals.
 * Everything is scoped to req.user - there is no route that reads another
 * professional's financial data.
 */
const router = express.Router();
router.use(protect);

router.get('/', getEarnings);
router.get('/ledger', getLedger);

export const payoutAccountRouter = express.Router();
payoutAccountRouter.use(protect);
payoutAccountRouter.get('/', getPayoutAccount);
payoutAccountRouter.post('/', savePayoutAccount);

export const withdrawalRouter = express.Router();
withdrawalRouter.use(protect);
withdrawalRouter.get('/', listWithdrawals);
withdrawalRouter.post('/', paymentLimiter, createWithdrawal);
withdrawalRouter.get('/:id', getWithdrawal);

export default router;
