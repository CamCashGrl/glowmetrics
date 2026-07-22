export default function sitemap() {
  const base = 'https://www.camcashgrl.com'
  const today = '2026-07-08'

  const staticPages = [
    { url: base,                                          priority: 1.0, changeFrequency: 'weekly'  },
    { url: `${base}/pricing`,                             priority: 0.9, changeFrequency: 'monthly' },
    { url: `${base}/blog`,                                priority: 0.9, changeFrequency: 'weekly'  },
    { url: `${base}/landing`,                             priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/extension`,                           priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/affiliates`,                          priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/analytics`,                           priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools`,                               priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools/cam-model-name-generator`,      priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools/profile-studio`,                priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/contact`,                             priority: 0.6, changeFrequency: 'monthly' },
    { url: `${base}/privacy`,                             priority: 0.5, changeFrequency: 'yearly'  },
    { url: `${base}/terms`,                               priority: 0.5, changeFrequency: 'yearly'  },
  ].map(p => ({ ...p, lastModified: today }))

  const blogSlugs = [
    'benefits-of-cam-model-bookkeeping',
    'best-cam-model-tools',
    'best-cam-sites-for-beginners',
    'best-cam-sites-for-models',
    'cam-model-boundaries-toxic-chat',
    'cam-model-earnings',
    'cam-model-equipment-guide',
    'cam-model-fan-crm',
    'cam-model-income-diversification',
    'cam-model-jobs-from-home',
    'cam-model-mental-health-burnout-prevention',
    'cam-model-self-employment-tax-prep',
    'cam-model-taxes',
    'cam-model-tipping-pattern-data-examples',
    'cam-model-token-to-dollar-ratio-explained',
    'camcash-vs-camdash-vs-cb-cam-insights',
    'chaturbate-best-month-real-numbers',
    'chaturbate-first-30-days-real-earnings',
    'chaturbate-payout-explained',
    'freemium-vs-premium-cam-model',
    'girlfriend-experience-gfe-cam-modeling-strategy',
    'how-cam-models-stay-anonymous',
    'how-much-do-bongacams-models-make',
    'how-much-do-cam-models-make',
    'how-much-do-chaturbate-models-make',
    'how-much-do-myfreecams-models-make',
    'how-to-build-loyal-fans',
    'how-to-find-your-cam-model-niche',
    'how-to-get-more-tips-on-myfreecams',
    'how-to-get-more-viewers-as-a-cam-model',
    'how-to-get-views-on-chaturbate',
    'how-to-increase-cam-earnings',
    'how-to-increase-chaturbate-tips',
    'how-to-make-money-on-chaturbate',
    'how-to-make-more-money-on-chaturbate',
    'how-to-pick-a-cam-name',
    'how-to-re-engage-whales-and-high-tipping-fans',
    'how-to-stay-safe-as-a-cam-model',
    'how-to-track-cam-tips-automatically',
    'is-camming-legal',
    'live-ai-coaching-cam-models',
    'revenue-per-hour-cam-model',
    'viral-cam-room-titles',
    'why-cam-income-is-inconsistent',
    'why-cam-model-data-prevents-overspending',
    'why-cam-streams-arent-making-money',
    'why-youre-not-making-money-on-chaturbate',
  ]

  const guideSlugs = [
    'best-time-to-stream-chaturbate',
    'bongacams-analytics',
    'cam-model-analytics',
    'cam-model-income-tracker',
    'cam-model-revenue-dashboard',
    'cam-model-room-title-generator',
    'cam-model-session-breakdown',
    'cam-model-token-calculator',
    'cam-model-top-tippers',
    'chaturbate-best-hours',
    'chaturbate-earnings-tracker',
    'chaturbate-token-tracker',
    'how-to-increase-cam-tips',
    'myfreecams-analytics',
  ]

  const blogPages = blogSlugs.map(slug => ({
    url: `${base}/blog/${slug}`,
    lastModified: today,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const guidePages = guideSlugs.map(slug => ({
    url: `${base}/guides/${slug}`,
    lastModified: today,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticPages, ...blogPages, ...guidePages]
}
