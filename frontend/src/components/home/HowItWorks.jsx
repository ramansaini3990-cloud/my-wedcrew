import { useState } from 'react';
import SectionHeading from '../ui/SectionHeading';
import { HOW_IT_WORKS } from '../../config/homeContent';

const TABS = [
  { id: 'company', label: 'For Production Houses' },
  { id: 'freelancer', label: 'For Freelancers' }
];

/** Four-step process with a connecting rule across large screens. */
export default function HowItWorks() {
  const [audience, setAudience] = useState('company');
  const steps = HOW_IT_WORKS[audience] || [];

  return (
    <section className="bg-brand-surface py-16 sm:py-20 border-y border-brand-border" aria-labelledby="how-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Process"
          title="How mywedcrew.com"
          accent="Works"
          description="From brief to booked crew in four steps."
        />

        <div className="mt-8 flex justify-center" role="tablist" aria-label="Choose audience">
          <div className="inline-flex p-1 rounded-lg bg-brand-bg border border-brand-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={audience === tab.id}
                onClick={() => setAudience(tab.id)}
                className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                  audience === tab.id
                    ? 'bg-brand-primary text-white'
                    : 'text-brand-navy hover:text-brand-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-12">
          <span
            className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-brand-primary/30 to-transparent"
            aria-hidden="true"
          />
          <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <li key={step.step} className="text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface border-2 border-brand-primary/30 font-serif text-base font-bold text-brand-primary">
                  {step.step}
                </span>
                <h3 className="font-serif text-[15px] font-bold text-brand-navy">{step.title}</h3>
                <p className="mt-1.5 text-[13px] text-brand-textSec leading-relaxed max-w-[15rem] mx-auto">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
