import NotificationsView from '../../components/NotificationsView';

/**
 * Admin notifications inbox.
 *
 * Replaces the ComingSoon placeholder that /admin/notifications fell through
 * to. That page promised broadcasting; this delivers the thing that actually
 * exists and was unreachable - admins receive real notifications (the finance
 * and earnings flows address them) and had nowhere to read them.
 *
 * READ ONLY. No composing, no broadcasting. The list, mark-as-read,
 * mark-all-read and the live socket update all come from the shared
 * NotificationsView, which the freelancer and company dashboards use - there is
 * one implementation of this list, not two.
 */
export default function AdminNotifications() {
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Notifications</h1>
        <p className="mt-0.5 text-[13px] text-brand-textSec">
          Alerts addressed to your administrator account.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
        <NotificationsView paginated showMarkAll pageSize={20} />
      </div>
    </div>
  );
}
