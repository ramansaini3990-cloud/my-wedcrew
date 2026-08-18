import { TRUST_STATS, CATEGORIES } from '../../config/homeContent';

/**
 * Trust strip.
 *
 * Values are DERIVED from live API data - nothing is invented. A stat whose
 * source cannot be resolved is omitted entirely rather than shown with a
 * placeholder number. Edit TRUST_STATS in config/homeContent.js to add a
 * verified literal value.
 */
export default function TrustStats({ counts, loading }) {
  const resolve = (stat) => {
    if (stat.value !== null && stat.value !== undefined) return stat.value;
    if (stat.source === 'categories') return CATEGORIES.length;
    const derived = counts?.[stat.source];
    return typeof derived === 'number' ? derived : null;
  };

  const stats = TRUST_STATS.map((s) => ({ ...s, resolved: resolve(s) })).filter(
    (s) => s.resolved !== null
  );

  if (!loading && stats.length === 0) return null;

  return (
    <section className="bg-brand-surface border-y border-brand-border" aria-label="Platform statistics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-textSec mb-7">
          Trusted by production houses &amp; event professionals
        </p>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((stat) => (
            <div key={stat.id} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block font-serif text-2xl sm:text-3xl font-bold text-brand-navy tabular-nums">
                  {loading ? (
                    <span className="inline-block h-7 w-12 rounded bg-brand-bg animate-pulse" aria-hidden="true" />
                  ) : (
                    <>
                      {stat.resolved}
                      <span className="text-brand-primary">{stat.suffix}</span>
                    </>
                  )}
                </span>
                <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-wider text-brand-textSec">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
