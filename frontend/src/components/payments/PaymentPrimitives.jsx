import { formatPaiseShort, statusClass, statusLabel } from '../../utils/money';

/**
 * Small shared pieces for the payment screens.
 *
 * These deliberately reuse the existing WedCrew card, border, badge and colour
 * tokens rather than introducing a payment-specific look - the finance pages
 * should feel like the rest of the dashboard.
 */

/** Summary tile, matching the existing dashboard stat cards. */
export function StatCard({ label, valuePaise, value, hint, tone = 'default', icon: Icon }) {
  const toneClass = {
    default: 'text-brand-navy',
    positive: 'text-green-700',
    warning: 'text-yellow-700',
    muted: 'text-brand-textSec'
  }[tone] || 'text-brand-navy';

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Icon size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`mt-2 font-serif text-xl font-bold tabular-nums ${toneClass}`}>
        {value !== undefined ? value : formatPaiseShort(valuePaise)}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-brand-textSec">{hint}</p>}
    </div>
  );
}

/** Status pill. Colour comes from the shared status map. */
export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

/** Consistent empty state - never a blank panel or a broken table. */
export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-bg px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <p className="text-[13.5px] font-semibold text-brand-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12.5px] text-brand-textSec">{description}</p>}
    </div>
  );
}

/** Inline error/success message in the existing style. */
export function Feedback({ type, children }) {
  if (!children) return null;
  const cls = type === 'success'
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-red-200 bg-red-50 text-brand-danger';
  return <p className={`rounded-lg border p-2.5 text-[12.5px] ${cls}`} role="status">{children}</p>;
}

/** Horizontally scrollable table wrapper so wide tables never break mobile. */
export function TableShell({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left">
        <thead>
          <tr className="border-b border-brand-border">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-brand-textSec">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-navy placeholder-brand-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';
