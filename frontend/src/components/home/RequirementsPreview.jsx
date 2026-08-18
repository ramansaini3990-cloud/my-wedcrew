import { Link } from 'react-router-dom';
import { MapPin, CalendarDays, Users, ArrowRight } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Badge from '../ui/Badge';

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Live marketplace preview.
 *
 * Renders the real /api/requirements response. The backend already masks
 * private fields (venue, budget, company name) for unauthenticated visitors, so
 * this component only displays what the API chooses to return.
 */
export default function RequirementsPreview({ requirements = [], loading, error }) {
  const items = requirements.slice(0, 3);

  const budgetOf = (req) => {
    const value = req.payment_per_freelancer;
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return `₹${value.toLocaleString('en-IN')}`;
    return String(value); // already masked, e.g. "Hidden"
  };

  return (
    <section className="bg-brand-bg py-16 sm:py-20" aria-labelledby="requirements-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <SectionHeading
            align="left"
            eyebrow="Live Marketplace"
            title="Open"
            accent="Requirements"
            description="Briefs currently posted by production houses."
            className="md:mx-0"
          />
          <Link
            to="/requirements"
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy hover:text-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
          >
            Browse all requirements <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-brand-border bg-white p-5 animate-pulse">
                  <div className="h-4 w-1/2 rounded bg-brand-bg" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-brand-bg" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-brand-bg" />
                  <div className="mt-5 h-8 w-full rounded bg-brand-bg" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-10 text-center">
              <p className="text-[15px] font-semibold text-brand-navy">Requirements are unavailable right now</p>
              <p className="mt-1 text-[13px] text-brand-textSec">Please try again shortly.</p>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-10 text-center">
              <p className="text-[15px] font-semibold text-brand-navy">No open requirements right now</p>
              <p className="mt-1 text-[13px] text-brand-textSec">
                New briefs from production houses will appear here.
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {items.map((req) => {
                const budget = budgetOf(req);
                return (
                  <article
                    key={req._id || req.id}
                    className="group flex flex-col rounded-xl border border-brand-border bg-white p-5 shadow-sm hover:shadow-lg hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-[15px] font-bold text-brand-navy leading-snug group-hover:text-brand-primary transition-colors">
                        {req.category || 'Crew Requirement'}
                      </h3>
                      {req.status && (
                        <Badge variant={req.status === 'published' ? 'success' : 'neutral'}>
                          {req.status === 'published' ? 'Open' : req.status}
                        </Badge>
                      )}
                    </div>

                    <dl className="mt-3.5 space-y-1.5 text-[12px] text-brand-textSec">
                      {(req.city || req.state) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="shrink-0" aria-hidden="true" />
                          <dd className="truncate">{[req.city, req.state].filter(Boolean).join(', ')}</dd>
                        </div>
                      )}
                      {formatDate(req.event_date) && (
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="shrink-0" aria-hidden="true" />
                          <dd>{formatDate(req.event_date)}</dd>
                        </div>
                      )}
                      {typeof req.applications_count === 'number' && (
                        <div className="flex items-center gap-1.5">
                          <Users size={13} className="shrink-0" aria-hidden="true" />
                          <dd>
                            {req.applications_count}{' '}
                            {req.applications_count === 1 ? 'application' : 'applications'}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {budget && (
                      <p className="mt-3.5 pt-3.5 border-t border-brand-border text-[13px]">
                        <span className="text-brand-textSec">Budget: </span>
                        <span className="font-semibold text-brand-navy">{budget}</span>
                        {typeof req.payment_per_freelancer === 'number' && (
                          <span className="text-brand-textSec"> / person</span>
                        )}
                      </p>
                    )}

                    <Link
                      to="/requirements"
                      className="mt-auto pt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      View Requirement
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
