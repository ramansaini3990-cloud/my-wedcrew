const STATUS_META = {
  available: { label: 'Available', dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  booked: { label: 'Booked', dot: 'bg-brand-primary', text: 'text-brand-primary', bg: 'bg-brand-primary/5 border-brand-primary/25' },
  busy: { label: 'Busy', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  traveling: { label: 'Traveling', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  unavailable: { label: 'Unavailable', dot: 'bg-brand-muted', text: 'text-brand-textSec', bg: 'bg-brand-bg border-brand-border' }
};

/**
 * Availability pill driven by REAL availability records.
 *
 * When a professional has published nothing for today the status is `unknown`
 * and this renders nothing - a base city is never presented as a statement of
 * availability.
 */
export default function AvailabilityBadge({ availability, size = 'sm', showLocation = false }) {
  const status = availability?.status;
  if (!status || status === 'unknown') return null;

  const meta = STATUS_META[status];
  if (!meta) return null;

  const pad = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border font-semibold ${meta.bg} ${meta.text} ${pad}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
      {showLocation && availability.city && (
        <span className="font-normal opacity-80">· {availability.city}</span>
      )}
    </span>
  );
}

export { STATUS_META };
