/**
 * Google Indexing API — bulk URL submission
 *
 * Setup (one-time, ~10 min):
 * 1. Go to https://console.cloud.google.com → create a project
 * 2. Enable "Web Search Indexing API"
 * 3. IAM & Admin → Service Accounts → Create service account
 * 4. Give it no role, click Done
 * 5. Click the service account → Keys → Add Key → JSON → download it
 * 6. Save the JSON file as scripts/service-account.json
 * 7. In Google Search Console → Settings → Users and permissions
 *    → Add user → paste the service account email → set as Owner
 *
 * Run:
 *   node scripts/request-indexing.mjs
 */

import { readFileSync } from 'fs'
import { createSign } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load service account key ──────────────────────────────────────────────
const keyPath = resolve(__dirname, 'service-account.json')
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
} catch {
  console.error('❌ Could not read scripts/service-account.json')
  console.error('   Follow the setup instructions at the top of this file.')
  process.exit(1)
}

// ── All URLs to submit ────────────────────────────────────────────────────
const URLS = [
  // Hubs — submit first
  'https://www.camcashgrl.com/',
  'https://www.camcashgrl.com/blog',
  'https://www.camcashgrl.com/guides',

  // Free tools
  'https://www.camcashgrl.com/guides/chaturbate-room-title-generator',
  'https://www.camcashgrl.com/guides/chaturbate-token-calculator',

  // Guides
  'https://www.camcashgrl.com/guides/chaturbate-earnings-tracker',
  'https://www.camcashgrl.com/guides/cam-model-analytics',
  'https://www.camcashgrl.com/guides/how-to-increase-cam-tips',
  'https://www.camcashgrl.com/guides/bongacams-analytics',
  'https://www.camcashgrl.com/guides/best-time-to-stream-chaturbate',
  'https://www.camcashgrl.com/guides/cam-model-top-tippers',
  'https://www.camcashgrl.com/guides/cam-model-income-tracker',
  'https://www.camcashgrl.com/guides/myfreecams-analytics',
  'https://www.camcashgrl.com/guides/chaturbate-token-tracker',
  'https://www.camcashgrl.com/guides/cam-model-revenue-dashboard',
  'https://www.camcashgrl.com/guides/cam-model-session-breakdown',
  'https://www.camcashgrl.com/guides/chaturbate-best-hours',

  // Blog posts
  'https://www.camcashgrl.com/blog/best-cam-model-tools',
  'https://www.camcashgrl.com/blog/cam-model-earnings',
  'https://www.camcashgrl.com/blog/cam-model-taxes',
  'https://www.camcashgrl.com/blog/how-much-do-chaturbate-models-make',
  'https://www.camcashgrl.com/blog/how-to-build-loyal-fans',
  'https://www.camcashgrl.com/blog/how-to-get-more-tips-on-myfreecams',
  'https://www.camcashgrl.com/blog/how-to-get-views-on-chaturbate',
  'https://www.camcashgrl.com/blog/how-to-increase-cam-earnings',
  'https://www.camcashgrl.com/blog/how-to-make-more-money-on-chaturbate',
  'https://www.camcashgrl.com/blog/how-to-re-engage-whales-and-top-tippers',
  'https://www.camcashgrl.com/blog/why-cam-income-is-inconsistent',
  'https://www.camcashgrl.com/blog/why-cam-streams-arent-making-money',
]

// ── Build JWT for Google OAuth2 ───────────────────────────────────────────
function buildJWT(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')

  return `${signingInput}.${signature}`
}

async function getAccessToken(serviceAccount) {
  const jwt = buildJWT(serviceAccount)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    console.error('❌ Failed to get access token:', data)
    process.exit(1)
  }
  return data.access_token
}

async function submitURL(url, token) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  })
  const data = await res.json()
  if (res.ok) {
    console.log(`✅ ${url}`)
  } else {
    console.log(`❌ ${url} — ${data.error?.message || JSON.stringify(data)}`)
  }
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 300))
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log(`\n🚀 CamCash — Google Indexing API\n`)
console.log(`Submitting ${URLS.length} URLs...\n`)

const token = await getAccessToken(serviceAccount)

for (const url of URLS) {
  await submitURL(url, token)
}

console.log(`\n✅ Done! Google will crawl and index these within 24–48 hours.`)
console.log(`   Check progress at https://search.google.com/search-console\n`)
