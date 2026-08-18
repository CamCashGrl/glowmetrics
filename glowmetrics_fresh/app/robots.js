export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/api/',
          '/login',
          '/onboarding',
          '/reset-password',
          '/forgot-password',
          '/preview-login',
          // Internal ops/funnel monitoring, not public content — see the
          // comment in sitemap.js next to the removed /analytics entry.
          '/analytics',
          // Requires auth.getUser() and renders this account's own live tip
          // stream — the same private, account-tied surface as /dashboard,
          // just at a standalone URL (for embedding without dashboard
          // chrome). Never in the sitemap; adding here so Google doesn't
          // discover and index it via any inbound link either.
          '/live',
        ],
      },
    ],
    sitemap: 'https://www.camcashgrl.com/sitemap.xml',
    host: 'https://www.camcashgrl.com',
  }
}