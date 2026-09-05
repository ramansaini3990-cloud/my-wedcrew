import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

/**
 * Media storage adapter.
 *
 * The database NEVER holds binary data - it stores only the public URL string
 * returned by `store()`. That indirection is the whole point of this module:
 * swapping local disk for S3/Cloudinary/R2 later means reimplementing `store()`
 * and `remove()` here, with no model, controller or frontend change.
 *
 * Local disk is the default because the project has no object storage
 * configured. Files land in backend/uploads/gallery/<userId>/ and are served
 * read-only from /uploads by app.js.
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const GALLERY_DIR = path.join(UPLOAD_ROOT, 'gallery');

/** Public URL prefix. Kept in one place so a CDN origin can be swapped in. */
export const PUBLIC_PREFIX = process.env.MEDIA_PUBLIC_PREFIX || '/uploads';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // 8 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Accepted upload types, mapped to the extension we will write.
 *
 * The extension is taken from THIS table, never from the client-supplied
 * filename, so `evil.html` cannot be written as-is and later served.
 */
const ALLOWED = {
  'image/jpeg': { ext: '.jpg', media_type: 'image', limit: MAX_IMAGE_BYTES },
  'image/png': { ext: '.png', media_type: 'image', limit: MAX_IMAGE_BYTES },
  'image/webp': { ext: '.webp', media_type: 'image', limit: MAX_IMAGE_BYTES },
  'image/avif': { ext: '.avif', media_type: 'image', limit: MAX_IMAGE_BYTES },
  'image/gif': { ext: '.gif', media_type: 'image', limit: MAX_IMAGE_BYTES },
  'video/mp4': { ext: '.mp4', media_type: 'video', limit: MAX_VIDEO_BYTES },
  'video/webm': { ext: '.webm', media_type: 'video', limit: MAX_VIDEO_BYTES },
  'video/quicktime': { ext: '.mov', media_type: 'video', limit: MAX_VIDEO_BYTES }
};

export const isAllowedMime = (mime) => Object.prototype.hasOwnProperty.call(ALLOWED, mime);
export const mediaTypeForMime = (mime) => ALLOWED[mime]?.media_type || null;

/**
 * Multer instance: memory storage so nothing touches disk until the MIME type
 * and size have been checked and a safe filename has been generated.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      const err = new Error('Unsupported file type.');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err);
    }
    return cb(null, true);
  }
});

/** `userId` is used as a directory name, so it must contain nothing else. */
const safeSegment = (value) => {
  const s = String(value || '');
  if (!/^[a-fA-F0-9]{24}$/.test(s)) throw new Error('Invalid owner id for storage path.');
  return s;
};

/**
 * Persists one uploaded buffer and returns its public URL.
 *
 * @param {object} file   a multer memory-storage file
 * @param {string} userId owner id, used to partition the storage
 * @returns {Promise<{url: string, media_type: string, bytes: number, mime: string}>}
 */
export const store = async (file, userId) => {
  const spec = ALLOWED[file.mimetype];
  if (!spec) {
    const err = new Error('Unsupported file type.');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }
  if (file.size > spec.limit) {
    const err = new Error(
      `${spec.media_type === 'video' ? 'Videos' : 'Images'} must be under ${Math.round(spec.limit / (1024 * 1024))} MB.`
    );
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const owner = safeSegment(userId);
  const dir = path.join(GALLERY_DIR, owner);
  await fs.promises.mkdir(dir, { recursive: true });

  // Random name: never derived from the client filename.
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${spec.ext}`;
  await fs.promises.writeFile(path.join(dir, name), file.buffer);

  return {
    url: `${PUBLIC_PREFIX}/gallery/${owner}/${name}`,
    media_type: spec.media_type,
    bytes: file.size,
    mime: file.mimetype
  };
};

/**
 * Deletes a previously stored file. Best-effort by design: a gallery item must
 * still be removable from the database even if its file is already gone.
 *
 * Only paths inside the upload root are ever touched, so a crafted URL such as
 * `/uploads/../../src/app.js` cannot delete application code.
 */
export const remove = async (publicUrl) => {
  try {
    if (!publicUrl || !String(publicUrl).startsWith(`${PUBLIC_PREFIX}/`)) return false;
    const relative = String(publicUrl).slice(PUBLIC_PREFIX.length + 1);
    const target = path.resolve(UPLOAD_ROOT, relative);
    if (!target.startsWith(UPLOAD_ROOT + path.sep)) return false;
    await fs.promises.unlink(target);
    return true;
  } catch {
    return false;
  }
};

/** Ensures the upload directory exists at boot. */
export const ensureStorage = async () => {
  await fs.promises.mkdir(GALLERY_DIR, { recursive: true });
  return UPLOAD_ROOT;
};

export const UPLOAD_ROOT_DIR = UPLOAD_ROOT;

export default { store, remove, ensureStorage, uploadMiddleware, isAllowedMime, mediaTypeForMime };
