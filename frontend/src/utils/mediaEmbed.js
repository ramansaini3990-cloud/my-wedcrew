import { API_BASE_URL } from './api';

/**
 * Client-side media helpers for the portfolio gallery.
 *
 * IMPORTANT: this file does NOT decide what is safe to embed. The server
 * (backend/src/services/mediaEmbedService.js) validates every URL against a
 * host allow-list and returns a rebuilt `embed_url`; the player renders only
 * that stored value. What lives here is (a) URL display helpers and (b) an
 * optimistic mirror of the same rules so the freelancer gets instant feedback
 * before saving. Removing these checks cannot weaken the real validation.
 */

/** Uploaded media is served by the API origin, not the Vite dev origin. */
export const mediaUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE_URL}${url}`;
  return url;
};

export const SOURCE_META = {
  youtube: { label: 'YouTube', className: 'bg-red-50 text-red-700 border-red-200' },
  instagram: { label: 'Instagram', className: 'bg-pink-50 text-pink-700 border-pink-200' },
  vimeo: { label: 'Vimeo', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  upload: { label: 'Uploaded', className: 'bg-brand-primary/10 text-brand-primary border-brand-primary/25' }
};

export const sourceMeta = (sourceType) => SOURCE_META[sourceType] || SOURCE_META.upload;

/** Where "Watch on YouTube" / "View on Instagram" should point. */
export const externalLabel = (sourceType) =>
  ({ youtube: 'Watch on YouTube', instagram: 'View on Instagram', vimeo: 'Watch on Vimeo' }[sourceType] ||
  'Open original');

/* ------------------------------------------------------------------ */
/* Optimistic client-side URL check (mirrors the server allow-list)    */
/* ------------------------------------------------------------------ */

const HOSTS = {
  youtube: ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  vimeo: ['vimeo.com', 'player.vimeo.com'],
  instagram: ['instagram.com', 'instagr.am']
};

const host = (h) => String(h || '').toLowerCase().replace(/^www\./, '');

/**
 * Returns the platform a URL appears to belong to, or null.
 * Used only to show a badge and an inline hint while typing.
 */
export const detectSource = (raw) => {
  const value = String(raw || '').trim();
  if (!/^https:\/\//i.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const h = host(url.hostname);
  return Object.keys(HOSTS).find((key) => HOSTS[key].includes(h)) || null;
};

/** Inline validation message shown before the request is made. */
export const validateMediaUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return 'Paste a video link.';
  if (!/^https:\/\//i.test(value)) return 'The link must start with https://';
  if (!detectSource(value)) return 'Supported links: YouTube, Instagram, Vimeo.';
  return null;
};

export default { mediaUrl, sourceMeta, detectSource, validateMediaUrl, externalLabel };
