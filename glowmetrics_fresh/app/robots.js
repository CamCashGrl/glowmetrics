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
          '/landing',
          '/login',
          '/onboarding',
          '/reset-password',
          '/test',
          '/testt',
        ],
      },
    ],
    sitemap: 'https://www.camcashgrl.com/sitemap.xml',
    host: 'https://www.camcashgrl.com',
  }
}
