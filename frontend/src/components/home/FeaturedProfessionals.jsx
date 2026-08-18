import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, CalendarCheck, ArrowRight } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

/**
 * Featured professionals, rendered from the REAL public freelancer API.
 * Never invents users: shows a skeleton while loading, a message on failure and
 * a clear empty state when the network has no professionals yet.
 */
export default function FeaturedProfessionals({ professionals = [], loading, error }) {
  const featured = professionals.slice(0, 4);

  const availableCount = (pro) => {
    if (!pro.available_dates) return 0;
    return String(pro.available_dates).split(',').filter(Boolean).length;
  };

  return (
    <section className="bg-brand-surface py-16 sm:py-20 border-y border-brand-border" aria-labelledby="featured-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <SectionHeading
            align="left"
            eyebrow="Verified Talent"
            title="Featured"
            accent="Professionals"
            description="Crew members currently listed on the network."
            className="md:mx-0"
          />
          <Link
            to="/freelancers"
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy hover:text-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
          >
            View all professionals <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-brand-border bg-white p-5 animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-brand-bg" />
                  <div className="mt-4 h-3.5 w-2/3 rounded bg-brand-bg" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-brand-bg" />
                  <div className="mt-5 h-8 w-full rounded bg-brand-bg" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-brand-border bg-brand-bg p-10 text-center">
              <p className="text-[15px] font-semibold text-brand-navy">Professionals are unavailable right now</p>
              <p className="mt-1 text-[13px] text-brand-textSec">
                We could not reach the network. Please try again shortly.
              </p>
            </div>
          )}

          {!loading && !error && featured.length === 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-bg p-10 text-center">
              <p className="text-[15px] font-semibold text-brand-navy">No professionals listed yet</p>
              <p className="mt-1 text-[13px] text-brand-textSec">
                Verified crew will appear here as they join the network.
              </p>
              <Link
                to="/register"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
              >
                Join as Freelancer
              </Link>
            </div>
          )}

          {!loading && !error && featured.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((pro) => {
                const slots = availableCount(pro);
                return (
                  <article
                    key={pro._id || pro.id}
                    className="group rounded-xl border border-brand-border bg-white p-5 shadow-sm hover:shadow-lg hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar user={pro} size="lg" fallback="P" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-serif text-[15px] font-bold text-brand-navy truncate group-hover:text-brand-primary transition-colors">
                          {pro.name || 'Professional'}
                        </h3>
                        {pro.profession && (
                          <p className="text-[12px] text-brand-primary font-medium truncate mt-0.5">
                            {pro.profession}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-1.5">
                      {(pro.city || pro.state) && (
                        <p className="flex items-center gap-1.5 text-[12px] text-brand-textSec">
                          <MapPin size={13} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {[pro.city, pro.state].filter(Boolean).join(', ')}
                          </span>
                        </p>
                      )}
                      {slots > 0 && (
                        <p className="flex items-center gap-1.5 text-[12px] text-brand-textSec">
                          <CalendarCheck size={13} className="shrink-0 text-green-600" aria-hidden="true" />
                          {slots} {slots === 1 ? 'day' : 'days'} available
                        </p>
                      )}
                    </div>

                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      <Badge variant="accent" icon={ShieldCheck}>Verified</Badge>
                      {slots > 0 && <Badge variant="success">Available</Badge>}
                    </div>

                    <Link
                      to="/freelancers"
                      className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      View Profile
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
