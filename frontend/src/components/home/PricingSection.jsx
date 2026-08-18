import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { MEMBERSHIP_PLANS } from '../../config/homeContent';

/**
 * Membership tiers.
 *
 * Plan names, prices and features are unchanged from the previous homepage -
 * only the presentation is new. Access-governing subscriptions live in the
 * database and are managed from Admin, so nothing here touches billing logic.
 */
export default function PricingSection() {
  return (
    <section id="pricing" className="bg-brand-bg py-16 sm:py-20 scroll-mt-24" aria-labelledby="pricing-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Membership"
          title="Elite"
          accent="Memberships"
          description="Choose a plan that fits your production scale."
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto items-start">
          {MEMBERSHIP_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 transition-all duration-300 hover:-translate-y-1 ${
                plan.popular
                  ? 'border-2 border-brand-primary shadow-xl md:-mt-3 md:mb-3'
                  : 'border border-brand-border shadow-sm hover:shadow-lg hover:border-brand-primary/40'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-primary text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <h3
                className={`font-serif text-lg font-bold ${
                  plan.popular ? 'text-brand-primary' : 'text-brand-navy'
                }`}
              >
                {plan.name}
              </h3>

              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-serif text-3xl font-bold text-brand-navy tabular-nums">
                  {plan.price}
                </span>
                <span className="text-[13px] text-brand-textSec">{plan.period}</span>
              </p>

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5 text-[13px]">
                    {feature.included ? (
                      <Check size={15} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
                    ) : (
                      <X size={15} className="mt-0.5 shrink-0 text-brand-muted" aria-hidden="true" />
                    )}
                    <span className={feature.included ? 'text-brand-navy' : 'text-brand-muted'}>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-7 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                  plan.popular
                    ? 'bg-brand-primary text-white hover:bg-brand-primaryDark'
                    : 'border border-brand-border text-brand-navy hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px] text-brand-textSec">
          Plans are activated by our team. Chat unlocks when both parties hold an active membership.
        </p>
      </div>
    </section>
  );
}
