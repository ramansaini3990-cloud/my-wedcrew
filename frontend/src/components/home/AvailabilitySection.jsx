import { Link } from 'react-router-dom';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { AVAILABILITY_LEGEND } from '../../config/homeContent';

const WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Availability explainer.
 *
 * Presentational only - it visualises the freelancer availability system that
 * already exists (Availability model + `available_dates` on the public
 * professionals API) and reuses those real dates. No duplicate availability
 * logic and no new endpoint.
 */
export default function AvailabilitySection({ professionals = [], loading }) {
  const withDates = professionals.filter((p) => p.available_dates);
  const totalOpenDays = withDates.reduce(
    (sum, p) => sum + String(p.available_dates).split(',').filter(Boolean).length,
    0
  );

  const openDates = new Set(
    withDates.flatMap((p) => String(p.available_dates).split(',').filter(Boolean))
  );

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, open: openDates.has(key) };
  });

  return (
    <section
      className="bg-brand-surface py-16 sm:py-20 border-y border-brand-border"
      aria-labelledby="availability-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Real-Time Availability"
              title="Book the right crew at"
              accent="the right time."
              description="Freelancers publish the dates they can work, so a crew can be confirmed without a single phone call."
              className="md:mx-0"
            />

            <div className="mt-7 flex flex-wrap gap-2">
              {AVAILABILITY_LEGEND.map((item) => (
                <span
                  key={item.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold ${item.className}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>

            {!loading && totalOpenDays > 0 && (
              <p className="mt-6 flex items-start gap-2 text-[13px] text-brand-textSec">
                <CalendarCheck size={15} className="mt-0.5 text-green-600 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-brand-navy tabular-nums">{totalOpenDays}</span>{' '}
                  open crew {totalOpenDays === 1 ? 'day' : 'days'} published across{' '}
                  <span className="font-semibold text-brand-navy tabular-nums">{withDates.length}</span>{' '}
                  {withDates.length === 1 ? 'professional' : 'professionals'}.
                </span>
              </p>
            )}

            <Link
              to="/freelancers"
              className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand-navy text-white text-sm font-semibold hover:bg-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              Check Availability <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-4">
              {today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <div
              className="grid grid-cols-7 gap-1.5"
              role="img"
              aria-label="Calendar showing which days have professionals available"
            >
              {WEEK_LABELS.map((label) => (
                <span
                  key={label}
                  className="text-center text-[10px] font-semibold text-brand-muted py-1"
                  aria-hidden="true"
                >
                  {label.charAt(0)}
                </span>
              ))}
              {days.map(({ day, open }) => (
                <span
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium tabular-nums ${
                    open
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-brand-bg text-brand-muted border border-transparent'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-brand-textSec">
              {loading
                ? 'Loading published availability...'
                : 'Highlighted days have at least one professional available.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
