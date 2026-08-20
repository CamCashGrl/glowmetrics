export default function sitemap() {
  const base = 'https://www.camcashgrl.com'
  const today = '2026-07-25'

  const staticPages = [
    { url: base,                                     priority: 1.0, changeFrequency: 'weekly' },
    { url: `${base}/pricing`,                        priority: 0.9, changeFrequency: 'monthly' },
    { url: `${base}/blog`,                           priority: 0.9, changeFrequency: 'weekly' },
    { url: `${base}/landing`,                        priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/extension`,                      priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/affiliates`,                     priority: 0.7, changeFrequency: 'monthly' },
    // /analytics removed — it's not public marketing content, it's an
    // internal onboarding-funnel/drop-off monitoring dashboard (see
    // app/analytics/page.js's FunnelPage). Listing it here was actively
    // telling Google to index an internal ops tool. Also added to
    // robots.js's disallow list. It currently has no authentication at
    // all — flagged separately as a real access-control gap, not silently
    // "fixed" with new auth code here.
    { url: `${base}/tools`,                          priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/free-vip-tracker`,                priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/tools/cam-model-name-generator`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools/profile-studio`,           priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/contact`,                        priority: 0.6, changeFrequency: 'monthly' },
    { url: `${base}/feature-request`,                 priority: 0.5, changeFrequency: 'monthly' },
    { url: `${base}/privacy`,                        priority: 0.5, changeFrequency: 'yearly' },
    { url: `${base}/terms`,                          priority: 0.5, changeFrequency: 'yearly' },
  ].map(page => ({
    ...page,
    lastModified: today,
  }))

  const blogSlugs = [
    'benefits-of-cam-model-bookkeeping',
    'best-cam-model-tools',
    'best-cam-sites-for-beginners',
    'best-cam-sites-for-models',

    // New BongaCams articles
    'bongacams-payout-guide',
    'bongacams-camscore-exsplained',

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

    // New creator-product articles
    'cam-room-dice-games',
    'what-to-do-when-cam-room-is-slow',
    'cam-session-scripts-for-models',
    'findom-message-scripts-for-creators',
    'findom-kink-niche',
    'spin-the-wheel-cam-game',

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
    'how-to-upload-csv-to-camcash',
    'is-camming-legal',

    // Existing and new coaching content
    'live-ai-coaching-cam-models',
    // 'live-mode-coaching-for-cam-models' removed — no static page exists
    // for this slug and blog_posts (Supabase) is empty, so the dynamic
    // [slug] fallback also has nothing for it. This sitemap entry was a
    // guaranteed 404 for Google. Re-add only once real content exists at
    // this URL.

    // New MyFreeCams articles
    // 'myfreecams-camscore-explained' and 'mfc-share-guide-for-models'
    // removed for the same reason — no static page, no matching row in the
    // (empty) blog_posts table. Guaranteed 404s, not indexable content.

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
    // 'chaturbate-room-title-generator' and 'chaturbate-token-calculator'
    // deliberately NOT included — next.config.mjs 301-redirects both to
    // their cam-model-* equivalents above (a Search Console-driven fix,
    // per that file's own comments). A sitemap should list only the final
    // canonical destination, never a URL that immediately redirects; their
    // page.js files exist but are unreachable (the redirect fires first).
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
