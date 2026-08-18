/**
 * Consistent section header: small orange eyebrow, serif display title and an
 * optional supporting line. Keeps typography hierarchy identical site-wide.
 */
export default function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  align = 'center',
  className = ''
}) {
  const alignment = align === 'left' ? 'text-left' : 'text-center mx-auto';

  return (
    <div className={`max-w-2xl ${alignment} ${className}`}>
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif text-2xl sm:text-3xl lg:text-[2.1rem] font-bold text-brand-navy leading-tight">
        {title} {accent && <span className="text-brand-primary">{accent}</span>}
      </h2>
      {description && (
        <p className="mt-3 text-[15px] leading-relaxed text-brand-textSec">{description}</p>
      )}
      <span
        className={`mt-5 block h-px w-16 bg-brand-primary/40 ${align === 'left' ? '' : 'mx-auto'}`}
        aria-hidden="true"
      />
    </div>
  );
}
