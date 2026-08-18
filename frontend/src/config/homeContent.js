/**
 * Single configuration point for all editorial homepage content.
 *
 * Nothing here is fetched from the backend, so this is the ONLY place to edit
 * hero copy, media URLs, statistics and testimonials. Live values (professional
 * counts, requirements, availability) come from the real API via useHomeData().
 *
 * MEDIA
 * -----
 * The project ships no video files (`public/videos/` does not exist), so every
 * slide has `video: null` and renders its poster image instead. Drop files into
 * `public/videos/` and set the `video` path here to enable motion - no
 * component changes required.
 */

/** Hero slides. `video` may be null; the poster is always shown as a fallback. */
export const HERO_SLIDES = [
  {
    id: 'network',
    eyebrow: "India's Premium Wedding Production Network",
    heading: 'Bring Your Wedding',
    headingAccent: 'Vision to Life.',
    description:
      'Connect with verified cinematographers, photographers, drone pilots and elite event crew.',
    video: null, // e.g. '/videos/hero-network.mp4'
    poster:
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop',
    primaryCta: { label: 'Find Professionals', to: '/freelancers' },
    secondaryCta: { label: 'Join as Freelancer', to: '/register' }
  },
  {
    id: 'angles',
    eyebrow: 'Capture Every Angle',
    heading: 'From Ground',
    headingAccent: 'to Sky.',
    description:
      'Book experienced cinematographers, photographers and certified drone pilots.',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=2070&auto=format&fit=crop',
    primaryCta: { label: 'Find Professionals', to: '/freelancers' },
    secondaryCta: { label: 'Browse Requirements', to: '/requirements' }
  },
  {
    id: 'studios',
    eyebrow: 'Built for Production Houses',
    heading: 'Your Crew. Your Standards.',
    headingAccent: 'One Network.',
    description:
      'Source, shortlist and book an entire production crew from a single platform.',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
    primaryCta: { label: 'Post a Requirement', to: '/register' },
    secondaryCta: { label: 'Explore Membership', to: '/#pricing' }
  }
];

/**
 * Trust strip.
 *
 * `value: null` means "derive from live API data" (see TrustStats). Only set a
 * literal value here when you can verify it - never publish a number you cannot
 * back up. Entries whose value cannot be resolved are hidden rather than shown
 * with a placeholder.
 */
export const TRUST_STATS = [
  { id: 'professionals', label: 'Verified Professionals', value: null, source: 'professionals', suffix: '+' },
  { id: 'cities', label: 'Cities Covered', value: null, source: 'cities', suffix: '+' },
  { id: 'requirements', label: 'Open Requirements', value: null, source: 'requirements', suffix: '' },
  { id: 'categories', label: 'Crew Categories', value: null, source: 'categories', suffix: '' }
];

/** Category tiles. `count` is resolved live from the professionals API. */
export const CATEGORIES = [
  {
    id: 'cinematographer',
    name: 'Cinematographer',
    description: 'Cinematic storytelling and multi-camera wedding films.',
    match: ['cinemat', 'film'],
    image:
      'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1600&auto=format&fit=crop'
  },
  {
    id: 'photographer',
    name: 'Traditional Photographer',
    description: 'Candid and traditional coverage for every ceremony.',
    match: ['photo'],
    image:
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop'
  },
  {
    id: 'drone',
    name: 'Drone Pilot',
    description: 'Certified aerial operators for sweeping venue films.',
    match: ['drone', 'aerial'],
    image:
      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=1600&auto=format&fit=crop'
  },
  {
    id: 'editor',
    name: 'Video Editor',
    description: 'Post-production, colour and highlight film delivery.',
    match: ['edit', 'colour', 'color'],
    image:
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1600&auto=format&fit=crop'
  }
];

/**
 * Showcase reel. Same rule as the hero: `video: null` renders the poster with a
 * disabled play affordance, so no fabricated external media is embedded.
 */
export const SHOWCASE_VIDEOS = [
  {
    id: 'weddings',
    title: 'Weddings',
    caption: 'Full-day ceremony coverage',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1600&auto=format&fit=crop',
    featured: true
  },
  {
    id: 'pre-weddings',
    title: 'Pre-Weddings',
    caption: 'Location-led couple films',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1537633552985-df8429e8048b?q=80&w=1200&auto=format&fit=crop'
  },
  {
    id: 'destination',
    title: 'Destination Weddings',
    caption: 'Palace and coastal productions',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=1200&auto=format&fit=crop'
  },
  {
    id: 'drone-films',
    title: 'Drone Films',
    caption: 'Certified aerial cinematography',
    video: null,
    poster:
      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=1200&auto=format&fit=crop'
  }
];

/** "Why WedCrew" feature points. */
export const WHY_POINTS = [
  { id: 'kyc', title: 'KYC Verified Profiles', description: 'Background and equipment checks before a profile goes live.' },
  { id: 'availability', title: 'Real-time Availability', description: 'Synced calendars so you never double-book a crew member.' },
  { id: 'network', title: 'Pan-India Network', description: 'Source local talent for destination weddings without travel costs.' },
  { id: 'equipment', title: 'Professional Equipment', description: 'Cameras, gimbals, drones and lighting declared up front.' },
  { id: 'reliable', title: 'Reliable Crew', description: 'Ratings and booking history you can review before hiring.' },
  { id: 'standards', title: 'Premium Production Standards', description: 'A network built around high-end production requirements.' }
];

/** How it works, per audience. */
export const HOW_IT_WORKS = {
  company: [
    { step: '01', title: 'Post Your Requirement', description: 'Share the brief, dates, city and budget.' },
    { step: '02', title: 'Discover Professionals', description: 'Filter verified crew by craft, city and availability.' },
    { step: '03', title: 'Review & Shortlist', description: 'Compare proposals, rates and past work.' },
    { step: '04', title: 'Hire Your Crew', description: 'Confirm the booking and message the crew directly.' }
  ],
  freelancer: [
    { step: '01', title: 'Create Profile', description: 'Add your craft, city, equipment and rates.' },
    { step: '02', title: 'Set Availability', description: 'Mark the dates you can be booked.' },
    { step: '03', title: 'Receive Opportunities', description: 'Get booking requests and matching requirements.' },
    { step: '04', title: 'Get Hired', description: 'Accept the request and start the conversation.' }
  ]
};

/** Availability legend - mirrors the freelancer availability system. */
export const AVAILABILITY_LEGEND = [
  { id: 'available', label: 'Available', className: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'pending', label: 'Pending', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'booked', label: 'Booked', className: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30' },
  { id: 'busy', label: 'Busy', className: 'bg-red-100 text-red-700 border-red-200' }
];

/**
 * Homepage membership tiers.
 *
 * These mirror the copy that already existed on the homepage. Values are
 * intentionally unchanged - subscription plans that actually govern access live
 * in the database and are managed from Admin -> Subscriptions.
 */
export const MEMBERSHIP_PLANS = [
  {
    id: 'essential',
    name: 'Essential',
    price: '₹1,999',
    period: '/mo',
    features: [
      { label: 'Basic profile listing', included: true },
      { label: 'Standard support', included: true },
      { label: 'No featured listing', included: false }
    ],
    cta: 'Choose Plan',
    popular: false
  },
  {
    id: 'signature',
    name: 'Signature',
    price: '₹4,999',
    period: '/mo',
    features: [
      { label: 'Featured profile listing', included: true },
      { label: 'Priority booking requests', included: true },
      { label: 'Dedicated account manager', included: true }
    ],
    cta: 'Upgrade to Signature',
    popular: true
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '₹9,999',
    period: '/mo',
    features: [
      { label: 'Multiple crew accounts', included: true },
      { label: 'Unlimited requirements', included: true },
      { label: 'Premium API access', included: true }
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

/**
 * Testimonials.
 *
 * Intentionally EMPTY: the project has no testimonials data and inventing
 * customer quotes would be dishonest. The Testimonials component renders
 * nothing while this array is empty. Add verified entries here to enable it:
 *   { id, name, role, company, quote, rating, image }
 */
export const TESTIMONIALS = [];

/** Final call-to-action band. */
export const FINAL_CTA = {
  heading: 'Your Next Production Deserves the Right Crew.',
  description: 'Find trusted wedding professionals for your next project.',
  poster:
    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=2070&auto=format&fit=crop',
  video: null,
  primaryCta: { label: 'Find Professionals', to: '/freelancers' },
  secondaryCta: { label: 'Join as Freelancer', to: '/register' }
};

/** Search panel options. Cities are merged with live cities from the API. */
export const SEARCH_CATEGORIES = [
  'Cinematographer',
  'Traditional Photographer',
  'Wedding Photographer',
  'Drone Pilot',
  'Video Editor',
  'Colorist',
  'Assistant Photographer',
  'Production Crew'
];

export const SEARCH_CITIES = ['Jaipur', 'Mumbai', 'Delhi', 'Udaipur', 'Jaisalmer', 'Goa', 'Bengaluru'];
