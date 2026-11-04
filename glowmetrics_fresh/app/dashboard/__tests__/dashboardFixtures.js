// Realistic, deterministic account for rendering the real Dashboard.
// Dates are relative to `now` so month-over-month (creator-local month keys)
// always has a "this month" and a "previous month" to compute. Not a test file.
import { liveShow } from '../../../lib/sessions/__fixtures__/batch1-fixtures'

const MIN = 60000, HOUR = 3600000, DAY = 86400000
const RATE = { Chaturbate: 0.05, BongaCams: 0.025, MyFreeCams: 0.05 }
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const iso = (ms) => new Date(ms).toISOString()

export function buildAccount({ now = Date.now(), plan = 'pro', uid = 'u1' } = {}) {
  const rnd = mulberry32(20261104)
  const fans = Array.from({ length: 70 }, (_, i) => (i < 4 ? `whale${i + 1}` : `fan${String(i).padStart(2, '0')}`))
  const pick = () => (rnd() < 0.25 ? fans[Math.floor(rnd() * 4)] : fans[Math.floor(rnd() * fans.length)])
  const tips = []
  let n = 0
  const addTip = (platform, at, extra = {}) => {
    const tokens = 1 + Math.floor(rnd() * 150)
    tips.push({
      id: `tip-${String(n++).padStart(6, '0')}`, user_id: uid, platform, username: pick(), tokens,
      usd: tokens * RATE[platform], date_time: iso(at), source: 'upload', live_session_id: null, ...extra,
    })
  }
  const base = now - 2 * HOUR
  for (const [platform, every] of [['Chaturbate', 2], ['BongaCams', 3], ['MyFreeCams', 4]]) {
    for (let d = 1; d <= 120; d += every) {
      const start = base - d * DAY - Math.floor(rnd() * 5) * HOUR
      const count = 8 + Math.floor(rnd() * 24)
      const gapMin = 4 + Math.floor(rnd() * 6)
      for (let i = 0; i < count; i++) addTip(platform, start + i * gapMin * MIN, d < 20 && platform === 'Chaturbate' ? { source: 'extension' } : {})
    }
  }
  // A BongaCams fan seen ONLY 95 days ago: outside Free's 31-day window for a
  // non-primary platform (primary = Chaturbate). Free must never show this fan.
  for (const [k, tokens] of [[0, 30000], [12, 26000], [25, 31000]]) {
    tips.push({ id: `tip-ancient-${k}`, user_id: uid, platform: 'BongaCams', username: 'ancient_bc_fan', tokens, usd: tokens * RATE.BongaCams, date_time: iso(base - 95 * DAY + k * MIN), source: 'upload', live_session_id: null })
  }
  // Finalized Live shows on Chaturbate with their own linked tips (persisted-summary shape)
  const shows = []
  for (const [i, daysAgo] of [[0, 3], [1, 9]]) {
    const id = `show-${i}`, startMs = base - daysAgo * DAY, minutes = 95
    const before = tips.length
    for (let k = 0; k < 9; k++) addTip('Chaturbate', startMs + (5 + k * 10) * MIN, { live_session_id: id, source: 'extension' })
    const linked = tips.slice(before)
    const publicUsd = linked.reduce((a, t) => a + t.usd, 0)
    shows.push(liveShow({
      id, platform: 'Chaturbate', startedAt: iso(startMs), minutes, publicUsd, privateUsd: 4.5, tipCount: linked.length,
      uniqueTippers: new Set(linked.map((t) => t.username)).size,
      privateIntervals: [{ id: `iv-${i}`, platform: 'Chaturbate', startedAt: iso(startMs + 40 * MIN), endedAt: iso(startMs + 50 * MIN), earningsUsd: 4.5 }],
    }))
  }
  // Private / group / spy charges (BongaCams): billed per charge, several per fan
  const paid = []
  for (let c = 0; c < 330; c++) {
    const group = Math.floor(c / 6)
    const at = base - (1 + group % 100) * DAY - (c % 6) * 2 * MIN
    paid.push({
      id: `paid-${String(c).padStart(5, '0')}`, user_id: uid, platform: 'BongaCams', username: `vip${group % 9}`, username_lower: `vip${group % 9}`,
      session_type: ['private', 'group', 'spy'][group % 3], usd: 7.575, date_time: iso(at),
    })
  }
  paid.push({ id: 'paid-anon', user_id: uid, platform: 'BongaCams', username: null, username_lower: null, session_type: 'group', usd: 4.4, date_time: iso(base - 2 * DAY) })

  return {
    user: { id: uid, email: 'creator@example.com' },
    shows,
    tables: {
      tips, paid_sessions: paid,
      profiles: [{ id: uid, plan, primary_pro_platform: 'Chaturbate', streaming_platforms: ['Chaturbate', 'BongaCams', 'MyFreeCams'], timezone: 'America/New_York' }],
      beta_users: [{ user_id: uid, onboarding_complete: true }],
    },
  }
}
