// app/sitemap.js
export default function sitemap() {
  const base = 'https://www.camcashgrl.com'
  const now = new Date()

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

  const blogs = [
    // Existing
    'how-to-increase-cam-earnings',
    'why-cam-streams-arent-making-money',
    'best-cam-model-tools',
    // Cluster 1 — Cam Model Earnings
    'cam-model-earnings',
    'how-much-do-chaturbate-models-make',
    'how-to-make-more-money-on-chaturbate',
    'why-cam-income-is-inconsistent',
  ]

  return [
    { url: base,              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/landing`, lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    ...blogs.map(slug => ({
      url: `${base}/blog/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    })),
    ...guides.map(slug => ({
      url: `${base}/guides/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
  ]
}
