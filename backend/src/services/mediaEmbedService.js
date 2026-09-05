/**
 * External media URL parsing, validation and embed resolution.
 *
 * This is the security boundary for every user-supplied media URL. Nothing
 * else in the codebase is allowed to build an embed URL: controllers store
 * only what `resolveExternalMedia()` returns, and the frontend renders an
 * iframe only from those stored, server-derived fields.
 *
 * Rules enforced here:
 *   1. Only https (and protocol-relative input is rejected outright).
 *   2. Only hosts on PLATFORM allow-lists - never a free-form URL.
 *   3. The platform video/post ID must match a strict character class, so an
 *      ID can never smuggle quotes, angle brackets or a second URL into the
 *      embed src.
 *   4. The embed URL is REBUILT from the extracted ID. The user's original
 *      string is never echoed into an iframe.
 *
 * Adding a platform means adding an entry here; no other file changes.
 */

/** Video/post ID shapes. Deliberately strict - anything else is rejected. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;
const INSTAGRAM_ID = /^[A-Za-z0-9_-]{5,30}$/;

/** Hosts we accept per platform (exact match, after stripping a leading www.). */
const HOSTS = {
  youtube: ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  vimeo: ['vimeo.com', 'player.vimeo.com'],
  instagram: ['instagram.com', 'instagr.am']
};

export const SOURCE_TYPES = ['upload', 'youtube', 'instagram', 'vimeo'];
export const MEDIA_TYPES = ['image', 'video'];

/** Normalises a host: lowercases and drops a single leading `www.`. */
const normaliseHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

/**
 * Parses a user-supplied string into a URL, rejecting anything that is not
 * plain https. `javascript:`, `data:`, `file:` and protocol-relative strings
 * all fail here rather than reaching an iframe.
 */
const safeParse = (raw) => {
  const value = String(raw || '').trim();
  if (!value || value.length > 2048) return null;
  if (!/^https:\/\//i.test(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* YouTube                                                             */
/* ------------------------------------------------------------------ */

const parseYouTube = (url) => {
  const host = normaliseHost(url.hostname);
  if (!HOSTS.youtube.includes(host)) return null;

  let id = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] || null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else {
    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1];
  }

  if (!id || !YOUTUBE_ID.test(id)) return null;

  return {
    source_type: 'youtube',
    media_type: 'video',
    external_id: id,
    // youtube-nocookie avoids setting tracking cookies until playback starts.
    embed_url: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
    canonical_url: `https://www.youtube.com/watch?v=${id}`,
    // hqdefault exists for every public video; maxres often does not.
    thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embeddable: true
  };
};

/* ------------------------------------------------------------------ */
/* Vimeo                                                               */
/* ------------------------------------------------------------------ */

const parseVimeo = (url) => {
  const host = normaliseHost(url.hostname);
  if (!HOSTS.vimeo.includes(host)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  // vimeo.com/<id> or player.vimeo.com/video/<id>
  const id = parts[0] === 'video' ? parts[1] : parts[0];
  if (!id || !VIMEO_ID.test(id)) return null;

  return {
    source_type: 'vimeo',
    media_type: 'video',
    external_id: id,
    embed_url: `https://player.vimeo.com/video/${id}?dnt=1`,
    canonical_url: `https://vimeo.com/${id}`,
    // Vimeo thumbnails need an API call; the player shows its own poster.
    thumbnail_url: null,
    embeddable: true
  };
};

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

const parseInstagram = (url) => {
  const host = normaliseHost(url.hostname);
  if (!HOSTS.instagram.includes(host)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const kindIndex = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p));
  if (kindIndex === -1) return null;

  const kind = parts[kindIndex] === 'reels' ? 'reel' : parts[kindIndex];
  const id = parts[kindIndex + 1];
  if (!id || !INSTAGRAM_ID.test(id)) return null;

  const canonical = `https://www.instagram.com/${kind}/${id}/`;

  return {
    source_type: 'instagram',
    // A /p/ permalink may be a photo or a video; Instagram's own embed renders
    // whichever it is, so the item is stored as "video" only for reel/tv.
    media_type: kind === 'p' ? 'image' : 'video',
    external_id: id,
    // Instagram's official embed endpoint. `/embed/` (rather than
    // `/embed/captioned/`) omits the caption block, which otherwise makes the
    // embed taller than any viewport and forces a nested scrollbar.
    //
    // It may still refuse to render a private or age-restricted post - the
    // frontend falls back to a "View on Instagram" link.
    embed_url: `${canonical}embed/`,
    canonical_url: canonical,
    // Instagram does not offer a stable public thumbnail URL, and re-hosting
    // their media is not permitted, so the card falls back to a branded tile.
    thumbnail_url: null,
    embeddable: true
  };
};

const PARSERS = [parseYouTube, parseVimeo, parseInstagram];

/**
 * Resolves a user-supplied URL to safe, server-derived embed fields.
 *
 * @param {string} raw the URL exactly as typed by the freelancer
 * @returns {{ok: true, data: object} | {ok: false, error: object}}
 */
export const resolveExternalMedia = (raw) => {
  const url = safeParse(raw);
  if (!url) {
    return {
      ok: false,
      error: {
        code: 'INVALID_URL',
        message: 'Enter a valid https:// link.'
      }
    };
  }

  for (const parse of PARSERS) {
    const result = parse(url);
    if (result) return { ok: true, data: result };
  }

  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED_SOURCE',
      message:
        'That link is not supported. Paste a YouTube, Instagram or Vimeo link, or upload the file directly.',
      supported: ['YouTube', 'Instagram', 'Vimeo']
    }
  };
};

/** Human label for a source, used in UI badges. */
export const sourceLabel = (sourceType) =>
  ({ youtube: 'YouTube', instagram: 'Instagram', vimeo: 'Vimeo', upload: 'Uploaded' }[sourceType] || 'Link');


/* ------------------------------------------------------------------ */
/* Public social links                                                 */
/* ------------------------------------------------------------------ */

/**
 * Social profiles a freelancer may publish. Each is validated against its own
 * host allow-list so a "social link" cannot be used to point visitors at an
 * arbitrary site, and `website` is the only free-form entry.
 *
 * These are PUBLIC PROFILE URLS ONLY. No credential of any kind is requested,
 * accepted or stored - there is no password field anywhere in this flow.
 */
export const SOCIAL_PLATFORMS = {
  instagram: { label: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'm.youtube.com', 'youtu.be'] },
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'm.facebook.com'] },
  linkedin: { label: 'LinkedIn', hosts: ['linkedin.com', 'in.linkedin.com'] },
  website: { label: 'Website', hosts: null } // any https host
};

export const SOCIAL_KEYS = Object.keys(SOCIAL_PLATFORMS);

/**
 * Validates a `{ instagram, youtube, ... }` map of public profile URLs.
 *
 * An empty string clears a link. Anything that is not plain https on the
 * platform's own domain is rejected with the offending key named.
 *
 * @returns {{ok: true, values: object} | {ok: false, error: object}}
 */
export const validateSocialLinks = (input) => {
  const values = {};
  if (input === null || input === undefined) return { ok: true, values };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Social links must be an object.' } };
  }

  for (const key of SOCIAL_KEYS) {
    const raw = input[key];
    if (raw === undefined) continue;

    const value = String(raw || '').trim();
    if (!value) { values[key] = ''; continue; } // explicit clear

    const url = safeParse(value);
    if (!url) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SOCIAL_URL',
          field: key,
          message: `Enter a valid https:// ${SOCIAL_PLATFORMS[key].label} link.`
        }
      };
    }

    const allowed = SOCIAL_PLATFORMS[key].hosts;
    if (allowed && !allowed.includes(normaliseHost(url.hostname))) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SOCIAL_URL',
          field: key,
          message: `That does not look like a ${SOCIAL_PLATFORMS[key].label} link.`
        }
      };
    }

    values[key] = url.toString();
  }

  return { ok: true, values };
};

export default {
  resolveExternalMedia,
  sourceLabel,
  validateSocialLinks,
  SOURCE_TYPES,
  MEDIA_TYPES,
  SOCIAL_PLATFORMS,
  SOCIAL_KEYS
};
