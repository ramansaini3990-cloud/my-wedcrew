import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import { getDashboardStats } from '../controllers/admin/dashboardController.js';
import { getFreelancers, getCompanies } from '../controllers/admin/userController.js';
import { getAdminRequirements, updateRequirementStatus, deleteAdminRequirement } from '../controllers/admin/requirementController.js';

const router = express.Router();

// All routes here are protected and require admin role
router.use(protect, admin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Users
router.get('/freelancers', getFreelancers);
router.get('/companies', getCompanies);

// Requirements
router.get('/requirements', getAdminRequirements);
router.put('/requirements/:id/status', updateRequirementStatus);
router.delete('/requirements/:id', deleteAdminRequirement);

// Placeholders for future phases
// router.get('/payments', getPayments);

export default router;
