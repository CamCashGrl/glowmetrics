// TX Hub is a private, authenticated financial dashboard — there is nothing
// here for search engines to index, and this data (transaction/earnings
// history) should never be crawlable. app/robots.js already disallows all of
// /dashboard at the crawl level; this adds an explicit per-page `noindex` as
// defense-in-depth (covers the case where a URL is linked from elsewhere and
// discovered without being crawled) and gives the tab a real title instead
// of inheriting the marketing site's default.
export const metadata = {
  title: 'TX Hub',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function TxHubLayout({ children }) {
  return children
}
