import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Keeps the browser tab title in sync with the current route.
 *
 * Display-only: it reads the pathname and writes document.title. It renders
 * nothing, registers no routes and touches no application state, so route
 * behaviour is exactly as it was before.
 *
 * To retitle a page, edit the map below - no page component needs to change.
 */
export const BRAND = 'mywedcrew.com';

/** Exact pathnames first; `startsWith` prefixes are used for detail pages. */
const EXACT = {
  '/': null, // homepage keeps the full brand title
  '/login': 'Sign In',
  '/register': 'Join',
  '/requirements': 'Requirements',
  '/freelancers': 'Professionals',
  '/messages': 'Messages',
  '/freelancer/dashboard': 'Freelancer Dashboard',
  '/company/dashboard': 'Company Dashboard',
  '/company/requirements/new': 'New Requirement',
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/freelancers': 'Admin | Freelancers',
  '/admin/companies': 'Admin | Companies',
  '/admin/requirements': 'Admin | Requirements',
  '/admin/subscriptions': 'Admin | Subscriptions',
  '/admin/master-data': 'Admin | Master Data',
  '/admin/activity-logs': 'Admin | Activity Log'
};

const PREFIX = [
  ['/requirements/', 'Requirement'],
  ['/professionals/', 'Professional Profile'],
  ['/admin', 'Admin']
];

const titleFor = (pathname) => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (Object.prototype.hasOwnProperty.call(EXACT, path)) {
    const section = EXACT[path];
    return section ? `${BRAND} | ${section}` : `${BRAND} | Wedding Production Network`;
  }

  const match = PREFIX.find(([prefix]) => path.startsWith(prefix));
  return match ? `${BRAND} | ${match[1]}` : BRAND;
};

export default function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);

  return null;
}
