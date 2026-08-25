import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Briefcase, CalendarCheck, ArrowLeft, AlertCircle,
  Loader2, Camera, CalendarRange
} from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import AvailabilityBadge from '../components/professionals/AvailabilityBadge';

const fmt = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  value ? new Date(value).toLocaleDateString('en-IN', opts) : '';

const fmtRange = (start, end) => {
  const short = { day: 'numeric', month: 'short' };
  const s = fmt(start, short);
  const e = fmt(end, short);
  return s === e ? s : `${s} – ${e}`;
};

const Section = ({ title, children }) => (
  <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3.5">{title}</h2>
    {children}
  </section>
);

/**
 * Public professional profile.
 *
 * Reads GET /api/public/freelancers/:id, which returns an allow-listed DTO -
 * email, phone, manual address and coordinates are never sent to the browser,
 * so nothing sensitive can be revealed by inspecting the network tab.
 *
 * Contact happens only through the existing booking workflow; no direct
 * personal contact details are shown.
 */
export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [booking, setBooking] = useState({ loading: false, message: null, type: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/public/freelancers/${id}`);
      setProfile(res.data?.data || null);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? 'This professional profile could not be found.'
          : 'Unable to load this profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /** Reuses the existing booking-request flow - no second system. */
  const requestBooking = async () => {
    setBooking({ loading: true, message: null, type: null });
    try {
      await api.post('/api/booking-requests', { freelancer_id: id });
      setBooking({ loading: false, type: 'success', message: 'Booking request sent. You will be notified when they respond.' });
    } catch (err) {
      setBooking({
        loading: false,
        type: 'error',
        message: err.response?.data?.message || 'Could not send the booking request.'
      });
    }
  };

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="bg-brand-bg min-h-screen pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse space-y-4">
          <div className="h-40 rounded-xl bg-brand-surface border border-brand-border" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-56 rounded-xl bg-brand-surface border border-brand-border" />
            <div className="h-56 rounded-xl bg-brand-surface border border-brand-border" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-brand-bg min-h-screen pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-brand-surface rounded-xl border border-brand-border p-10">
            <AlertCircle size={24} className="mx-auto text-brand-danger mb-3" />
            <h1 className="font-serif text-xl font-bold text-brand-navy">{error}</h1>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={load}
                className="px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
              >
                Try Again
              </button>
              <Link
                to="/freelancers"
                className="px-4 py-2.5 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
              >
                Back to Professionals
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const upcoming = profile.upcoming_availability || [];
  const openDays = profile.available_dates || [];
  const isCompany = user?.role === 'company';

  return (
    <div className="bg-brand-bg min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-textSec hover:text-brand-primary transition-colors"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </button>

        {/* Header - clean white card, no banner. The avatar keeps its thin
            border and sits inline with the name, so nothing overlaps. */}
        <header className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <Avatar
              user={profile}
              size="xl"
              className="!h-[4.5rem] !w-[4.5rem] !text-xl shadow-sm"
              fallback="P"
            />

            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-brand-navy leading-tight break-words">
                {profile.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {profile.profession && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-primary">
                    <Briefcase size={13} className="shrink-0" aria-hidden="true" /> {profile.profession}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-brand-textSec">
                    <MapPin size={13} className="shrink-0" aria-hidden="true" /> {location}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 sm:self-center">
              <AvailabilityBadge availability={profile.current_availability} size="md" showLocation />
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {profile.bio ? (
              <Section title="About">
                <p className="text-[14px] leading-relaxed text-brand-navy whitespace-pre-line">{profile.bio}</p>
              </Section>
            ) : null}

            {(profile.experience_years != null || profile.profession) && (
              <Section title="Experience & Specialisation">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.experience_years != null && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Experience</dt>
                      <dd className="mt-1 text-[15px] font-semibold text-brand-navy tabular-nums">
                        {profile.experience_years} {profile.experience_years === 1 ? 'year' : 'years'}
                      </dd>
                    </div>
                  )}
                  {profile.profession && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Specialisation</dt>
                      <dd className="mt-1 text-[15px] font-semibold text-brand-navy">{profile.profession}</dd>
                    </div>
                  )}
                </dl>
              </Section>
            )}

            {profile.equipment?.length > 0 && (
              <Section title="Equipment">
                <ul className="flex flex-wrap gap-2">
                  {profile.equipment.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1 text-[12px] font-medium text-brand-navy"
                    >
                      <Camera size={12} className="text-brand-primary" aria-hidden="true" /> {item}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Availability">
              {upcoming.length === 0 && openDays.length === 0 ? (
                <p className="text-[13px] text-brand-textSec">
                  This professional has not published any availability yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {upcoming.length > 0 && (
                    <ul className="space-y-2">
                      {upcoming.map((block, i) => (
                        <li
                          key={`${block.start_date}-${i}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5"
                        >
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy">
                            <MapPin size={13} className="text-brand-primary shrink-0" aria-hidden="true" />
                            {[block.city, block.state].filter(Boolean).join(', ') || 'Location not set'}
                          </span>
                          <span className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-brand-textSec">
                              <CalendarRange size={12} aria-hidden="true" />
                              {fmtRange(block.start_date, block.end_date)}
                            </span>
                            <AvailabilityBadge availability={{ status: block.status }} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {openDays.length > 0 && (
                    <p className="flex items-center gap-1.5 text-[13px] text-brand-textSec">
                      <CalendarCheck size={14} className="text-green-600 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-brand-navy tabular-nums">{openDays.length}</span>
                      open {openDays.length === 1 ? 'day' : 'days'} published on their calendar
                    </p>
                  )}
                </div>
              )}
            </Section>
          </div>

          {/* Aside */}
          <aside className="space-y-4">
            <div className="bg-brand-surface rounded-xl border border-brand-border p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">
                Work with {profile.name?.split(' ')[0] || 'this professional'}
              </h2>

              {isCompany ? (
                <>
                  <button
                    onClick={requestBooking}
                    disabled={booking.loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors disabled:opacity-50"
                  >
                    {booking.loading && <Loader2 size={14} className="animate-spin" />}
                    {booking.loading ? 'Sending...' : 'Request Booking'}
                  </button>
                  <p className="mt-2.5 text-[11px] text-brand-textSec">
                    Messaging opens once the request is accepted and both accounts hold an active plan.
                  </p>
                </>
              ) : user ? (
                <p className="text-[13px] text-brand-textSec">
                  Only company accounts can send booking requests.
                </p>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
                  >
                    Sign in to book
                  </Link>
                  <p className="mt-2.5 text-[11px] text-brand-textSec">
                    Sign in with a company account to send a booking request.
                  </p>
                </>
              )}

              {booking.message && (
                <p
                  className={`mt-3 rounded-lg border p-2.5 text-[12px] ${
                    booking.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-brand-danger'
                  }`}
                  role="status"
                >
                  {booking.message}
                </p>
              )}
            </div>

            <div className="bg-brand-surface rounded-xl border border-brand-border p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">Details</h2>
              <dl className="space-y-2.5 text-[13px]">
                {location && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-textSec">Based in</dt>
                    <dd className="font-medium text-brand-navy text-right">{location}</dd>
                  </div>
                )}
                {profile.member_since && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-textSec">Member since</dt>
                    <dd className="font-medium text-brand-navy">{fmt(profile.member_since, { month: 'short', year: 'numeric' })}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3.5 pt-3.5 border-t border-brand-border text-[11px] text-brand-textSec">
                Contact details are kept private. Connect through the platform.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
