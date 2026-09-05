import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getPaymentConfig, createPayment, verifyPayment, listPayments, getPayment,
  confirmCash, disputeCash, requestRefund
} from '../controllers/paymentController.js';

/**
 * Company + freelancer payment routes.
 *
 * Every route requires authentication and is ownership-scoped inside the
 * controller: a payment is only ever readable by its own company, its own
 * freelancer, or an admin. The webhook is NOT mounted here - it is
 * unauthenticated and needs a raw body, so app.js mounts it separately.
 */
const router = express.Router();

router.use(protect);

router.get('/config', getPaymentConfig);
router.get('/', listPayments);
router.post('/', createPayment);
router.get('/:id', getPayment);
router.post('/:id/verify', verifyPayment);
router.post('/:id/cash-confirm', confirmCash);
router.post('/:id/cash-dispute', disputeCash);
router.post('/:id/refund', requestRefund);

export default router;
