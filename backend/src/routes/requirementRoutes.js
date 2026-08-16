import express from 'express';
import {
  createRequirement,
  getRequirements,
  getRequirementById,
  updateRequirement,
  deleteRequirement,
  getMyRequirements
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

export default router;
