import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  listMyBlocks,
  createBlock,
  updateBlock,
  deleteBlock
} from '../controllers/availabilityBlockController.js';

/** Travel & Availability blocks. Users manage only their own. */
const router = express.Router();

router.use(protect);

router.get('/blocks', listMyBlocks);
router.post('/blocks', createBlock);
router.put('/blocks/:id', updateBlock);
router.delete('/blocks/:id', deleteBlock);

export default router;
