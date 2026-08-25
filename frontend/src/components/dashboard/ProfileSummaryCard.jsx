import { Link } from 'react-router-dom';
import { MapPin, Briefcase, CalendarRange, Pencil, ExternalLink } from 'lucide-react';
import Avatar from '../ui/Avatar';
import AvailabilityBadge from '../professionals/AvailabilityBadge';

const fmtRange = (start, end) => {
  const opts = { day: 'numeric', month: 'short' };
  const s = new Date(start).toLocaleDateString('en-IN', opts);
  const e = new Date(end).toLocaleDateString('en-IN', opts);
  return s === e ? s : `${s} – ${e}`;
};

/**
 * Dashboard profile summary for Freelancer and Company.
 *
 * Reads the signed-in user's own profile (GET /api/profile/me), so it shows
 * only what the account actually has. Private fields (email, phone, exact
 * address, coordinates) are deliberately NOT rendered here - this block mirrors
 * what the public sees, plus edit shortcuts.
 */
export default function ProfileSummaryCard({
  profile,
  loading,
  role = 'freelancer',
  onEdit,
  quickActions = null
}) {
  const isCompany = role === 'company';

  if (loading) {
    return (
      <div className="bg-brand-surface rounded-xl border border-brand-border p-5 animate-pulse">
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-full bg-brand-bg shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-40 rounded bg-brand-bg" />
            <div className="h-3 w-28 rounded bg-brand-bg" />
            <div className="h-3 w-36 rounded bg-brand-bg" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const today = new Date().setHours(0, 0, 0, 0);
  const blocks = profile.availability_blocks || [];

  const currentBlock = blocks.find(
    (b) => new Date(b.start_date).setHours(0, 0, 0, 0) <= today && new Date(b.end_date).setHours(0, 0, 0, 0) >= today
  );
  const nextBlock = blocks.find((b) => new Date(b.start_date).setHours(0, 0, 0, 0) > today);

  const cityOf = (b) => b?.city_id?.name || b?.city || null;
  const stateOf = (b) => b?.state_id?.name || b?.state || null;

  const incomplete = !profile.profession_id || !profile.city_id;

  return (
    <div className="bg-brand-surface rounded-xl border border-brand-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Avatar user={profile} size="xl" fallback={isCompany ? 'C' : 'F'} />

        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl font-bold text-brand-navy leading-tight truncate">
            {profile.name || (isCompany ? 'Company' : 'Professional')}
          </h2>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {profile.profession ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-primary">
                <Briefcase size={13} aria-hidden="true" />
                {profile.profession}
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-brand-textSec">
                <MapPin size={13} aria-hidden="true" />
                {location}
              </span>
            ) : null}
          </div>

          {/* Real availability only - derived from published blocks */}
          {currentBlock && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AvailabilityBadge
                availability={{ status: currentBlock.status, city: cityOf(currentBlock) }}
                showLocation
              />
            </div>
          )}

          {nextBlock && cityOf(nextBlock) && (
            <p className="mt-2.5 inline-flex items-start gap-1.5 rounded-lg bg-brand-bg px-2.5 py-1.5 text-[12px] text-brand-textSec">
              <CalendarRange size={12} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
              <span>
                Upcoming:{' '}
                <span className="font-semibold text-brand-navy">
                  {[cityOf(nextBlock), stateOf(nextBlock)].filter(Boolean).join(', ')}
                </span>{' '}
                · {fmtRange(nextBlock.start_date, nextBlock.end_date)}
              </span>
            </p>
          )}

          {incomplete && (
            <p className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 text-[12px] text-yellow-800">
              Complete your {[!profile.profession_id && 'profession', !profile.city_id && 'location']
                .filter(Boolean)
                .join(' and ')}{' '}
              so companies can find you.
            </p>
          )}
        </div>

        <div className="flex sm:flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <Pencil size={13} aria-hidden="true" /> Edit Profile
          </button>
          {!isCompany && profile.id && (
            <Link
              to={`/professionals/${profile.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-border text-brand-navy text-[13px] font-semibold hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              <ExternalLink size={13} aria-hidden="true" /> View Profile
            </Link>
          )}
        </div>
      </div>

      {quickActions && (
        <div className="mt-4 pt-4 border-t border-brand-border flex flex-wrap gap-2">{quickActions}</div>
      )}
    </div>
  );
}
