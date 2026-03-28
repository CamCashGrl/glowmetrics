// app/robots.js — Next.js auto-generates /robots.txt from this file
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/api/'],
      },
    ],
    sitemap: 'https://www.camcashgrl.com/sitemap.xml',
    host: 'https://www.camcashgrl.com',
  }
}
