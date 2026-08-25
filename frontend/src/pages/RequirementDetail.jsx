import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin, CalendarDays, Clock, Users, ArrowLeft,
  AlertCircle, Loader2, Building2, Check, X, Lock
} from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import Badge from '../components/ui/Badge';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

const Perk = ({ label, value }) => {
  if (value === undefined || value === null) return null;
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {value ? (
        <Check size={14} className="text-green-600 shrink-0" aria-hidden="true" />
      ) : (
        <X size={14} className="text-brand-muted shrink-0" aria-hidden="true" />
      )}
      <span className={value ? 'text-brand-navy' : 'text-brand-muted'}>{label}</span>
    </li>
  );
};

/**
 * Requirement detail page.
 *
 * Uses the EXISTING GET /api/requirements/:id (optional auth). That endpoint
 * already populates only the company's public name and masks venue, budget and
 * description for viewers without an active subscription, so no private company
 * information reaches this page.
 *
 * Applying reuses the existing POST /api/applications flow - no second
 * application system.
 */
export default function RequirementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [requirement, setRequirement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [application, setApplication] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ proposed_rate: '', availability: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isFreelancer = user?.role === 'freelancer';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/requirements/${id}`);
      setRequirement(res.data?.data || res.data || null);
    } catch (err) {
      setError(err.response?.status === 404 ? 'This requirement could not be found.' : 'Unable to load this requirement.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Existing endpoint that reports whether this freelancer already applied.
  useEffect(() => {
    if (!isFreelancer) return;
    let cancelled = false;
    api
      .get(`/api/applications/my/requirement/${id}`)
      .then((res) => { if (!cancelled) setApplication(res.data?.data || null); })
      .catch(() => { /* not applied, or unavailable - treated as "no application" */ });
    return () => { cancelled = true; };
  }, [id, isFreelancer]);

  const apply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/api/applications', {
        requirement_id: id,
        proposed_rate: form.proposed_rate,
        availability: form.availability,
        message: form.message
      });
      setApplication(res.data?.data || { status: 'pending' });
      setShowApply(false);
      setFeedback({ type: 'success', message: 'Application sent. The company has been notified.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Could not send your application.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="bg-brand-bg min-h-screen pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse space-y-4">
          <div className="h-32 rounded-xl bg-brand-surface border border-brand-border" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-64 rounded-xl bg-brand-surface border border-brand-border" />
            <div className="h-64 rounded-xl bg-brand-surface border border-brand-border" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !requirement) {
    return (
      <div className="bg-brand-bg min-h-screen pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-brand-surface rounded-xl border border-brand-border p-10">
            <AlertCircle size={24} className="mx-auto text-brand-danger mb-3" />
            <h1 className="font-serif text-xl font-bold text-brand-navy">{error}</h1>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <button onClick={load} className="px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors">
                Try Again
              </button>
              <Link to="/requirements" className="px-4 py-2.5 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors">
                Back to Requirements
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const r = requirement;
  const hasAccess = r.hasAccess !== false;
  const location = [r.city, r.state].filter(Boolean).join(', ');
  const budgetHidden = r.payment_per_freelancer === 'Hidden';
  const inputClass =
    'w-full bg-brand-surface border border-brand-border rounded-lg px-3 h-10 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25';

  return (
    <div className="bg-brand-bg min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-textSec hover:text-brand-primary transition-colors"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </button>

        <header className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {r.status && (
                  <Badge variant={r.status === 'published' ? 'success' : 'neutral'}>
                    {r.status === 'published' ? 'Open' : r.status}
                  </Badge>
                )}
                {r.event_type && <Badge variant="accent">{r.event_type}</Badge>}
              </div>
              <h1 className="font-serif text-2xl font-bold text-brand-navy leading-tight">
                {r.category || 'Crew Requirement'}
              </h1>
              {r.company_name && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-brand-textSec">
                  <Building2 size={13} aria-hidden="true" /> {r.company_name}
                </p>
              )}
            </div>

            {!budgetHidden && r.payment_per_freelancer != null && (
              <div className="text-right">
                <p className="font-serif text-2xl font-bold text-brand-navy tabular-nums">
                  ₹{Number(r.payment_per_freelancer).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-brand-textSec">per professional / day</p>
              </div>
            )}
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-4">Assignment</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="mt-0.5 text-brand-primary shrink-0" aria-hidden="true" />
                    <div><dt className="text-[11px] uppercase tracking-wider text-brand-textSec">Location</dt>
                      <dd className="text-[14px] font-medium text-brand-navy">{location}</dd></div>
                  </div>
                )}
                {fmt(r.event_date) && (
                  <div className="flex items-start gap-2.5">
                    <CalendarDays size={15} className="mt-0.5 text-brand-primary shrink-0" aria-hidden="true" />
                    <div><dt className="text-[11px] uppercase tracking-wider text-brand-textSec">Event date</dt>
                      <dd className="text-[14px] font-medium text-brand-navy">
                        {fmt(r.event_date)}{r.end_date && fmt(r.end_date) !== fmt(r.event_date) ? ` – ${fmt(r.end_date)}` : ''}
                      </dd></div>
                  </div>
                )}
                {r.number_of_days != null && (
                  <div className="flex items-start gap-2.5">
                    <Clock size={15} className="mt-0.5 text-brand-primary shrink-0" aria-hidden="true" />
                    <div><dt className="text-[11px] uppercase tracking-wider text-brand-textSec">Duration</dt>
                      <dd className="text-[14px] font-medium text-brand-navy">
                        {r.number_of_days} {r.number_of_days === 1 ? 'day' : 'days'}
                        {r.working_hours ? ` · ${r.working_hours}` : ''}
                      </dd></div>
                  </div>
                )}
                {r.quantity != null && (
                  <div className="flex items-start gap-2.5">
                    <Users size={15} className="mt-0.5 text-brand-primary shrink-0" aria-hidden="true" />
                    <div><dt className="text-[11px] uppercase tracking-wider text-brand-textSec">Professionals needed</dt>
                      <dd className="text-[14px] font-medium text-brand-navy tabular-nums">{r.quantity}</dd></div>
                  </div>
                )}
                {r.venue && (
                  <div className="flex items-start gap-2.5 sm:col-span-2">
                    <MapPin size={15} className="mt-0.5 text-brand-primary shrink-0" aria-hidden="true" />
                    <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wider text-brand-textSec">Venue</dt>
                      <dd className={`text-[14px] ${hasAccess ? 'font-medium text-brand-navy' : 'text-brand-muted italic'}`}>{r.venue}</dd></div>
                  </div>
                )}
              </dl>
            </section>

            {r.description && (
              <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">Brief</h2>
                <p className={`text-[14px] leading-relaxed whitespace-pre-line ${hasAccess ? 'text-brand-navy' : 'text-brand-textSec italic'}`}>
                  {r.description}
                </p>
                {!hasAccess && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/5 border border-brand-primary/20 px-3 py-2 text-[12px] text-brand-navy">
                    <Lock size={12} className="text-brand-primary" aria-hidden="true" />
                    Subscribe to view the full brief, venue and budget.
                  </p>
                )}
              </section>
            )}

            {(r.food !== undefined || r.travel !== undefined || r.accommodation !== undefined) && (
              <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">Provided</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <Perk label="Food" value={r.food} />
                  <Perk label="Travel" value={r.travel} />
                  <Perk label="Accommodation" value={r.accommodation} />
                </ul>
              </section>
            )}
          </div>

          {/* Apply aside */}
          <aside className="space-y-4">
            <div className="bg-brand-surface rounded-xl border border-brand-border p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">Apply</h2>

              {feedback && (
                <p className={`mb-3 rounded-lg border p-2.5 text-[12px] ${
                  feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-brand-danger'
                }`} role="status">
                  {feedback.message}
                </p>
              )}

              {application ? (
                <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
                  <p className="text-[12px] text-brand-textSec">Your application</p>
                  <p className="mt-1 text-[14px] font-semibold text-brand-navy capitalize">{application.status || 'pending'}</p>
                </div>
              ) : !user ? (
                <Link to="/login" className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors">
                  Sign in to apply
                </Link>
              ) : !isFreelancer ? (
                <p className="text-[13px] text-brand-textSec">Only freelancer accounts can apply to requirements.</p>
              ) : showApply ? (
                <form onSubmit={apply} className="space-y-3">
                  <input type="text" value={form.proposed_rate} onChange={(e) => setForm({ ...form, proposed_rate: e.target.value })} placeholder="Your rate (e.g. ₹25,000)" className={inputClass} required />
                  <input type="text" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="Your availability" className={inputClass} required />
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows="3" placeholder="Why are you a good fit?" className={`${inputClass} h-auto py-2.5 resize-none`} required />
                  <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors disabled:opacity-50">
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? 'Sending...' : 'Send Application'}
                  </button>
                </form>
              ) : (
                <button onClick={() => setShowApply(true)} className="w-full px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors">
                  Apply Now
                </button>
              )}
            </div>

            <div className="bg-brand-surface rounded-xl border border-brand-border p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec mb-3">Posting</h2>
              <dl className="space-y-2.5 text-[13px]">
                {r.company_name && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-textSec">Company</dt><dd className="font-medium text-brand-navy text-right">{r.company_name}</dd>
                  </div>
                )}
                {typeof r.applications_count === 'number' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-textSec">Applications</dt><dd className="font-medium text-brand-navy tabular-nums">{r.applications_count}</dd>
                  </div>
                )}
                {fmt(r.created_at) && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-textSec">Posted</dt><dd className="font-medium text-brand-navy">{fmt(r.created_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
