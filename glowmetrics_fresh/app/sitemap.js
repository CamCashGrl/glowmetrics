// app/sitemap.js — Next.js auto-generates /sitemap.xml from this file
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

  return [
    { url: base,              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/landing`, lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    ...guides.map(slug => ({
      url: `${base}/guides/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
  ]
}
