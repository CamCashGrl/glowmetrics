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
      {
        source: '/signup',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/landing',
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
        // Legacy signup links (ads, emails, bookmarks) still point at /signup,
        // which was never a real route. /landing is the actual sign-up page
        // and already reads ?plan= to resume checkout after auth.
        source: '/signup',
        destination: '/landing',
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
        source: '/blog/how-to-get-veiws-on-chaturbate',
        destination: '/blog/how-to-get-views-on-chaturbate',
        permanent: true,
      },
      {
        // /guides/how-to-increase-cam-earnings was indexed by Google but never
        // had a corresponding page in this app — only the /blog/ version is real.
        source: '/guides/how-to-increase-cam-earnings',
        destination: '/blog/how-to-increase-cam-earnings',
        permanent: true,
      },
    ]
  },
}
export default nextConfig
