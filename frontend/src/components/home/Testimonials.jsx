import { Star, Quote } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Avatar from '../ui/Avatar';
import { TESTIMONIALS } from '../../config/homeContent';

/**
 * Testimonials.
 *
 * Renders nothing while TESTIMONIALS is empty. The project holds no testimonial
 * data, and inventing customer quotes would be dishonest - add verified entries
 * to config/homeContent.js to switch this section on.
 */
export default function Testimonials() {
  if (!TESTIMONIALS.length) return null;

  return (
    <section className="bg-brand-bg py-16 sm:py-20" aria-labelledby="testimonials-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Client Voices" title="Trusted by" accent="Production Teams" />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.id}
              className="rounded-xl border border-brand-border bg-white p-6 shadow-sm hover:shadow-lg transition-shadow duration-300"
            >
              <Quote size={22} className="text-brand-primary/25 mb-3" aria-hidden="true" />
              <blockquote className="text-[14px] text-brand-navy leading-relaxed">{t.quote}</blockquote>

              {typeof t.rating === 'number' && (
                <div className="mt-4 flex gap-0.5" aria-label={`Rated ${t.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < t.rating ? 'text-brand-primary' : 'text-brand-border'}
                      fill={i < t.rating ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}

              <figcaption className="mt-5 pt-5 border-t border-brand-border flex items-center gap-3">
                <Avatar user={t} size="md" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-brand-navy truncate">{t.name}</p>
                  <p className="text-[12px] text-brand-textSec truncate">
                    {[t.role, t.company].filter(Boolean).join(', ')}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
