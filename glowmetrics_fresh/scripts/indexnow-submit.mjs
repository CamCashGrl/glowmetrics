/**
 * IndexNow — bulk URL submission (Bing, Yandex, and other IndexNow-enabled engines)
 *
 * Setup (already done for this project):
 * 1. Key: 3cf5ba2838574a9ab80e2275baec56e7
 * 2. Key file hosted at: https://www.camcashgrl.com/3cf5ba2838574a9ab80e2275baec56e7.txt
 *    (served from public/3cf5ba2838574a9ab80e2275baec56e7.txt)
 *
 * This script fetches the live sitemap and submits every URL in one bulk
 * IndexNow request, so it stays in sync with app/sitemap.js automatically.
 *
 * Run:
 *   node scripts/indexnow-submit.mjs
 *
 * Verify:
 *   https://www.bing.com/webmasters → URL Inspection / IndexNow reports
 */

const HOST = 'www.camcashgrl.com'
const BASE = `https://${HOST}`
const KEY = '3cf5ba2838574a9ab80e2275baec56e7'
const KEY_LOCATION = `${BASE}/${KEY}.txt`

async function getSitemapURLs() {
  const res = await fetch(`${BASE}/sitemap.xml`)
  if (!res.ok) {
    console.error(`❌ Failed to fetch sitemap.xml: ${res.status}`)
    process.exit(1)
  }
  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
  if (urls.length === 0) {
    console.error('❌ No URLs found in sitemap.xml')
    process.exit(1)
  }
  return urls
}

async function submitBatch(urlList) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  })

  if (res.status === 200 || res.status === 202) {
    console.log(`✅ Submitted ${urlList.length} URLs (HTTP ${res.status})`)
  } else {
    const body = await res.text().catch(() => '')
    console.error(`❌ IndexNow submission failed — HTTP ${res.status}`)
    console.error(body)
    process.exit(1)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log(`\n🚀 CamCash — IndexNow (Bing) submission\n`)

const urls = await getSitemapURLs()
console.log(`Found ${urls.length} URLs in sitemap.xml\n`)

// IndexNow accepts up to 10,000 URLs per request
await submitBatch(urls)

console.log(`\n✅ Done! Bing typically crawls submitted URLs within a few hours.`)
console.log(`   Check progress at https://www.bing.com/webmasters\n`)
