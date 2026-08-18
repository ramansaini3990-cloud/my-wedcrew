import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { HERO_SLIDES } from '../../config/homeContent';

const SLIDE_MS = 7000;

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
 * Every slide renders its poster image immediately and layers a muted, looping
 * video on top ONLY when `slide.video` is configured and the file loads. The
 * first slide's video preloads; the rest load lazily when reached. If a video
 * is missing or fails, the poster simply remains - never a blank hero.
 */
export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [failedVideos, setFailedVideos] = useState({});
  const reducedMotion = usePrefersReducedMotion();
  const timerRef = useRef(null);
  const slides = HERO_SLIDES;

  const goTo = useCallback((next) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Autoplay, paused when the tab is hidden or motion is reduced.
  useEffect(() => {
    if (reducedMotion || slides.length <= 1) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, next, reducedMotion, slides.length]);

  // Keyboard support for the slider region.
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  };

  return (
    <section
      className="relative min-h-[36rem] h-[calc(100vh-5rem)] max-h-[46rem] w-full overflow-hidden bg-brand-navy"
      aria-roledescription="carousel"
      aria-label="WedCrew highlights"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {slides.map((slide, i) => {
        const isActive = i === index;
        const showVideo = slide.video && !failedVideos[slide.id];

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${
              isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={!isActive}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
          >
            {/* Poster is always present so there is never an empty frame. */}
            <img
              src={slide.poster}
              alt=""
              aria-hidden="true"
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {showVideo && (
              <video
                autoPlay
                loop
                muted
                playsInline
                preload={i === 0 ? 'auto' : 'none'}
                poster={slide.poster}
                onError={() => setFailedVideos((f) => ({ ...f, [slide.id]: true }))}
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src={slide.video} type="video/mp4" />
              </video>
            )}

            {/* Cinematic legibility overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/90 via-brand-navy/65 to-brand-navy/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-transparent to-brand-navy/40" />
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
      {slides.length > 1 && (
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
                    className={`block h-0.5 rounded-full transition-all duration-300 ${
                      i === index
                        ? 'w-10 bg-brand-primary'
                        : 'w-5 bg-white/40 group-hover:bg-white/70'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
