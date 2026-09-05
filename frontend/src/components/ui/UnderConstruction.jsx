import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

/**
 * Shared "this feature is being built" panel.
 *
 * Used by the admin catch-all route and by dashboard tabs whose backing
 * functionality does not exist yet, so an unbuilt area reads as deliberate
 * rather than broken.
 *
 * Copy is intentionally honest — it says the feature is not built and that
 * nothing here is functional, instead of an open-ended "coming soon".
 *
 * Styling uses only existing brand.* tokens (see tailwind.config.js); no new
 * colours are introduced. The icon is `Construction`, verified to exist in
 * lucide-react@1.31 — that version ships no brand icons, and importing one
 * breaks the build.
 *
 * @param {string}  title       What is being built. Required.
 * @param {string} [description] One or two sentences on what it will do.
 * @param {{to: string, label: string}} [backTo] Optional escape hatch.
 */
export default function UnderConstruction({ title, description, backTo }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
        <Construction size={22} aria-hidden="true" />
      </span>

      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">
        Under construction
      </p>

      <h2 className="mt-2 font-serif text-lg font-bold text-brand-navy">{title}</h2>

      {description && (
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-brand-textSec">{description}</p>
      )}

      <p className="mt-4 max-w-md text-[12px] leading-relaxed text-brand-muted">
        This section has not been built yet — nothing on this page is functional.
        Everything else in your dashboard works as normal.
      </p>

      {backTo?.to && (
        <Link
          to={backTo.to}
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {backTo.label || 'Go back'}
        </Link>
      )}
    </div>
  );
}
