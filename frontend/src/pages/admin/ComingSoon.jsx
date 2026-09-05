import { useLocation } from 'react-router-dom';
import UnderConstruction from '../../components/ui/UnderConstruction';

/**
 * Rendered by the /admin catch-all route for sidebar sections that have no
 * page yet: Availability, Verifications, Reports, Notifications, Settings.
 *
 * The route and every sidebar entry are unchanged — only what renders here.
 * It sits inside the admin shell, so the sidebar and header stay visible and
 * the active item still highlights.
 *
 * Each section gets its own specific description rather than one generic
 * message, so an admin can tell what the page will eventually do.
 */

/** Per-section copy, keyed by the last path segment. */
const SECTIONS = {
  availability: {
    title: 'Availability',
    description:
      'A platform-wide view of professional availability — who is bookable, who is travelling, and where, across any date range.'
  },
  verifications: {
    title: 'Verifications',
    description:
      'Review and approve professional identity and equipment verification, and control the verified badge on public profiles.'
  },
  reports: {
    title: 'Reports',
    description:
      'Exportable reporting on bookings, applications, subscriptions and platform revenue over a chosen period.'
  },
  notifications: {
    title: 'Notifications',
    description:
      'Compose and broadcast announcements to companies and professionals, and review what the platform has already sent.'
  },
  settings: {
    title: 'Settings',
    description:
      'Platform-level configuration. Subscription plans are managed under Subscriptions, and the platform fee under Payments.'
  }
};

const titleFromPath = (slug) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export default function ComingSoon() {
  const { pathname } = useLocation();
  const slug = pathname.split('/').filter(Boolean).pop() || '';

  // Falls back to a title derived from the URL for any section not listed
  // above, so a new sidebar entry never renders an empty heading.
  const section = SECTIONS[slug] || { title: titleFromPath(slug) || 'This section' };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">{section.title}</h1>
        <p className="text-[13px] text-brand-textSec mt-0.5">This section is not available yet.</p>
      </div>

      <UnderConstruction
        title={section.title}
        description={section.description}
        backTo={{ to: '/admin/dashboard', label: 'Back to dashboard' }}
      />
    </div>
  );
}
