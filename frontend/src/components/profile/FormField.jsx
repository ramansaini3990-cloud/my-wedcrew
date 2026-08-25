/** Labelled form field wrapper used across the profile forms. */
export default function FormField({ label, hint, children, required }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec mb-1.5">
        {label} {required && <span className="text-brand-primary">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-brand-textSec">{hint}</p>}
    </div>
  );
}
