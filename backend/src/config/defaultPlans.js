/**
 * Default plan catalogue.
 *
 * Prices and limits stay editable from Admin -> Subscriptions -> Manage Plans;
 * these values are only the starting point used by the seeder.
 *
 * `features` entries are the keys checked by subscriptionService.hasFeature().
 * `limits` entries are the numeric caps read by subscriptionService.getLimit().
 */
export const DEFAULT_PLANS = [
  {
    name: 'FREE',
    description: 'Basic listing access. Chat is not included.',
    price: 0,
    currency: 'INR',
    billing_period: 'monthly',
    features: ['profile_visibility'],
    limits: { applications: 5 },
    isActive: true,
    sort_order: 1
  },
  {
    name: 'PRO',
    description: 'Chat enabled with a higher application limit.',
    price: 999,
    currency: 'INR',
    billing_period: 'monthly',
    features: ['chat', 'profile_visibility'],
    limits: { applications: 50 },
    isActive: true,
    sort_order: 2
  },
  {
    name: 'PREMIUM',
    description: 'Chat enabled, featured listing and unlimited applications.',
    price: 4999,
    currency: 'INR',
    billing_period: 'monthly',
    features: ['chat', 'profile_visibility', 'featured_listing', 'priority_support'],
    limits: { applications: 9999 },
    isActive: true,
    sort_order: 3
  }
];

export default DEFAULT_PLANS;
