import { useState } from 'react';

/**
 * Shared user avatar.
 *
 * Renders the user's existing profile image when one is present on the record
 * and falls back to clean initials otherwise. It reads whichever image field
 * the API already returns (`profile_picture` is the one the backend populates)
 * - no new database field, upload system or API change is involved.
 */

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl'
};

/** Picks the first image URL the user object actually carries. */
const getAvatarUrl = (user) => {
  if (!user || typeof user !== 'object') return null;
  return user.profile_picture || user.profile_image || user.avatar || user.logo || null;
};

/** Builds up to two initials from any available name field. */
const getInitials = (user, fallback = 'U') => {
  const source =
    (user && (user.name || user.company_name || user.full_name || user.email)) || '';
  const cleaned = String(source).trim();
  if (!cleaned) return fallback;

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
};

export default function Avatar({
  user,
  size = 'md',
  className = '',
  rounded = 'rounded-full',
  fallback = 'U'
}) {
  const [failed, setFailed] = useState(false);
  const url = getAvatarUrl(user);
  const sizeClass = SIZES[size] || SIZES.md;
  const base = `${sizeClass} ${rounded} shrink-0 overflow-hidden ${className}`;

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={(user && (user.name || user.company_name)) || 'User'}
        onError={() => setFailed(true)}
        className={`${base} object-cover border border-brand-border bg-brand-bg`}
      />
    );
  }

  return (
    <span
      className={`${base} bg-brand-primary/10 text-brand-primary border border-brand-primary/25 flex items-center justify-center font-semibold select-none`}
      aria-hidden="true"
    >
      {getInitials(user, fallback)}
    </span>
  );
}
