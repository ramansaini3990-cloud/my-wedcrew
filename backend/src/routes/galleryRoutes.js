import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMiddleware } from '../services/uploadService.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
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
// The ONLY limited route in this router: it accepts a real file and writes up
// to 100MB to disk. Everything below stores JSON and is deliberately unmetered.
router.post(
  '/upload',
  uploadLimiter,
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

// Stores a YouTube/Instagram/Vimeo URL. No file, no disk, no third party at
// write time - an ordinary authenticated write, and not rate limited. Sharing
// a router with /upload is not a reason to share its limit.
router.post('/', createGalleryItem);
router.patch('/reorder', reorderGallery);       // before /:id so "reorder" is not read as an id
router.patch('/:id/feature', toggleFeatured);
router.put('/:id', updateGalleryItem);
router.delete('/:id', deleteGalleryItem);

export default router;
