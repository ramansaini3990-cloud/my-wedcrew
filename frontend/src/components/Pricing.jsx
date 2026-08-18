import { Check } from 'lucide-react';

export default function Pricing() {
  const plans = [
    {
      name: 'Freelancer',
      price: 'Free',
      description: 'Perfect for individual professionals starting out.',
      features: ['Basic profile listing', 'Apply to 5 jobs/month', 'Standard search visibility', 'Community access'],
      buttonText: 'Join as Freelancer',
      popular: false,
    },
    {
      name: 'Pro Freelancer',
      price: '₹999',
      period: '/month',
      description: 'Maximize your bookings and visibility.',
      features: ['Premium profile badge', 'Unlimited job applications', 'Top of search results', 'Direct messaging with companies'],
      buttonText: 'Upgrade to Pro',
      popular: true,
    },
    {
      name: 'Company / Studio',
      price: '₹2,499',
      period: '/month',
      description: 'For studios looking to hire top talent frequently.',
      features: ['Post unlimited jobs', 'Access to premium freelancers', 'Advanced filtering & analytics', 'Priority support'],
      buttonText: 'Create Studio Account',
      popular: false,
    },
  ];

  return (
    <div className="bg-brand-bg py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:text-center">
          <h2 className="text-3xl font-extrabold text-brand-dark sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-xl text-brand-textSec">Choose the plan that best fits your professional needs.</p>
        </div>

        <div className="mt-16 space-y-12 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative p-8 bg-white border ${plan.popular ? 'border-2 border-brand-primary shadow-lg' : 'border-brand-border shadow-sm'} rounded-3xl flex flex-col`}>
              {plan.popular && (
                <div className="absolute top-0 right-6 transform -translate-y-1/2">
                  <span className="bg-brand-primary text-white px-3 py-1 text-sm font-semibold rounded-full tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-brand-navy">{plan.name}</h3>
                <p className="mt-2 text-brand-textSec">{plan.description}</p>
                <div className="mt-4 flex items-baseline text-5xl font-extrabold text-brand-dark">
                  {plan.price}
                  {plan.period && <span className="ml-1 text-xl font-medium text-brand-textSec">{plan.period}</span>}
                </div>
              </div>
              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <div className="flex-shrink-0">
                      <Check className="h-6 w-6 text-brand-success" />
                    </div>
                    <p className="ml-3 text-base text-brand-textSec">{feature}</p>
                  </li>
                ))}
              </ul>
              <button className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${plan.popular ? 'bg-brand-primary text-white hover:bg-brand-primaryDark' : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20'}`}>
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
