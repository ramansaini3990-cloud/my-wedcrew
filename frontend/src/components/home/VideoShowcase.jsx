import { useState, useEffect, useCallback } from 'react';
import { Play, X } from 'lucide-react';
import { SHOWCASE_VIDEOS } from '../../config/homeContent';

/**
 * Cinematic showcase with a lightbox.
 *
 * Videos are lazy: nothing loads until a tile is opened, and playback never
 * starts muted-autoplay in the grid. Tiles whose `video` is not configured
 * render as stills and are not clickable, so no fabricated media is embedded.
 */
export default function VideoShowcase() {
  const [active, setActive] = useState(null);
  const featured = SHOWCASE_VIDEOS.find((v) => v.featured) || SHOWCASE_VIDEOS[0];
  const rest = SHOWCASE_VIDEOS.filter((v) => v.id !== featured?.id);

  const close = useCallback(() => setActive(null), []);

  // Escape to close + lock background scroll while open.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, close]);

  if (!featured) return null;

  const Tile = ({ item, large = false }) => {
    const playable = Boolean(item.video);
    const Wrapper = playable ? 'button' : 'div';

    return (
      <Wrapper
        {...(playable
          ? { type: 'button', onClick: () => setActive(item), 'aria-label': `Play ${item.title}` }
          : {})}
        className={`group relative w-full overflow-hidden rounded-xl border border-brand-border bg-brand-navy text-left ${
          large ? 'h-[19rem] sm:h-[24rem]' : 'h-[9rem] sm:h-[11.4rem]'
        } ${playable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2' : ''}`}
      >
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          decoding="async"
          width={large ? '1200' : '600'}
          height={large ? '800' : '400'}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/25 to-transparent" />

        {playable && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-12 w-12 rounded-full bg-white/95 text-brand-primary flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play size={18} className="ml-0.5" fill="currentColor" aria-hidden="true" />
            </span>
          </span>
        )}

        <span className="absolute bottom-0 left-0 right-0 p-4">
          <span className={`block font-serif font-bold text-white ${large ? 'text-lg' : 'text-sm'}`}>
            {item.title}
          </span>
          <span className="block text-[12px] text-white/75 mt-0.5">{item.caption}</span>
        </span>
      </Wrapper>
    );
  };

  return (
    <section className="bg-brand-navy py-16 sm:py-20" aria-labelledby="showcase-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary mb-3">
            The Showcase
          </p>
          <h2 id="showcase-heading" className="font-serif text-2xl sm:text-3xl lg:text-[2.1rem] font-bold text-white leading-tight">
            Stories Worth <span className="text-brand-primary italic">Remembering.</span>
          </h2>
          <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
            A look at the range of productions this network delivers.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Tile item={featured} large />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 content-start">
            {rest.map((item) => (
              <Tile key={item.id} item={item} />
            ))}
          </div>
        </div>

        {SHOWCASE_VIDEOS.every((v) => !v.video) && (
          <p className="mt-6 text-center text-[12px] text-white/45">
            Showreels are added from the media configuration.
          </p>
        )}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/90 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={close}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={close}
              aria-label="Close video"
              className="absolute -top-11 right-0 h-9 w-9 rounded-full border border-white/30 text-white flex items-center justify-center hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={18} />
            </button>
            <video
              src={active.video}
              poster={active.poster}
              controls
              autoPlay
              playsInline
              className="w-full rounded-xl bg-black aspect-video"
            >
              Your browser does not support embedded video.
            </video>
            <p className="mt-3 font-serif text-base font-bold text-white">{active.title}</p>
          </div>
        </div>
      )}
    </section>
  );
}
