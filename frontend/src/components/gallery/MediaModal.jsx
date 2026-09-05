import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { X, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { mediaUrl, sourceMeta, externalLabel } from '../../utils/mediaEmbed';

/**
 * Measured layout of Instagram's official reel embed (`/embed/`).
 *
 * Its document is, top to bottom: a fixed-height account header, a 4:5 media
 * box, then a footer (View more on Instagram / like / comment / share / save /
 * likes count / add a comment).
 *
 * The footer lives inside a cross-origin iframe, so it cannot be hidden with
 * CSS from this side, and reaching into Instagram's DOM is off-limits. Instead
 * the viewer sizes its own window to exactly `header + media` and clips the
 * rest: the official embed still loads and plays untouched, we simply do not
 * give the footer any room.
 *
 * Verified at widths 320 / 400 / 448 - the header stays 56px and the media box
 * stays 4:5 at every width.
 */
const IG_HEADER_PX = 56;
const IG_MEDIA_RATIO = 1.25; // media height ÷ width (4:5)
const IG_MAX_WIDTH = 500;    // px - the height check below shrinks this when needed

/**
 * In-site media viewer.
 *
 * Playback happens INSIDE the site: YouTube/Vimeo/Instagram render in the
 * platform's own official embed iframe, uploads render in a native <video>.
 * Visitors are never navigated away - the "Watch on ..." link is a fallback
 * shown only when a platform refuses to embed.
 *
 * The iframe/video element is created only when this modal opens, so a gallery
 * of 40 videos costs 40 thumbnails and zero players until something is clicked.
 *
 * `embed_url` is always a server-derived value built from an allow-listed host
 * (see backend mediaEmbedService); it is never assembled from raw user input.
 */
export default function MediaModal({ item, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const timerRef = useRef(null);

  const isEmbed = Boolean(item?.embed_url);
  const isUploadVideo = item?.source_type === 'upload' && item?.media_type === 'video';
  const isImage = item?.media_type === 'image' && item?.source_type === 'upload';

  /* Escape to close, and focus moves into the dialog when it opens. */
  useEffect(() => {
    if (!item) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  /* Lock background scrolling without the layout shifting as the bar hides. */
  useEffect(() => {
    if (!item) return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [item]);

  /* Reset per item, and give an embed a deadline before offering the fallback. */
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    setLoaded(false);
    setFailed(false);
    clearTimeout(timerRef.current);

    if (item && isEmbed) {
      // A cross-origin iframe that is blocked often never fires onError, so a
      // timeout is the only reliable signal. Instagram in particular refuses
      // private/age-restricted posts silently. The ref (not state) is read here
      // so the check stays outside React's updater.
      timerRef.current = setTimeout(() => {
        if (!loadedRef.current) setFailed(true);
      }, 8000);
    }
    return () => clearTimeout(timerRef.current);
  }, [item, isEmbed]);

  const handleLoaded = useCallback(() => {
    clearTimeout(timerRef.current);
    loadedRef.current = true;
    setLoaded(true);
  }, []);

  /**
   * Sizes the Instagram window to `header + 4:5 media`, shrinking the width
   * when the viewport is too short so the reel always fits without scrolling.
   * useLayoutEffect so the box is measured before paint - no visible resize.
   */
  const headerRef = useRef(null);
  const [igBox, setIgBox] = useState(null);
  const isInstagramSource = item?.source_type === 'instagram';

  useLayoutEffect(() => {
    if (!item || !isInstagramSource) {
      setIgBox(null);
      return undefined;
    }
    const measure = () => {
      // Measured from the viewport, never from the rendered stage: the dialog
      // width is derived FROM this result, so reading the stage back would be
      // a feedback loop (and left the embed narrower than the dialog, which is
      // what produced the navy gutters down either side).
      const pad = window.innerWidth >= 640 ? 48 : 24;
      const chrome = (headerRef.current?.offsetHeight || 76) + pad;
      const availableW = Math.min(IG_MAX_WIDTH, window.innerWidth - pad);
      const availableH = window.innerHeight - chrome;
      const width = Math.max(
        200,
        Math.min(availableW, (availableH - IG_HEADER_PX) / IG_MEDIA_RATIO)
      );
      setIgBox({
        width: Math.round(width),
        height: Math.round(IG_HEADER_PX + width * IG_MEDIA_RATIO)
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [item, isInstagramSource]);

  /* Trap Tab inside the dialog while it is open. */
  const onKeyDownTrap = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll(
      'button, a[href], iframe, video, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!item) return null;

  const meta = sourceMeta(item.source_type);

  /**
   * Instagram gets a reel-shaped viewer: a narrow portrait column instead of
   * the wide 16:9 stage used by YouTube/Vimeo/uploads.
   *
   * The dialog is a fixed-height flex column (header + stage) that never
   * exceeds the viewport, so neither the modal nor the embed can scroll. The
   * embed is Instagram's official one - only the frame around it changes.
   */
  const isInstagram = item.source_type === 'instagram';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-brand-navy/80 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onKeyDown={onKeyDownTrap}
        // Flex column + overflow-hidden: the dialog is sized by the viewport,
        // so it can never grow tall enough to need its own scrollbar.
        className={`flex flex-col overflow-hidden rounded-xl bg-brand-surface shadow-2xl ${
          isInstagram ? '' : 'w-full max-w-4xl'
        }`}
        // Instagram: the dialog is exactly as wide and as tall as the embed, so
        // the reel sits flush to every edge - no gutters, no leftover space.
        style={
          isInstagram && igBox
            ? { width: igBox.width, maxHeight: 'calc(100dvh - 1.5rem)' }
            : { maxHeight: 'calc(100dvh - 1.5rem)' }
        }
      >
        {/* Header - fixed height, never scrolls away */}
        <div
          ref={headerRef}
          className="flex shrink-0 items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-brand-border"
        >
          <div className="min-w-0">
            <h2 className="font-serif text-base sm:text-lg font-bold text-brand-navy truncate">{item.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-brand-textSec">
              {item.category && <span className="truncate">{item.category}</span>}
              {item.category && <span aria-hidden="true">·</span>}
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-semibold ${meta.className}`}>
                {meta.label}
              </span>
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-9 w-9 rounded-lg text-brand-textSec hover:text-brand-primary hover:bg-brand-primary/5 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Stage */}
        <div className={`bg-brand-navy ${isInstagram ? 'shrink-0' : 'min-h-0 flex-1'}`}>
          <div
            className="relative w-full overflow-hidden"
            style={
              isInstagram
                ? // Exactly the embed's header + 4:5 media. Anything Instagram
                  // renders below that - its action/footer bar - falls outside
                  // this box and is clipped, never scrolled.
                  igBox
                  ? { width: '100%', height: igBox.height }
                  : { aspectRatio: '1 / 1.39' } // pre-measure fallback
                : { aspectRatio: '16 / 9', maxHeight: '72vh' }
            }
          >
            {/* Loading state */}
            {!loaded && !failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                <span className="text-[12px]">Loading…</span>
              </div>
            )}

            {/* Error state - never a blank frame */}
            {failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle size={26} className="text-brand-primary" aria-hidden="true" />
                <p className="text-[13.5px] font-semibold text-white">Unable to play this video here.</p>
                <p className="text-[12px] text-white/60 max-w-sm">
                  {item.source_type === 'instagram'
                    ? 'Instagram does not allow this post to be embedded on other sites.'
                    : 'The source refused to load this media.'}
                </p>
                {item.media_url && (
                  <a
                    href={item.media_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-primaryDark transition-colors"
                  >
                    {externalLabel(item.source_type)}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {/* Platform embed (YouTube / Vimeo / Instagram) */}
            {isEmbed && !failed && (
              <iframe
                key={item.id}
                src={item.embed_url}
                title={item.title}
                onLoad={handleLoaded}
                onError={() => setFailed(true)}
                loading="lazy"
                // A cross-origin document's scrollbars cannot be styled from
                // here, so this attribute is the only way to stop the embed
                // becoming a scrollable page inside the viewer.
                scrolling="no"
                // No allow-popups / no same-origin: the embed cannot reach our
                // page or open windows. allow-scripts is required by all three
                // players; presentation enables native fullscreen.
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 200ms ease-out' }}
              />
            )}

            {/* Uploaded video - native HTML5 controls */}
            {isUploadVideo && !failed && (
              <video
                key={item.id}
                src={mediaUrl(item.media_url)}
                poster={item.thumbnail_url ? mediaUrl(item.thumbnail_url) : undefined}
                controls
                playsInline
                preload="metadata"
                onLoadedData={handleLoaded}
                onCanPlay={handleLoaded}
                onError={() => setFailed(true)}
                className="absolute inset-0 h-full w-full bg-black object-contain"
              >
                Your browser cannot play this video.
              </video>
            )}

            {/* Uploaded image */}
            {isImage && !failed && (
              <img
                key={item.id}
                src={mediaUrl(item.media_url)}
                alt={item.title}
                onLoad={handleLoaded}
                onError={() => setFailed(true)}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
        </div>

        {/* Description.
            Hidden for Instagram: the reel viewer is deliberately just the
            header and the video, with nothing else competing for height. */}
        {item.description && !isInstagram && (
          <div className="max-h-28 shrink-0 overflow-y-auto border-t border-brand-border px-4 sm:px-5 py-3.5">
            <p className="text-[13px] leading-relaxed text-brand-navy whitespace-pre-line">{item.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
