import mongoose from 'mongoose';

export const GALLERY_MEDIA_TYPES = ['image', 'video'];
export const GALLERY_SOURCE_TYPES = ['upload', 'youtube', 'instagram', 'vimeo'];

/**
 * One item in a freelancer's portfolio gallery.
 *
 * Binary media is NEVER stored here - `media_url` holds a URL produced by
 * services/uploadService.js (local disk today, object storage later) or, for
 * external platforms, the platform's own canonical URL.
 *
 * `embed_url` / `external_id` are written ONLY by mediaEmbedService from a
 * validated, allow-listed host. They are never copied from raw user input, so
 * the frontend can render an iframe from them without further sanitising.
 */
const galleryItemSchema = new mongoose.Schema({
  // Owner. Every query in galleryController is scoped by this field.
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  media_type: { type: String, enum: GALLERY_MEDIA_TYPES, required: true },
  source_type: { type: String, enum: GALLERY_SOURCE_TYPES, required: true },

  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, maxlength: 60 },

  /** Uploaded file URL, or the platform permalink for external items. */
  media_url: { type: String, required: true, trim: true },

  /** Poster/preview. Null for sources that publish no stable thumbnail. */
  thumbnail_url: { type: String, trim: true, default: null },

  /** Server-derived embed target. Null for uploads and non-embeddable items. */
  embed_url: { type: String, trim: true, default: null },

  /** Platform video/post id, extracted and format-checked server-side. */
  external_id: { type: String, trim: true, default: null },

  featured: { type: Boolean, default: false, index: true },

  /** Ascending; ties break on created_at. Managed by the reorder endpoint. */
  display_order: { type: Number, default: 0, index: true },

  /**
   * Admin moderation flag. Hidden items stay in the database (so the action is
   * reversible and auditable) but are filtered out of every public response.
   */
  is_hidden: { type: Boolean, default: false, index: true },
  hidden_reason: { type: String, trim: true, maxlength: 300, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// "This freelancer's visible gallery, in display order" - the hot path.
galleryItemSchema.index({ user_id: 1, is_hidden: 1, display_order: 1, created_at: -1 });
// Featured work on the public profile.
galleryItemSchema.index({ user_id: 1, featured: 1, is_hidden: 1 });

galleryItemSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('GalleryItem', galleryItemSchema);
