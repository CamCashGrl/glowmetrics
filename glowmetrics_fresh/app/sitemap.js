export default function sitemap() {
  const baseUrl = 'https://www.camcashgrl.com'
  const now = new Date().toISOString()

  return [
    // Priority 1.0 — main hub pages
    { url: `${baseUrl}`,            lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/blog`,       lastModified: now, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/guides`,     lastModified: now, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/tools`,      lastModified: now, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/demo`,       lastModified: now, changeFrequency: 'monthly', priority: 0.95 },
    { url: `${baseUrl}/extension`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/pricing`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // Priority 0.95 — free interactive tools
    { url: `${baseUrl}/guides/cam-model-room-title-generator`, lastModified: now, changeFrequency: 'monthly', priority: 0.95 },
    { url: `${baseUrl}/guides/cam-model-token-calculator`,     lastModified: now, changeFrequency: 'monthly', priority: 0.95 },

    // Priority 0.90 — guides
    { url: `${baseUrl}/guides/chaturbate-earnings-tracker`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/cam-model-analytics`,            lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/how-to-increase-cam-tips`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/bongacams-analytics`,            lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/best-time-to-stream-chaturbate`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/cam-model-top-tippers`,          lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/cam-model-income-tracker`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/myfreecams-analytics`,           lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/chaturbate-token-tracker`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/cam-model-revenue-dashboard`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/cam-model-session-breakdown`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/guides/chaturbate-best-hours`,          lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // Priority 0.85 — blog posts
    { url: `${baseUrl}/blog/best-cam-model-tools`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/cam-model-earnings`,                      lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/cam-model-taxes`,                         lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-much-do-chaturbate-models-make`,      lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-build-loyal-fans`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-get-more-tips-on-myfreecams`,      lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-get-veiws-on-chaturbate`,          lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-increase-cam-earnings`,            lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-make-more-money-on-chaturbate`,    lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/how-to-re-engage-whales-and-top-tippers`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/why-cam-income-is-inconsistent`,          lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/blog/why-cam-streams-arent-making-money`,      lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
  ]
}
