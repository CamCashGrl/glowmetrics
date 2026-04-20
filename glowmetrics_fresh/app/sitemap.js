export default function sitemap() {
  const base = 'https://www.camcashgrl.com'
  const now = new Date()

  const blogs = [
    'best-cam-model-tools',
    'cam-model-earnings',
    'cam-model-taxes',
    'how-much-do-chaturbate-models-make',
    'how-to-build-loyal-fans',
    'how-to-get-more-tips-on-myfreecams',  
    'how-to-increase-cam-earnings',
    'how-to-make-more-money-on-chaturbate',
    'why-cam-income-is-inconsistent',
    'why-cam-streams-arent-making-money',
    
  ]

  const guides = [
    'chaturbate-earnings-tracker',
    'cam-model-analytics',
    'how-to-increase-cam-tips',
    'bongacams-analytics',
    'cam-model-top-tippers',
    'best-time-to-stream-chaturbate',
    'cam-model-income-tracker',
    'myfreecams-analytics',
    'chaturbate-token-tracker',
    'cam-model-revenue-dashboard',
    'cam-model-session-breakdown',
    'chaturbate-best-hours',
  ]

  return [
    // Core public pages
    // NOTE: /landing is excluded — use canonical / as the homepage
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },

    // Blog posts
    ...blogs.map(slug => ({
      url: `${base}/blog/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    })),

    // Keyword-targeted guide pages
    ...guides.map(slug => ({
      url: `${base}/guides/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    })),

    // Excluded (private/auth-only — never index these):
    // /dashboard, /onboarding, /login, /admin, /api/, /landing, /test, /testt, /reset-password
  ]
}
