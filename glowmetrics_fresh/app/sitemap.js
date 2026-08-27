import { PRODUCTS } from '../lib/shop-products'

export default function sitemap() {
  const base = 'https://www.camcashgrl.com'
  const today = '2026-08-27'

  const staticPages = [
    { url: base,                                      priority: 1.0, changeFrequency: 'weekly' },
    { url: `${base}/pricing`,                         priority: 0.9, changeFrequency: 'monthly' },
    { url: `${base}/blog`,                            priority: 0.9, changeFrequency: 'weekly' },
    { url: `${base}/landing`,                         priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/extension`,                       priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/affiliates`,                      priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools`,                           priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/free-vip-tracker`,                priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/shop`,                            priority: 0.8, changeFrequency: 'weekly' },
    { url: `${base}/guides`,                          priority: 0.7, changeFrequency: 'weekly' },
    { url: `${base}/tools/cam-model-name-generator`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/tools/profile-studio`,            priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/contact`,                         priority: 0.6, changeFrequency: 'monthly' },
    { url: `${base}/feature-request`,                 priority: 0.5, changeFrequency: 'monthly' },
    { url: `${base}/privacy`,                         priority: 0.5, changeFrequency: 'yearly' },
    { url: `${base}/terms`,                           priority: 0.5, changeFrequency: 'yearly' },
  ].map(page => ({
    ...page,
    lastModified: today,
  }))

  const blogSlugs = [
    'benefits-of-cam-model-bookkeeping',
    'best-cam-model-tools',
    'best-cam-sites-for-beginners',
    'best-cam-sites-for-models',

    // BongaCams articles
    'bongacams-payout-guide',
    'bongacams-camscore-exsplained',
    'bonga-cams-queen-of-queens',

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

    // Creator-product articles
    'cam-room-dice-games',
    'what-to-do-when-cam-room-is-slow',
    'cam-session-scripts-for-models',
    'findom-message-scripts-for-creators',
    'findom-kink-niche',
    'spin-the-wheel-cam-game',

    'chaturbate-best-month-real-numbers',
    'chaturbate-first-30-days-real-earnings',
    'chaturbate-payout-explained',
    'free-myfreecams-earnings-tracker',
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

    'live-ai-coaching-cam-models',

    'revenue-per-hour-cam-model',
    'viral-cam-room-titles',
    'why-cam-income-is-inconsistent',
    'why-cam-model-data-prevents-overspending',
    'why-cam-streams-arent-making-money',
    'why-youre-not-making-money-on-chaturbate',
    // New narrow-intent posts, August 2026
    'how-long-does-chaturbate-new-tag-last',
    'how-to-establish-yourself-on-bongacams',
    'how-to-get-started-on-myfreecams-as-a-model',
    'how-to-set-up-chat-bots-on-bongacams',
    'how-to-set-up-chat-bots-on-chaturbate',
    'how-to-set-up-split-streaming-on-multiple-cam-sites',
    'how-to-structure-a-4-hour-cam-show',
    'off-site-shows-for-cam-models',
    'onlyfans-for-cam-models-after-streaming',
    'snap-shows-for-cam-models',
    // Active-model search-intent batch, August 2026 — broadcasting & setup
    'how-touse-myfreecams-with-obs',
    'how-to-find-myfreecams-stream-key',
    'what-is-mfc-share',
    'myfreecams-tokens-explained',
    'chaturbate-obs-stream-key-setup',
    'what-is-rtmp-for-cam-models',
    'what-cam-sites-allow-external-broadcasting',
    'how-to-multistream-with-obs',
    'obs-dropped-frames-cam-stream',
    'what-upload-speed-for-camming',
    '720p-vs-1080p-cam-streaming',

    // Active-model search-intent batch, August 2026 — multi-platform operations
    'cam-sites-compared-viewers-models-competition',
    'how-to-manage-multiple-cam-chats',
    'how-to-track-earnings-multiple-cam-sites',
    'how-to-decide-if-a-cam-site-is-worth-your-time',
    'how-to-test-a-new-cam-site',
    'how-to-compare-cam-platform-payouts',
    'cam-model-tools-for-multiple-platforms',
    'cam-model-resource-guide-forums-tools',

    // Active-model search-intent batch, August 2026 — data & show mechanics
    'why-more-tips-doesnt-mean-more-money',
    'how-to-find-best-camming-hours-from-your-data',
    'how-to-organize-cam-model-regulars',
    'how-to-make-a-cam-room-tip-menu',
    'cam-model-income-spreadsheet-what-to-track',
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

  const shopPages = PRODUCTS.map(product => ({
    url: `${base}/shop/${product.slug}`,
    lastModified: today,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticPages, ...blogPages, ...guidePages, ...shopPages]
}
