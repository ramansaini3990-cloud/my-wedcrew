import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getSavedProfessionals,
  getSavedProfessionalIds,
  createSavedProfessional,
  deleteSavedProfessional
} from '../controllers/savedProfessionalController.js';

/** Company bookmarks of professionals. Every route is authenticated. */
const router = express.Router();

router.use(protect);

// Declared before '/' so the literal path is not swallowed by a param route.
router.get('/ids', getSavedProfessionalIds);

router.get('/', getSavedProfessionals);
router.post('/', createSavedProfessional);
router.delete('/:freelancerId', deleteSavedProfessional);

export default router;
