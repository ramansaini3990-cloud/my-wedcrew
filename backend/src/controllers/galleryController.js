import mongoose from 'mongoose';
import GalleryItem from '../models/GalleryItem.js';
import { resolveExternalMedia } from '../services/mediaEmbedService.js';
import { store as storeUpload, remove as removeUpload } from '../services/uploadService.js';
import { logFromRequest } from '../services/activityService.js';
import { normaliseEmbedUrl } from '../services/publicProfileService.js';

/**
 * Freelancer portfolio gallery.
 *
 * Ownership is enforced on EVERY query by including `user_id: req.user.id` in
 * the filter itself rather than loading a document and comparing afterwards -
 * a mismatched id simply matches nothing, so there is no window in which
 * another freelancer's item is in memory.
 */

const MAX_ITEMS_PER_USER = 200;

const ownerId = (req) => req.user.id || req.user._id;

/** Owner view: includes hidden items so the freelancer knows they were moderated. */
const serialiseOwn = (item) => ({
  id: String(item._id),
  media_type: item.media_type,
  source_type: item.source_type,
  title: item.title,
  description: item.description || '',
  category: item.category || '',
  media_url: item.media_url,
  thumbnail_url: item.thumbnail_url || null,
  embed_url: normaliseEmbedUrl(item.embed_url),
  external_id: item.external_id || null,
  featured: Boolean(item.featured),
  display_order: item.display_order ?? 0,
  is_hidden: Boolean(item.is_hidden),
  hidden_reason: item.hidden_reason || null,
  created_at: item.created_at
});

/** Shared validation for the writable text fields. */
const readTextFields = (body, { requireTitle }) => {
  const out = {};

  if (body.title !== undefined || requireTitle) {
    const title = String(body.title || '').trim();
    if (!title) return { error: { code: 'VALIDATION_ERROR', message: 'Title is required.' } };
    if (title.length > 120) return { error: { code: 'VALIDATION_ERROR', message: 'Title must be 120 characters or fewer.' } };
    out.title = title;
  }
  if (body.description !== undefined) out.description = String(body.description || '').trim().slice(0, 1000);
  if (body.category !== undefined) out.category = String(body.category || '').trim().slice(0, 60);
  if (body.featured !== undefined) out.featured = Boolean(body.featured);

  return { values: out };
};

/* ------------------------------------------------------------------ */
/* GET /api/gallery/me                                                 */
/* ------------------------------------------------------------------ */
export const listMyGallery = async (req, res) => {
  try {
    const items = await GalleryItem.find({ user_id: ownerId(req) })
      .sort({ display_order: 1, created_at: -1 })
      .lean();

    res.json({ success: true, data: items.map(serialiseOwn) });
  } catch (error) {
    console.error('listMyGallery error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load your gallery.' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/gallery/upload                                            */
/* ------------------------------------------------------------------ */
/**
 * Stores one file and returns its URL. Deliberately separate from item
 * creation so a failed upload never leaves a half-built gallery row, and so
 * the storage backend can change without touching the item API.
 */
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'NO_FILE', message: 'No file was received.' });
    }
    const saved = await storeUpload(req.file, ownerId(req));
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error.code === 'UNSUPPORTED_MEDIA_TYPE' || error.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ code: error.code, message: error.message });
    }
    console.error('uploadMedia error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Upload failed.' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/gallery                                                   */
/* ------------------------------------------------------------------ */
/**
 * Creates a gallery item from either:
 *   { source_type: 'upload', media_url, media_type }  - a prior /upload result
 *   { url: '<platform link>' }                        - resolved + validated here
 */
export const createGalleryItem = async (req, res) => {
  try {
    const user = ownerId(req);

    const count = await GalleryItem.countDocuments({ user_id: user });
    if (count >= MAX_ITEMS_PER_USER) {
      return res.status(400).json({
        code: 'GALLERY_FULL',
        message: `A gallery can hold up to ${MAX_ITEMS_PER_USER} items.`
      });
    }

    const text = readTextFields(req.body, { requireTitle: true });
    if (text.error) return res.status(400).json(text.error);

    const doc = { user_id: user, ...text.values };

    if (req.body.url) {
      // ---- External platform link ------------------------------------
      const resolved = resolveExternalMedia(req.body.url);
      if (!resolved.ok) return res.status(400).json(resolved.error);

      Object.assign(doc, {
        media_type: resolved.data.media_type,
        source_type: resolved.data.source_type,
        media_url: resolved.data.canonical_url,
        embed_url: resolved.data.embed_url,
        external_id: resolved.data.external_id,
        thumbnail_url: resolved.data.thumbnail_url
      });
    } else {
      // ---- Previously uploaded file ----------------------------------
      const mediaUrl = String(req.body.media_url || '').trim();
      const mediaType = String(req.body.media_type || '').trim();

      if (!mediaUrl.startsWith('/uploads/')) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Upload a file or paste a supported video link.'
        });
      }
      if (!['image', 'video'].includes(mediaType)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Unknown media type.' });
      }

      Object.assign(doc, {
        media_type: mediaType,
        source_type: 'upload',
        media_url: mediaUrl,
        embed_url: null,
        external_id: null,
        thumbnail_url: String(req.body.thumbnail_url || '').trim() || null
      });
    }

    // New items go to the end of the list.
    const last = await GalleryItem.findOne({ user_id: user }).sort({ display_order: -1 }).select('display_order').lean();
    doc.display_order = (last?.display_order ?? -1) + 1;

    const created = await GalleryItem.create(doc);

    await logFromRequest(req, {
      eventType: 'gallery.item_added',
      category: 'profiles',
      title: 'Portfolio item added',
      description: `Added "${created.title}" to their portfolio`,
      target: { type: 'user', id: user, label: created.title },
      metadata: { media_type: created.media_type, source_type: created.source_type }
    });

    res.status(201).json({ success: true, data: serialiseOwn(created) });
  } catch (error) {
    console.error('createGalleryItem error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to add this item.' });
  }
};

/* ------------------------------------------------------------------ */
/* PUT /api/gallery/:id                                                */
/* ------------------------------------------------------------------ */
export const updateGalleryItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    const text = readTextFields(req.body, { requireTitle: false });
    if (text.error) return res.status(400).json(text.error);

    // Replacing the source is allowed; the URL is re-validated from scratch.
    if (req.body.url) {
      const resolved = resolveExternalMedia(req.body.url);
      if (!resolved.ok) return res.status(400).json(resolved.error);
      Object.assign(text.values, {
        media_type: resolved.data.media_type,
        source_type: resolved.data.source_type,
        media_url: resolved.data.canonical_url,
        embed_url: resolved.data.embed_url,
        external_id: resolved.data.external_id,
        thumbnail_url: resolved.data.thumbnail_url
      });
    }

    if (!Object.keys(text.values).length) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update.' });
    }

    // Ownership is part of the filter - another user's id matches nothing.
    const updated = await GalleryItem.findOneAndUpdate(
      { _id: req.params.id, user_id: ownerId(req) },
      { $set: text.values },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    res.json({ success: true, data: serialiseOwn(updated) });
  } catch (error) {
    console.error('updateGalleryItem error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update this item.' });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /api/gallery/:id                                             */
/* ------------------------------------------------------------------ */
export const deleteGalleryItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    const removed = await GalleryItem.findOneAndDelete({
      _id: req.params.id,
      user_id: ownerId(req)
    });

    if (!removed) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    // Best-effort file cleanup; the row is already gone either way.
    if (removed.source_type === 'upload') await removeUpload(removed.media_url);

    res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (error) {
    console.error('deleteGalleryItem error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to delete this item.' });
  }
};

/* ------------------------------------------------------------------ */
/* PATCH /api/gallery/reorder                                          */
/* ------------------------------------------------------------------ */
/**
 * Accepts the full ordered list of item ids. Ids that do not belong to the
 * caller are silently skipped by the ownership filter on each write.
 */
export const reorderGallery = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.order) ? req.body.order : null;
    if (!ids || !ids.length) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Provide the new order.' });
    }
    if (ids.length > MAX_ITEMS_PER_USER) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Too many items.' });
    }
    if (!ids.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid item reference.' });
    }

    const user = ownerId(req);
    await GalleryItem.bulkWrite(
      ids.map((id, index) => ({
        updateOne: {
          filter: { _id: id, user_id: user },
          update: { $set: { display_order: index } }
        }
      }))
    );

    const items = await GalleryItem.find({ user_id: user })
      .sort({ display_order: 1, created_at: -1 })
      .lean();

    res.json({ success: true, data: items.map(serialiseOwn) });
  } catch (error) {
    console.error('reorderGallery error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to reorder the gallery.' });
  }
};

/* ------------------------------------------------------------------ */
/* PATCH /api/gallery/:id/feature                                      */
/* ------------------------------------------------------------------ */
export const toggleFeatured = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    const item = await GalleryItem.findOne({ _id: req.params.id, user_id: ownerId(req) });
    if (!item) return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });

    item.featured = req.body.featured === undefined ? !item.featured : Boolean(req.body.featured);
    await item.save();

    res.json({ success: true, data: serialiseOwn(item) });
  } catch (error) {
    console.error('toggleFeatured error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update this item.' });
  }
};

export default {
  listMyGallery,
  uploadMedia,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  reorderGallery,
  toggleFeatured
};
