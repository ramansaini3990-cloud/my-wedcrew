import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, MessageSquare, MessageSquareOff, CalendarClock } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 border-green-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  none: 'bg-brand-bg text-brand-textSec border-brand-border'
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

/**
 * Compact subscription summary for the Company / Freelancer dashboards.
 * Purely presentational - all values come from GET /api/subscriptions/me.
 */
export default function SubscriptionStatusCard({ subscription, loading }) {
  if (loading) {
    return (
      <div className="bg-brand-surface rounded-xl border border-brand-border shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-32 bg-brand-bg rounded"></div>
          <div className="h-6 w-40 bg-brand-bg rounded"></div>
          <div className="h-3 w-48 bg-brand-bg rounded"></div>
        </div>
      </div>
    );
  }

  const status = subscription?.status || 'none';
  const hasPlan = Boolean(subscription?.has_subscription);
  const chatEnabled = Boolean(subscription?.chat_enabled);
  const badgeClass = STATUS_STYLES[status] || STATUS_STYLES.none;

  return (
    <div className="bg-brand-surface rounded-xl border border-brand-border shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-textSec mb-2">
            Subscription
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-serif font-bold text-brand-navy leading-none">
              {hasPlan ? subscription.plan_name : 'No Plan'}
            </h3>
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
            >
              {hasPlan ? status : 'not subscribed'}
            </span>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-brand-textSec">
              <CalendarClock size={15} className="shrink-0 text-brand-textSec" />
              {hasPlan ? (
                <span>
                  Expires: <span className="font-medium text-brand-navy">{formatDate(subscription.end_date)}</span>
                  {subscription.is_active && subscription.days_remaining !== null && (
                    <span className="text-brand-textSec"> ({subscription.days_remaining} days left)</span>
                  )}
                </span>
              ) : (
                <span>No active subscription on this account.</span>
              )}
            </p>

            <p className="flex items-center gap-2">
              {chatEnabled ? (
                <>
                  <MessageSquare size={15} className="shrink-0 text-green-600" />
                  <span className="text-brand-textSec">
                    Chat: <span className="font-bold text-green-700">Enabled</span>
                  </span>
                </>
              ) : (
                <>
                  <MessageSquareOff size={15} className="shrink-0 text-brand-textSec" />
                  <span className="text-brand-textSec">
                    Chat: <span className="font-bold text-brand-navy">Locked</span>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center border ${
              subscription?.is_active
                ? 'bg-green-50 border-green-200 text-green-600'
                : 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
            }`}
          >
            {subscription?.is_active ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
          </div>
          {!subscription?.is_active && (
            <Link
              to="/#pricing"
              className="px-4 py-2 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-brand-primaryDark transition-colors whitespace-nowrap"
            >
              View Plans
            </Link>
          )}
        </div>
      </div>

      {!subscription?.is_active && (
        <p className="mt-4 pt-4 border-t border-brand-border text-xs text-brand-textSec">
          Messaging requires an active plan with chat on <span className="font-medium text-brand-navy">both</span> sides
          of a conversation. Contact the admin to activate your subscription.
        </p>
      )}
    </div>
  );
}
