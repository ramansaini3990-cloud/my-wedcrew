import mongoose from 'mongoose';
import GalleryItem from '../../models/GalleryItem.js';
import User from '../../models/User.js';
import { remove as removeUpload } from '../../services/uploadService.js';
import { logFromRequest } from '../../services/activityService.js';
import { normaliseEmbedUrl } from '../../services/publicProfileService.js';

/**
 * Admin moderation for freelancer portfolio galleries.
 *
 * Hiding is preferred over deleting: `is_hidden` removes an item from every
 * public response while keeping the record for audit and appeal. Deletion is
 * available for content that must not be retained.
 *
 * These endpoints are mounted behind `protect, admin` in adminRoutes.js.
 */

/**
 * GET /api/admin/gallery
 * Optional filters: user_id, source_type, media_type, hidden=true|false, q
 */
export const listAllGalleryItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.user_id && mongoose.isValidObjectId(req.query.user_id)) query.user_id = req.query.user_id;
    if (['image', 'video'].includes(req.query.media_type)) query.media_type = req.query.media_type;
    if (['upload', 'youtube', 'instagram', 'vimeo'].includes(req.query.source_type)) {
      query.source_type = req.query.source_type;
    }
    if (req.query.hidden === 'true') query.is_hidden = true;
    if (req.query.hidden === 'false') query.is_hidden = { $ne: true };

    const [items, total] = await Promise.all([
      GalleryItem.find(query)
        .populate('user_id', 'name profession city')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GalleryItem.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: items.map((item) => ({
        id: String(item._id),
        title: item.title,
        description: item.description || '',
        category: item.category || '',
        media_type: item.media_type,
        source_type: item.source_type,
        media_url: item.media_url,
        thumbnail_url: item.thumbnail_url || null,
        embed_url: normaliseEmbedUrl(item.embed_url),
        featured: Boolean(item.featured),
        is_hidden: Boolean(item.is_hidden),
        hidden_reason: item.hidden_reason || null,
        created_at: item.created_at,
        owner: item.user_id
          ? {
              id: String(item.user_id._id),
              name: item.user_id.name,
              profession: item.user_id.profession || null,
              city: item.user_id.city || null
            }
          : null
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('listAllGalleryItems error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load gallery items.' });
  }
};

/**
 * GET /api/admin/gallery/freelancers/:id
 * One freelancer's full portfolio, including already-hidden items.
 */
export const getFreelancerPortfolio = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Freelancer not found.' });
    }

    const owner = await User.findOne({ _id: req.params.id, role: 'freelancer' })
      .select('name profession city state profile_picture social_links')
      .lean();

    if (!owner) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Freelancer not found.' });

    const items = await GalleryItem.find({ user_id: owner._id })
      .sort({ display_order: 1, created_at: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        owner: {
          id: String(owner._id),
          name: owner.name,
          profession: owner.profession || null,
          city: owner.city || null,
          state: owner.state || null,
          profile_picture: owner.profile_picture || null,
          social_links: owner.social_links || {}
        },
        items: items.map((i) => ({
          id: String(i._id),
          title: i.title,
          media_type: i.media_type,
          source_type: i.source_type,
          media_url: i.media_url,
          thumbnail_url: i.thumbnail_url || null,
          embed_url: normaliseEmbedUrl(i.embed_url),
          featured: Boolean(i.featured),
          is_hidden: Boolean(i.is_hidden),
          hidden_reason: i.hidden_reason || null,
          created_at: i.created_at
        }))
      }
    });
  } catch (error) {
    console.error('getFreelancerPortfolio error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load this portfolio.' });
  }
};

/**
 * PATCH /api/admin/gallery/:id/visibility
 * Body: { is_hidden: boolean, reason?: string }
 */
export const setGalleryItemVisibility = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    const hide = Boolean(req.body.is_hidden);
    const reason = hide ? String(req.body.reason || '').trim().slice(0, 300) : null;

    const item = await GalleryItem.findByIdAndUpdate(
      req.params.id,
      { $set: { is_hidden: hide, hidden_reason: reason } },
      { new: true }
    );

    if (!item) return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });

    await logFromRequest(req, {
      eventType: hide ? 'gallery.item_hidden' : 'gallery.item_restored',
      category: 'moderation',
      title: hide ? 'Portfolio item hidden' : 'Portfolio item restored',
      description: `${hide ? 'Hid' : 'Restored'} "${item.title}"`,
      target: { type: 'user', id: item.user_id, label: item.title },
      metadata: { media_type: item.media_type, source_type: item.source_type, reason: reason || undefined }
    });

    res.json({
      success: true,
      data: { id: String(item._id), is_hidden: item.is_hidden, hidden_reason: item.hidden_reason }
    });
  } catch (error) {
    console.error('setGalleryItemVisibility error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update visibility.' });
  }
};

/** DELETE /api/admin/gallery/:id */
export const deleteGalleryItemAsAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });
    }

    const removed = await GalleryItem.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Gallery item not found.' });

    if (removed.source_type === 'upload') await removeUpload(removed.media_url);

    await logFromRequest(req, {
      eventType: 'gallery.item_deleted',
      category: 'moderation',
      title: 'Portfolio item deleted',
      description: `Deleted "${removed.title}"`,
      target: { type: 'user', id: removed.user_id, label: removed.title },
      metadata: { media_type: removed.media_type, source_type: removed.source_type }
    });

    res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (error) {
    console.error('deleteGalleryItemAsAdmin error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to delete this item.' });
  }
};

export default {
  listAllGalleryItems,
  getFreelancerPortfolio,
  setGalleryItemVisibility,
  deleteGalleryItemAsAdmin
};
