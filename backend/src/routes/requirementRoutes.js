import express from 'express';
import {
  createRequirement,
  getRequirements,
  getRequirementById,
  updateRequirement,
  deleteRequirement,
  getMyRequirements,
  updateRequirementStatus
} from '../controllers/requirementController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createRequirement)
  .get(optionalAuth, getRequirements);

router.route('/me')
  .get(protect, getMyRequirements);


router.route('/:id')
  .get(optionalAuth, getRequirementById)
  .put(protect, updateRequirement)
  .delete(protect, deleteRequirement);

router.route('/:id/status')
  .patch(protect, updateRequirementStatus);

export default router;
