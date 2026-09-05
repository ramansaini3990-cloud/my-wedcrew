import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMiddleware } from '../services/uploadService.js';
import {
  listMyGallery,
  uploadMedia,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  reorderGallery,
  toggleFeatured
} from '../controllers/galleryController.js';

/**
 * Freelancer portfolio gallery management.
 *
 * Every route requires authentication and is scoped to the caller's own items
 * inside the controller. There is no "edit someone else's gallery" endpoint.
 */
const router = express.Router();

router.use(protect);

/** Only freelancers own a portfolio; admins moderate via /api/admin/gallery. */
const freelancerOnly = (req, res, next) => {
  if (req.user?.role !== 'freelancer') {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Only freelancers have a portfolio gallery.' });
  }
  next();
};

router.use(freelancerOnly);

router.get('/me', listMyGallery);

/**
 * Multer errors (file too large, wrong type) surface as thrown errors rather
 * than a 500, so the freelancer sees why the upload was refused.
 */
router.post(
  '/upload',
  (req, res, next) =>
    uploadMiddleware.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'That file is too large.' });
      }
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        return res.status(400).json({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Supported files: JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV.'
        });
      }
      return res.status(400).json({ code: 'UPLOAD_FAILED', message: 'Upload failed.' });
    }),
  uploadMedia
);

router.post('/', createGalleryItem);
router.patch('/reorder', reorderGallery);       // before /:id so "reorder" is not read as an id
router.patch('/:id/feature', toggleFeatured);
router.put('/:id', updateGalleryItem);
router.delete('/:id', deleteGalleryItem);

export default router;
