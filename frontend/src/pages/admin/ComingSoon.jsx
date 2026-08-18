import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

/**
 * Placeholder rendered by the /admin catch-all route for sidebar sections that
 * do not have a page built yet (Availability, Payments, Verifications, Reports,
 * Notifications, Activity Logs, Settings).
 *
 * It renders inside the admin shell, so the sidebar and header stay visible and
 * the active sidebar item still highlights correctly. Presentation only - it
 * replaces a bare "Page under construction..." string and adds no logic.
 */
const titleFromPath = (pathname) => {
  const slug = pathname.split('/').filter(Boolean).pop() || '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ComingSoon() {
  const { pathname } = useLocation();
  const title = titleFromPath(pathname);

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">{title || 'Section'}</h1>
        <p className="text-[13px] text-brand-textSec mt-0.5">
          This section is not available yet.
        </p>
      </div>

      <div className="glass-card rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <div className="h-11 w-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-3">
          <Construction size={20} />
        </div>
        <h2 className="text-sm font-semibold text-brand-navy">
          {title || 'This section'} is coming soon
        </h2>
        <p className="text-[13px] text-brand-textSec mt-1 max-w-sm">
          The page has not been built yet. Everything else in the dashboard
          continues to work as normal.
        </p>
      </div>
    </div>
  );
}
