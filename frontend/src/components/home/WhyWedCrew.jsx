import { CheckCircle2 } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { WHY_POINTS } from '../../config/homeContent';

/** Two-column value proposition with a cinematic still. */
export default function WhyWedCrew() {
  return (
    <section className="bg-brand-bg py-16 sm:py-20" aria-labelledby="why-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Why mywedcrew.com"
              title="The Gold Standard in"
              accent="Wedding Production"
              description="An exclusive ecosystem built for production houses managing high-value client events."
              className="md:mx-0"
            />

            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {WHY_POINTS.map((point) => (
                <li key={point.id} className="flex gap-3">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-brand-navy leading-snug">{point.title}</h3>
                    <p className="mt-1 text-[13px] text-brand-textSec leading-relaxed">{point.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rounded-2xl bg-brand-primary/10 blur-2xl" aria-hidden="true" />
            <img
              src="https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=1600&auto=format&fit=crop"
              alt="Wedding production crew filming a ceremony"
              loading="lazy"
              decoding="async"
              width="1200"
              height="900"
              className="relative w-full h-[22rem] lg:h-[30rem] object-cover rounded-2xl border border-brand-border shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
