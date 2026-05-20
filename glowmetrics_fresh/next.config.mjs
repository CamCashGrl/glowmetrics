/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Redirect non-www to www (handles both http and https non-www)
      {
        source: '/((?!api/).*)',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/:path*',
        permanent: true,
      },
      // Fix typo: /exstension → /extension
      {
        source: '/exstension',
        destination: '/extension',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
