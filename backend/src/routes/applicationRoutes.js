import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createApplication, getRequirementApplications, updateApplicationStatus, getMyApplicationForRequirement, getMyApplications } from '../controllers/applicationController.js';

const router = express.Router();

router.post('/', protect, createApplication);
router.get('/my', protect, getMyApplications);
router.get('/requirement/:requirementId', protect, getRequirementApplications);
router.get('/my/requirement/:requirementId', protect, getMyApplicationForRequirement);
router.patch('/:id/status', protect, updateApplicationStatus);

export default router;