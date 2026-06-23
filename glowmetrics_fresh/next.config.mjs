/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Non-www variants that skip the chain by going directly to final destination
      {
        source: '/demo',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/landing/demo',
        permanent: true,
      },
      {
        source: '/exstension',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/extension',
        permanent: true,
      },
      // Catch-all www redirect (must come after the specific non-www rules above)
      {
        source: '/:path((?!api/).*)',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/:path*',
        permanent: true,
      },
      {
        source: '/demo',
        destination: 'https://www.camcashgrl.com/landing/demo',
        permanent: true,
      },
      { source: '/live-demo', destination: '/live/demo', permanent: false },
      { source: '/livedemo',  destination: '/live/demo', permanent: false },
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
      {
        source: '/guides/best-time-to-stream-on-chaturbate',
        destination: '/guides/chaturbate-best-hours',
        permanent: true,
      },
      {
        source: '/blog/why-youre-not-making-money-on-chaturbate',
        destination: '/blog/how-to-make-more-money-on-chaturbate',
        permanent: true,
      },
      {
        source: '/blog/how-to-get-veiws-on-chaturbate',
        destination: '/blog/how-to-get-views-on-chaturbate',
        permanent: true,
      },
    ]
  },
}
export default nextConfig
