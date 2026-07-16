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
      // Non-www variants of every other internal redirect below, so a non-www
      // hit resolves in a single hop instead of chaining through the catch-all
      // (apex -> www -> final). Google Search Console was flagging the 2-hop
      // chain on these specific URLs as a redirect error.
      {
        source: '/guides/chaturbate-room-title-generator',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/guides/cam-model-room-title-generator',
        permanent: true,
      },
      {
        source: '/guides/chaturbate-token-calculator',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/guides/cam-model-token-calculator',
        permanent: true,
      },
      {
        source: '/guides/best-time-to-stream-on-chaturbate',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/guides/chaturbate-best-hours',
        permanent: true,
      },
      {
        source: '/blog/how-to-get-veiws-on-chaturbate',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/blog/how-to-get-views-on-chaturbate',
        permanent: true,
      },
      {
        source: '/guides/how-to-increase-cam-earnings',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/blog/how-to-increase-cam-earnings',
        permanent: true,
      },
      {
        source: '/blog/how-to-re-engage-whales-and-top-tippers',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/blog/how-to-re-engage-whales-and-high-tipping-fans',
        permanent: true,
      },
      {
        source: '/guides/cam-model-name-generator',
        has: [{ type: 'host', value: 'camcashgrl.com' }],
        destination: 'https://www.camcashgrl.com/tools/cam-model-name-generator',
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
      {
        // Merged duplicate — same topic/keyword as how-to-re-engage-whales-and-high-tipping-fans,
        // which now contains the combined content of both posts.
        source: '/blog/how-to-re-engage-whales-and-top-tippers',
        destination: '/blog/how-to-re-engage-whales-and-high-tipping-fans',
        permanent: true,
      },
      {
        // Merged duplicate — same tool component as /tools/cam-model-name-generator
        // (which had the stronger GSC performance), now with the combined article content.
        source: '/guides/cam-model-name-generator',
        destination: '/tools/cam-model-name-generator',
        permanent: true,
      },
    ]
  },
}
export default nextConfig
