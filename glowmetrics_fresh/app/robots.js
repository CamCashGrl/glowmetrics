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
        ],
      },
    ],
    sitemap: 'https://www.camcashgrl.com/sitemap.xml',
    host: 'https://www.camcashgrl.com',
  }
}