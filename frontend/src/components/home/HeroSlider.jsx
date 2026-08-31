import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { HERO_SLIDES, HERO_MEDIA } from '../../config/homeContent';

/** Honours the OS "reduce motion" setting for autoplay and transitions. */
const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
};

/**
 * Cinematic hero.
 *
 * MEDIA STRATEGY
 * --------------
 * Every slide paints its poster image first, so the hero is never blank and a
 * missing/failed/blocked video simply leaves the still in place.
 *
 * A <video> element is mounted ONLY for the active slide (and optionally the
 * next one, warmed with preload="metadata"). Non-adjacent slides hold no video
 * element at all, so several large files are never downloaded at once.
 *
 * Playback is muted + playsInline so mobile browsers allow autoplay; if the
 * play() promise still rejects, the poster remains and nothing breaks. The
 * video is paused whenever the hero scrolls out of view.
 *
 * All timing, overlay strength and toggles live in HERO_MEDIA in
 * config/homeContent.js - this component reads them, it does not define them.
 */
export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [failedVideos, setFailedVideos] = useState({});
  const [readyVideos, setReadyVideos] = useState({});
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(true);

  const reducedMotion = usePrefersReducedMotion();
  const timerRef = useRef(null);
  const sectionRef = useRef(null);
  const videoRefs = useRef({});

  const slides = HERO_SLIDES;
  const slideCount = slides.length;

  const goTo = useCallback(
    (next) => setIndex(((next % slideCount) + slideCount) % slideCount),
    [slideCount]
  );
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const nextIndex = (index + 1) % slideCount;

  /** Only the active slide, and (optionally) the one after it, hold a <video>. */
  const shouldMountVideo = (i, slide) => {
    if (!slide.video || failedVideos[slide.id]) return false;
    if (i === index) return true;
    return HERO_MEDIA.preloadNext && i === nextIndex;
  };

  // Pause playback while the hero is off-screen - no decoding cost when the
  // visitor has scrolled past it.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Drive play/pause from state rather than relying on the autoplay attribute,
  // so a rejected play() can be caught and degraded to the poster.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const isActive = slides[index]?.id === id;

      if (isActive && inView) {
        el.muted = muted;
        const attempt = el.play();
        if (attempt && typeof attempt.catch === 'function') {
          // Autoplay blocked (common on mobile / low-power mode): keep the
          // poster. The updater returns the SAME object when nothing changes,
          // so a repeated rejection cannot trigger another render.
          attempt.catch(() =>
            setReadyVideos((r) => (r[id] === false ? r : { ...r, [id]: false }))
          );
        }
      } else if (!el.paused) {
        el.pause();
      }
    });
    // `readyVideos` is deliberately NOT a dependency: it is written inside this
    // effect, and including it would re-run the effect on every rejection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, inView, muted, slides]);

  // Autoplay rotation, paused under reduced-motion or when off-screen.
  useEffect(() => {
    if (reducedMotion || slideCount <= 1 || !inView) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(next, HERO_MEDIA.rotationMs);
    return () => clearTimeout(timerRef.current);
  }, [index, next, reducedMotion, slideCount, inView]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  };

  const activeSlide = slides[index];
  const activeVideoPlaying =
    Boolean(activeSlide?.video) && readyVideos[activeSlide.id] && !failedVideos[activeSlide.id];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[36rem] h-[calc(100vh-5rem)] max-h-[46rem] w-full overflow-hidden bg-brand-navy"
      aria-roledescription="carousel"
      aria-label="mywedcrew.com highlights"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {slides.map((slide, i) => {
        const isActive = i === index;
        const mountVideo = shouldMountVideo(i, slide);
        const videoVisible = isActive && mountVideo && readyVideos[slide.id];

        return (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity ease-out"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? undefined : 'none',
              transitionDuration: `${reducedMotion ? 0 : HERO_MEDIA.fadeMs}ms`
            }}
            aria-hidden={!isActive}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slideCount}`}
          >
            {/* Poster is always painted, so the hero is never blank. */}
            <img
              src={slide.poster}
              alt=""
              aria-hidden="true"
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {mountVideo && (
              <video
                ref={(el) => { videoRefs.current[slide.id] = el; }}
                loop
                muted={muted}
                playsInline
                // The active slide loads fully; the queued one only warms metadata.
                preload={isActive ? 'auto' : 'metadata'}
                poster={slide.poster}
                tabIndex={-1}
                aria-hidden="true"
                onCanPlay={() => setReadyVideos((r) => ({ ...r, [slide.id]: true }))}
                onError={() => setFailedVideos((f) => ({ ...f, [slide.id]: true }))}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                style={{ opacity: videoVisible ? 1 : 0 }}
              >
                <source src={slide.video} type="video/mp4" />
              </video>
            )}

            {/* Cinematic legibility overlay */}
            <div className={`absolute inset-0 bg-gradient-to-r ${HERO_MEDIA.overlaySide}`} />
            <div className={`absolute inset-0 bg-gradient-to-t ${HERO_MEDIA.overlayBottom}`} />
          </div>
        );
      })}

      {/* Slide copy */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="max-w-2xl pt-14 pb-24 sm:pb-28">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className={`transition-all duration-700 ${
                i === index ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 absolute pointer-events-none'
              }`}
              aria-hidden={i !== index}
            >
              {i === index && (
                <>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary mb-4">
                    {slide.eyebrow}
                  </p>
                  <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.4rem] font-bold text-white leading-[1.08] drop-shadow-sm">
                    {slide.heading}
                    <br />
                    <span className="text-brand-primary italic">{slide.headingAccent}</span>
                  </h1>
                  <p className="mt-5 text-[15px] sm:text-base text-white/85 max-w-xl leading-relaxed">
                    {slide.description}
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      to={slide.primaryCta.to}
                      className="group inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                    >
                      {slide.primaryCta.label}
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      to={slide.secondaryCta.to}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/35 text-white text-sm font-semibold hover:bg-white/10 hover:border-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                    >
                      {slide.secondaryCta.label}
                    </Link>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      {slideCount > 1 && (
        <div className="absolute z-20 bottom-7 sm:bottom-9 left-0 right-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="h-9 w-9 rounded-full border border-white/30 text-white/90 flex items-center justify-center hover:bg-white/10 hover:border-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="h-9 w-9 rounded-full border border-white/30 text-white/90 flex items-center justify-center hover:bg-white/10 hover:border-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight size={17} />
            </button>

            <div className="flex items-center gap-2 ml-1">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className="group py-2 focus:outline-none"
                >
                  <span
                    className={`relative block h-0.5 rounded-full overflow-hidden transition-all duration-300 ${
                      i === index ? 'w-10 bg-white/30' : 'w-5 bg-white/40 group-hover:bg-white/70'
                    }`}
                  >
                    {/* Elapsed-time indicator on the active slide only. */}
                    {i === index && HERO_MEDIA.showProgress && !reducedMotion && inView && (
                      <span
                        key={`progress-${index}`}
                        className="absolute inset-y-0 left-0 bg-brand-primary"
                        style={{ animation: `heroProgress ${HERO_MEDIA.rotationMs}ms linear forwards` }}
                      />
                    )}
                    {i === index && (!HERO_MEDIA.showProgress || reducedMotion || !inView) && (
                      <span className="absolute inset-0 bg-brand-primary" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Sound control appears only once a video is genuinely playing. */}
            {HERO_MEDIA.showMuteControl && activeVideoPlaying && (
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute video' : 'Mute video'}
                aria-pressed={!muted}
                className="ml-auto h-9 w-9 rounded-full border border-white/30 text-white/90 flex items-center justify-center hover:bg-white/10 hover:border-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
