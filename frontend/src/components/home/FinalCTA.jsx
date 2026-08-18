import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { FINAL_CTA } from '../../config/homeContent';

/**
 * Closing call to action.
 *
 * Uses the configured poster as the backdrop and layers a muted video on top
 * only when one is configured and loads successfully.
 */
export default function FinalCTA() {
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = Boolean(FINAL_CTA.video) && !videoFailed;

  return (
    <section className="relative overflow-hidden bg-brand-navy" aria-labelledby="final-cta-heading">
      <img
        src={FINAL_CTA.poster}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {showVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          poster={FINAL_CTA.poster}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={FINAL_CTA.video} type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-brand-navy/85" aria-hidden="true" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
        <h2
          id="final-cta-heading"
          className="font-serif text-2xl sm:text-3xl lg:text-[2.4rem] font-bold text-white leading-tight"
        >
          {FINAL_CTA.heading}
        </h2>
        <p className="mt-4 text-[15px] sm:text-base text-white/80 max-w-xl mx-auto leading-relaxed">
          {FINAL_CTA.description}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={FINAL_CTA.primaryCta.to}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
          >
            {FINAL_CTA.primaryCta.label}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to={FINAL_CTA.secondaryCta.to}
            className="inline-flex items-center px-6 py-3 rounded-lg border border-white/35 text-white text-sm font-semibold hover:bg-white/10 hover:border-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
          >
            {FINAL_CTA.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
