/**
 * IndexNow — bulk URL submission
 *
 * One ping notifies Bing, Yandex, Seznam.cz, Naver, and any other
 * search engine that participates in the IndexNow protocol.
 *
 * Setup (already done):
 * 1. Key file generated and published at:
 *    https://www.camcashgrl.com/f6daef5464a373187420351fbe14be93.txt
 *
 * Run after publishing new/updated pages:
 *   node scripts/indexnow-submit.mjs
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HOST = 'www.camcashgrl.com'
const KEY = 'f6daef5464a373187420351fbe14be93'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

const { default: sitemap } = await import(resolve(__dirname, '../app/sitemap.js'))
const urls = sitemap().map(page => page.url)

async function submit(urlList) {
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

  if (res.ok) {
    console.log(`✅ Submitted ${urlList.length} URLs — status ${res.status}`)
  } else {
    const text = await res.text().catch(() => '')
    console.log(`❌ IndexNow rejected submission — status ${res.status} ${text}`)
  }
}

console.log(`\n🚀 CamCash — IndexNow (Bing / Yandex / Seznam / Naver)\n`)
console.log(`Submitting ${urls.length} URLs...\n`)

await submit(urls)

console.log(`\n✅ Done! Bing typically picks these up within minutes to hours.`)
console.log(`   Check status at https://www.bing.com/webmasters\n`)
