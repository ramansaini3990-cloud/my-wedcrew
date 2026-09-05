import { Link } from 'react-router-dom';
import { MapPin, CalendarCheck, Briefcase, ArrowRight, Plane, Lock } from 'lucide-react';
import Avatar from '../ui/Avatar';
import AvailabilityBadge from './AvailabilityBadge';

const formatRange = (start, end) => {
  const opts = { day: 'numeric', month: 'short' };
  const s = new Date(start).toLocaleDateString('en-IN', opts);
  const e = new Date(end).toLocaleDateString('en-IN', opts);
  return s === e ? s : `${s} – ${e}`;
};

/**
 * Marketplace card for one professional.
 *
 * Every field is conditional: anything the backend does not provide is hidden
 * rather than filled with a placeholder. No fabricated ratings, experience,
 * verification or availability.
 */
export default function ProfessionalCard({ professional, actions = null, lockedActions = null }) {
  const p = professional || {};
  const id = p.id || p._id;

  // The backend withholds identity fields without an active subscription, so
  // `name` is genuinely absent here - this is a render of what we received,
  // not a client-side blur over data we were sent.
  const locked = p.locked === true;

  const location = [p.city, p.state].filter(Boolean).join(', ');
  const openDays = p.available_dates ? String(p.available_dates).split(',').filter(Boolean).length : 0;

  // Upcoming travel, excluding a block that is already active today.
  const upcoming = (p.upcoming_availability || []).filter((b) => {
    const today = new Date().setHours(0, 0, 0, 0);
    return new Date(b.start_date).setHours(0, 0, 0, 0) > today;
  });
  const nextTrip = upcoming[0];

  return (
    <article className="group flex flex-col rounded-xl border border-brand-border bg-white shadow-sm hover:shadow-lg hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3.5">
          {locked ? (
            <span
              className="h-12 w-12 shrink-0 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-brand-textSec"
              aria-hidden="true"
            >
              <Lock size={17} />
            </span>
          ) : (
            <Avatar user={p} size="lg" fallback="P" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-[16px] font-bold text-brand-navy leading-snug truncate group-hover:text-brand-primary transition-colors">
              {locked ? 'Verified Professional' : p.name || 'Professional'}
            </h3>
            {p.profession && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-brand-primary truncate">
                <Briefcase size={12} className="shrink-0" aria-hidden="true" />
                {p.profession}
              </p>
            )}
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-brand-textSec truncate">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Real availability only */}
        {(p.current_availability?.status && p.current_availability.status !== 'unknown') || p.match_type === 'travel' ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <AvailabilityBadge availability={p.current_availability} />
            {p.match_type === 'travel' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                <Plane size={11} aria-hidden="true" /> Travelling here
              </span>
            )}
          </div>
        ) : null}

        {/* Facts - each hidden when absent */}
        {(p.experience_years != null || openDays > 0) && (
          <dl className="mt-3.5 pt-3.5 border-t border-brand-border grid grid-cols-2 gap-3">
            {p.experience_years != null && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-textSec">Experience</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-brand-navy tabular-nums">
                  {p.experience_years} {p.experience_years === 1 ? 'year' : 'years'}
                </dd>
              </div>
            )}
            {openDays > 0 && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-textSec">Open days</dt>
                <dd className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-green-700 tabular-nums">
                  <CalendarCheck size={12} aria-hidden="true" /> {openDays}
                </dd>
              </div>
            )}
          </dl>
        )}

        {nextTrip && nextTrip.city && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-bg px-2.5 py-2 text-[11px] text-brand-textSec">
            <MapPin size={11} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
            <span>
              <span className="font-semibold text-brand-navy">
                {nextTrip.is_bookable ? 'Available in' : 'In'} {nextTrip.city}
              </span>{' '}
              · {formatRange(nextTrip.start_date, nextTrip.end_date)}
            </span>
          </p>
        )}
      </div>

      <div className="px-5 pb-5 pt-0 space-y-2">
        {locked ? (
          <>
            <p className="rounded-lg bg-brand-primary/5 border border-brand-primary/20 px-3 py-2.5 text-[12px] text-brand-navy">
              <span className="font-semibold">Subscribe to Unlock</span>
              <span className="block mt-0.5 text-brand-textSec">
                Get an active subscription to view full professional details and connect with professionals.
              </span>
            </p>
            <Link
              to="/#pricing"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              View Subscription Plans <ArrowRight size={14} aria-hidden="true" />
            </Link>
            {/* Actions that are safe without an unlocked identity - saving a
                bookmark, for instance. Opt-in, so callers that pass nothing
                (the public browse page) are unaffected. */}
            {lockedActions}
          </>
        ) : (
          <>
            <Link
              to={`/professionals/${id}`}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-navy text-white text-[13px] font-semibold hover:bg-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              View Profile <ArrowRight size={14} aria-hidden="true" />
            </Link>
            {actions}
          </>
        )}
      </div>
    </article>
  );
}
