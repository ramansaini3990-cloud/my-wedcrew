import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { CATEGORIES } from '../../config/homeContent';

/**
 * Elite categories.
 *
 * Professional counts are computed from the live professionals list by matching
 * each category's keywords against the freelancer `profession` field. When the
 * count is zero or still loading, the badge is simply omitted - no fake numbers.
 */
export default function CategorySection({ professionals = [], loading }) {
  const countFor = (category) => {
    if (!professionals.length) return 0;
    return professionals.filter((p) => {
      const prof = (p.profession || '').toLowerCase();
      return category.match.some((m) => prof.includes(m));
    }).length;
  };

  return (
    <section className="bg-brand-bg py-16 sm:py-20" aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Specialised Crew"
          title="Elite"
          accent="Categories"
          description="Every craft a premium wedding production needs, verified and ready to book."
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CATEGORIES.map((category) => {
            const count = countFor(category);
            return (
              <Link
                key={category.id}
                to={`/freelancers?profession=${encodeURIComponent(category.name)}`}
                className="group relative overflow-hidden rounded-xl bg-brand-surface border border-brand-border shadow-sm hover:shadow-lg hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                <div className="relative h-40 overflow-hidden bg-brand-bg">
                  <img
                    src={category.image}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    width="600"
                    height="400"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/70 via-brand-navy/10 to-transparent" />
                  {!loading && count > 0 && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-white/95 text-brand-navy text-[10px] font-bold uppercase tracking-wider">
                      {count} {count === 1 ? 'pro' : 'pros'}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-base font-bold text-brand-navy leading-snug group-hover:text-brand-primary transition-colors">
                      {category.name}
                    </h3>
                    <ArrowUpRight
                      size={16}
                      className="mt-0.5 shrink-0 text-brand-textSec group-hover:text-brand-primary transition-colors"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-[13px] text-brand-textSec leading-relaxed">
                    {category.description}
                  </p>
                </div>

                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
