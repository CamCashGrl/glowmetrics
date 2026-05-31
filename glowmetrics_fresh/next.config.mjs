/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path((?!api/).*)',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/:path*',
        permanent: true,
      },
      {
        source: '/exstension',
        destination: '/extension',
        permanent: true,
      },
      {
        source: '/guides/chaturbate-room-title-generator',
        destination: '/guides/cam-model-room-title-generator',
        permanent: true,
      },
      {
        source: '/guides/chaturbate-token-calculator',
        destination: '/guides/cam-model-token-calculator',
        permanent: true,
      },
    ]
  },
}
export default nextConfig
