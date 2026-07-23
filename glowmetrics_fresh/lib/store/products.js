// Source of truth for the CamCash Store catalog (Phase 1 — storefront only, no checkout).
// Keep product data separate from UI so a payment/delivery field can be added later
// without touching the storefront components.

export const CATEGORIES = ['All Products', 'Trackers', 'Scripts', 'Games', 'Branding', 'Guides']

export const PRODUCTS = [
  {
    id: 'playful-sph',
    slug: 'playful-sph-cam-script-pack',
    title: 'Playful SPH Cam Script Pack',
    category: 'Scripts',
    price: 9.99,
    currency: 'USD',
    shortDescription:
      'A full-session playful teasing guide with dialogue, response prompts and customization pages.',
    pages: '38 pages',
    format: 'Digital PDF',
    included: [
      'Consent and boundary check-ins',
      'Complete session flow',
      'Playful teasing dialogue',
      'Viewer-response prompts',
      'Tone variations and customization pages',
    ],
    cover: 'LISTING_COVER_Playful_SPH.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'vip-premium',
    slug: 'vip-client-tracker-premium-fillable',
    title: 'VIP Client Tracker — Premium Fillable Edition',
    category: 'Trackers',
    price: 12.99,
    currency: 'USD',
    shortDescription:
      'An expanded client-management system with printable and digitally fillable tracking tools.',
    pages: '30-page workbook + 15-page fillable companion',
    format: 'Two Digital PDFs',
    included: [
      'VIP master list',
      'Detailed client profiles',
      'Spending and session logs',
      'Follow-up and re-engagement trackers',
      'Monthly VIP review tools',
    ],
    cover: 'LISTING_COVER_VIP_Tracker_Premium.webp',
    adultOnly: false,
    featured: true,
  },
  {
    id: 'vip-workbook',
    slug: 'vip-client-tracker-workbook',
    title: 'VIP Client Tracker Workbook',
    category: 'Trackers',
    price: 9.99,
    currency: 'USD',
    shortDescription:
      'Track top clients, preferences, spending, sessions and follow-up opportunities in one workbook.',
    pages: '17 pages',
    format: 'Digital PDF',
    included: [
      'VIP master list',
      'Client profile pages',
      'Tip and spending history',
      'Interaction logs',
      'Follow-up and monthly review pages',
    ],
    cover: 'LISTING_COVER_VIP_Tracker_Workbook.webp',
    adultOnly: false,
    featured: false,
  },
  {
    id: 'branding-kit',
    slug: 'cam-model-branding-kit',
    title: 'Cam Model Branding Kit',
    category: 'Branding',
    price: 9.99,
    currency: 'USD',
    shortDescription:
      'Build a recognizable creator brand with guided persona, niche and visual-identity worksheets.',
    pages: '53 pages',
    format: 'Digital PDF',
    included: [
      'Brand persona planning',
      'Audience and niche worksheets',
      'Boundaries and positioning',
      'Visual identity guidance',
      'Social-media and content strategy',
    ],
    cover: 'LISTING_COVER_Cam_Model_Branding_Kit.webp',
    adultOnly: false,
    featured: true,
  },
  {
    id: 'good-morning-gfe',
    slug: 'good-morning-gfe-joi-script',
    title: 'Good Morning GFE JOI Script',
    category: 'Scripts',
    price: 7.99,
    currency: 'USD',
    shortDescription:
      'A customizable 12–20 minute adult creator script with pacing, alternate lines and aftercare.',
    pages: '12 pages',
    format: 'Digital PDF',
    included: [
      'Complete performance script',
      'Personalization worksheet',
      'Softer and dirtier alternate lines',
      'Performance and pacing cues',
      'Aftercare guidance',
    ],
    cover: 'LISTING_COVER_Good_Morning_GFE_JOI.webp',
    adultOnly: true,
    featured: false,
  },
  {
    id: 'roll-dice',
    slug: 'roll-the-dice-game-pack',
    title: 'Roll-the-Dice Game Pack',
    category: 'Games',
    price: 11.99,
    currency: 'USD',
    shortDescription:
      'Seven reusable cam-room dice games with fillable setup and planning worksheets.',
    pages: '10 pages',
    format: 'Fillable Digital PDF',
    included: [
      'Seven dice-game formats',
      'Fillable game pages',
      'Game setup guidance',
      'Pricing and boundary planning',
      'Printable worksheets',
    ],
    cover: 'LISTING_COVER_Roll_The_Dice.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'spin-wheel',
    slug: 'spin-the-wheel-template-pack',
    title: 'Spin-the-Wheel Template Pack',
    category: 'Games',
    price: 9.99,
    currency: 'USD',
    shortDescription: 'Eight editable wheel styles plus a PDF guide and Canva template access.',
    pages: '10-page guide + Canva access',
    format: 'Digital PDF and Canva Template',
    included: [
      'Eight wheel styles',
      'Everyday, Bratty and Soft Dom wheels',
      'Non-Nude, Toy and Premium wheels',
      'Goal and Blank/Custom wheels',
      'Editable Canva template access',
    ],
    cover: 'LISTING_COVER_Spin_The_Wheel.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'tip-menu',
    slug: 'cam-model-tip-menu-bundle',
    title: 'Cam Model Tip Menu Bundle',
    category: 'Guides',
    price: 10.99,
    currency: 'USD',
    shortDescription: 'Create a stronger menu faster with 320 realistic ideas and 20 Canva-ready pages.',
    pages: '30 pages',
    format: 'Digital PDF and Canva-Ready Pages',
    included: [
      '320 realistic menu ideas',
      '20 categorized menu pages',
      'Custom menu planner',
      'Pricing worksheet',
      'Performance tracker',
    ],
    cover: 'LISTING_COVER_Cam_Model_Tip_Menu_Bundle.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'mistress-contract',
    slug: 'mistress-contract-128-slave-rules',
    title: 'Mistress Contract & 128 Slave Rules',
    category: 'Guides',
    price: 11.99,
    currency: 'USD',
    shortDescription: 'A structured consensual roleplay workbook with rules, planning pages and trackers.',
    pages: '18 pages',
    format: 'Digital PDF',
    included: [
      'Training contract',
      'Limits and preferences worksheet',
      '128 rules',
      '30-day plan',
      'Task tracker and weekly review',
    ],
    cover: 'LISTING_COVER_Mistress_Contract.webp',
    adultOnly: true,
    featured: false,
  },
  {
    id: 'bondage-beginners',
    slug: 'bondage-for-beginners',
    title: 'Bondage for Beginners',
    category: 'Guides',
    price: 11.99,
    currency: 'USD',
    shortDescription: 'A consent-first beginner guide covering safety, foundational knots and scene planning.',
    pages: '23 pages',
    format: 'Digital PDF',
    included: [
      'Consent and safety foundations',
      'Safer and higher-risk body areas',
      'Four foundational knots',
      'Beginner restraint ideas',
      'Planning and reflection worksheets',
    ],
    cover: 'LISTING_COVER_Bondage_For_Beginners.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'sexting-tips',
    slug: '101-sexting-tips-long-distance',
    title: '101 Sexting Tips for Long-Distance Relationships',
    category: 'Guides',
    price: 4.99,
    currency: 'USD',
    shortDescription:
      'Flirty prompts, romantic ideas and privacy guidance for consenting long-distance couples.',
    pages: '61 pages',
    format: 'Digital PDF',
    included: [
      '101 tips and message ideas',
      'Flirty and romantic openers',
      'Voice-note and visual-teasing ideas',
      'Long-distance date-night prompts',
      'Consent, privacy and reconnection guidance',
    ],
    cover: 'LISTING_COVER_101_Sexting_Tips.webp',
    adultOnly: true,
    featured: false,
  },
  {
    id: 'sissy-punishments',
    slug: '101-ways-to-punish-your-sissy',
    title: '101 Ways to Punish Your Sissy',
    category: 'Guides',
    price: 10.99,
    currency: 'USD',
    shortDescription: 'Consensual feminine-discipline, obedience, service and accountability ideas for adults.',
    pages: '53 pages',
    format: 'Digital PDF',
    included: [
      '101 discipline ideas',
      'Feminine submission prompts',
      'Obedience and service assignments',
      'Financial-boundary guidance',
      'Consent, privacy and aftercare notes',
    ],
    cover: 'LISTING_COVER_101_Ways_To_Punish_Your_Sissy.webp',
    adultOnly: true,
    featured: false,
  },
  {
    id: 'paypig',
    slug: 'how-to-train-your-paypig',
    title: 'How to Train Your PayPig',
    category: 'Scripts',
    price: 10.99,
    currency: 'USD',
    shortDescription: 'A complete consensual findom training system with a contract, rules, plan and trackers.',
    pages: '18 pages',
    format: 'Digital PDF',
    included: [
      'PayPig training contract',
      'Limits and preferences worksheet',
      '128 rules',
      '30-day training plan',
      'Tribute and task tracker',
    ],
    cover: 'LISTING_COVER_How_To_Train_Your_PayPig.webp',
    adultOnly: true,
    featured: true,
  },
  {
    id: 'room-titles',
    slug: '500-high-converting-cam-room-titles',
    title: '500 High-Converting Cam Room Titles',
    category: 'Guides',
    price: 3.99,
    currency: 'USD',
    shortDescription: 'Five hundred copy-and-paste room-title ideas across ten creator-focused categories.',
    pages: '23 pages',
    format: 'Digital PDF',
    included: [
      '500 room-title ideas',
      'Ten categories',
      'Tip-goal and toy-show titles',
      'Private-show and VIP titles',
      'Slow-room rescue and game-night titles',
    ],
    cover: 'LISTING_COVER_500_High_Converting_Cam_Room_Titles.webp',
    adultOnly: false,
    featured: true,
  },
]

export function getAllProducts() {
  return PRODUCTS
}

export function getProductBySlug(slug) {
  return PRODUCTS.find((p) => p.slug === slug) || null
}

export function getAllSlugs() {
  return PRODUCTS.map((p) => p.slug)
}

export function getRelatedProducts(product, limit = 3) {
  return PRODUCTS.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, limit)
}

export function getCoverPath(product) {
  return `/store/covers/${product.cover}`
}

export function formatPrice(price, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
}
