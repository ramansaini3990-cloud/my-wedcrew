import { Lock } from 'lucide-react';

/**
 * Explains why professional identities are hidden, and how to change it.
 *
 * Honest by design. Plans are assigned by an administrator - there is no
 * self-serve checkout - so this does NOT link to a purchase flow that does not
 * exist. It says who to ask.
 *
 * It also states plainly that the details are withheld by the server. That is
 * the truth: publicProfileService drops name, photo, bio, equipment, social
 * links and gallery before serialising, so there is nothing in the response to
 * un-hide. Wording it as "hidden" would imply a client-side veil someone could
 * lift with DevTools.
 */
export default function SubscriptionLockNotice({ count = 0, className = '' }) {
  return (
    <div className={`rounded-xl border border-brand-primary/25 bg-brand-primary/5 p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <Lock size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-brand-navy">
            {count > 0
              ? `${count} matching professional${count === 1 ? '' : 's'} — details locked`
              : 'Professional details are locked'}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-brand-textSec">
            Without an active plan you can see the craft, area and availability of everyone who
            matches — enough to know the crew is there — but not their name, photo, bio, equipment,
            portfolio or contact details. Those are withheld by the server, not merely hidden on this
            page.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-brand-textSec">
            <span className="font-semibold text-brand-navy">A plan unlocks</span> full profiles,
            portfolios and messaging. Plans are currently assigned by our team rather than bought
            online — contact us at{' '}
            <a
              href="mailto:concierge@wedcrew.in?subject=Activating%20a%20plan%20for%20my%20studio"
              className="font-semibold text-brand-primary hover:underline"
            >
              concierge@wedcrew.in
            </a>{' '}
            and we will activate one for your studio.
          </p>
        </div>
      </div>
    </div>
  );
}
