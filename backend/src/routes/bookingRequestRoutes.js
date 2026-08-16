import express from 'express';
import {
  createBookingRequest,
  getFreelancerBookingRequests,
  updateBookingRequestStatus
} from '../controllers/bookingRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createBookingRequest);

router.route('/freelancer')
  .get(protect, getFreelancerBookingRequests);

router.route('/:id/status')
  .put(protect, updateBookingRequestStatus);

export default router;
