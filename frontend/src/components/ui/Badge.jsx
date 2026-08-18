const VARIANTS = {
  neutral: 'bg-brand-bg text-brand-textSec border-brand-border',
  accent: 'bg-brand-primary/10 text-brand-primary border-brand-primary/25',
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200'
};

/** Small pill used for statuses, verification and metadata. */
export default function Badge({ children, variant = 'neutral', icon: Icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${
        VARIANTS[variant] || VARIANTS.neutral
      } ${className}`}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
