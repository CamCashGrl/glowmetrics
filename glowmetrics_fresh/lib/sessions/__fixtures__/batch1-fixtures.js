// Deterministic low-data and high-data fixtures for the Sessions accuracy
// foundation (Batch 1). Seeded, so every run (and the committed "before"
// snapshot) sees identical rows. USD is tokens × the platform rate and is
// deliberately NOT rounded to cents (BongaCams is $0.025/token).

import { PLATFORM_TOKEN_RATES } from '../../constants'

const RATE = {
  chaturbate: PLATFORM_TOKEN_RATES.Chaturbate,
  bongacams: PLATFORM_TOKEN_RATES.BongaCams,
  myfreecams: PLATFORM_TOKEN_RATES.MyFreeCams,
}
const PLATFORM_NAME = { chaturbate: 'Chaturbate', bongacams: 'BongaCams', myfreecams: 'MyFreeCams' }

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

let nextId = 1
export const resetIds = () => { nextId = 1 }
export const tipRow = (iso, platform, username, tokens, extra = {}) => ({
  id: `t${nextId++}`,
  date_time: iso,
  platform: PLATFORM_NAME[platform] || platform,
  username,
  tokens,
  usd: tokens * (RATE[platform] ?? 0.05),
  source: 'upload',
  live_session_id: null,
  ...extra,
})

const iso = (ms) => new Date(ms).toISOString()
const MIN = 60000
const DAY = 86400000

// ── LOW DATA ─────────────────────────────────────────────────────────────
export function lowDataFixture() {
  resetIds()
  return {
    // one lone tip; two tips 31 min apart (valid: >= 30 min and >= 2 tips);
    // one private charge.
    tips: [
      tipRow('2026-10-20T19:00:00.000Z', 'chaturbate', 'Solo', 10),
      tipRow('2026-10-22T20:00:00.000Z', 'bongacams', 'Ola', 40),
      tipRow('2026-10-22T20:31:00.000Z', 'bongacams', 'Pia', 100),
    ],
    paidSessions: [
      { id: 'p1', date_time: '2026-10-23T21:00:00.000Z', platform: 'BongaCams', username: 'Vip1', username_lower: 'vip1', session_type: 'private', usd: 30.3 },
    ],
    shows: [],
  }
}

// ── HIGH DATA ────────────────────────────────────────────────────────────
// ~120 days, three platforms, a session that straddles the Free window start,
// Live shows (one multi-platform) with private intervals, private charges.
export const HIGH_LATEST_CB = Date.parse('2026-10-30T22:00:00.000Z')
// Free window start for Chaturbate = latest Chaturbate tip − 30 days.
export const HIGH_CB_WINDOW_START = HIGH_LATEST_CB - 30 * DAY

export function highDataFixture() {
  resetIds()
  const rnd = mulberry32(20261104)
  const tips = []
  const fans = ['whale_1', 'sam', 'kit', 'lou', 'max', 'neo', 'ora', 'pat', 'quin', 'rex', 'sky', 'tom']
  const pick = () => fans[Math.floor(rnd() * fans.length)]
  const session = (platform, startMs, count, spanMin) => {
    for (let i = 0; i < count; i++) {
      const at = startMs + Math.floor((i / Math.max(count - 1, 1)) * spanMin * MIN)
      tips.push(tipRow(iso(at), platform, pick(), 1 + Math.floor(rnd() * 120)))
    }
  }
  // Ordinary sessions: every 3rd/4th/5th day per platform for ~120 days.
  const end = Date.parse('2026-10-29T00:00:00.000Z')
  for (const [platform, every] of [['chaturbate', 3], ['bongacams', 4], ['myfreecams', 5]]) {
    for (let d = 3; d <= 120; d += every) {
      session(platform, end - d * DAY + Math.floor(rnd() * 4) * 60 * MIN, 6 + Math.floor(rnd() * 20), 45 + Math.floor(rnd() * 150))
    }
  }
  // A Chaturbate session that straddles the Free window start. The first two
  // tips are before the window (hidden for Free), the last three are inside.
  const ws = HIGH_CB_WINDOW_START
  for (const [off, u, tk] of [[-25, 'whale_1', 90], [-10, 'sam', 20], [10, 'kit', 40], [25, 'whale_1', 60], [55, 'lou', 15]]) {
    tips.push(tipRow(iso(ws + off * MIN), 'chaturbate', u, tk))
  }
  // Pin the latest Chaturbate row so the window start above is exact.
  tips.push(tipRow(iso(HIGH_LATEST_CB), 'chaturbate', 'sam', 30))

  const live = []
  const shows = []
  // Seven single-platform BongaCams Live shows (>= 5 for a $/hr baseline),
  // each with a private interval (no per-fan detail) and linked tips.
  for (let i = 0; i < 7; i++) {
    const id = `show-bc-${i}`
    const startMs = Date.parse('2026-09-01T19:00:00.000Z') + i * 5 * DAY
    const durMin = 90 + i * 20
    const linked = []
    for (let k = 0; k < 8; k++) {
      const row = tipRow(iso(startMs + (k * (durMin - 5) / 7) * MIN), 'bongacams', fans[(i + k) % fans.length], 5 + ((i * 7 + k * 13) % 90), { live_session_id: id, source: 'extension' })
      linked.push(row)
    }
    const publicUsd = linked.reduce((s, t) => s + t.usd, 0)
    const privateUsd = 6 + i
    live.push(...linked)
    shows.push({
      id, platform: 'BongaCams', startedAt: iso(startMs), endedAt: iso(startMs + durMin * MIN),
      durationSeconds: durMin * 60, publicUsd, privateUsd, totalUsd: publicUsd + privateUsd,
      privateSeconds: 600, tipCount: linked.length, uniqueTippers: new Set(linked.map((t) => t.username)).size,
      topTipper: null, isNew: false,
      platformRevenue: [{ platform: 'BongaCams', usd: publicUsd + privateUsd, tips: linked.length }],
      privateIntervals: [{ id: `iv-${i}`, platform: 'BongaCams', startedAt: iso(startMs + 30 * MIN), endedAt: iso(startMs + 40 * MIN), earningsUsd: privateUsd }],
    })
  }
  // A multi-platform Live show (Chaturbate + MyFreeCams).
  {
    const id = 'show-multi'
    const startMs = Date.parse('2026-10-10T18:00:00.000Z')
    const linked = [
      tipRow(iso(startMs + 10 * MIN), 'chaturbate', 'sam', 50, { live_session_id: id, source: 'extension' }),
      tipRow(iso(startMs + 40 * MIN), 'myfreecams', 'kit', 30, { live_session_id: id, source: 'extension' }),
      tipRow(iso(startMs + 70 * MIN), 'chaturbate', 'lou', 20, { live_session_id: id, source: 'extension' }),
    ]
    const publicUsd = linked.reduce((s, t) => s + t.usd, 0)
    live.push(...linked)
    shows.push({
      id, platform: 'Chaturbate', startedAt: iso(startMs), endedAt: iso(startMs + 90 * MIN), durationSeconds: 5400,
      publicUsd, privateUsd: 0, totalUsd: publicUsd, privateSeconds: 0, tipCount: 3, uniqueTippers: 3, topTipper: null, isNew: false,
      platformRevenue: [{ platform: 'Chaturbate', usd: linked[0].usd + linked[2].usd, tips: 2 }, { platform: 'MyFreeCams', usd: linked[1].usd, tips: 1 }],
      privateIntervals: [],
    })
  }
  const paidSessions = []
  for (let c = 0; c < 4; c++) {
    paidSessions.push({ id: `pc${c}`, date_time: iso(Date.parse('2026-10-15T21:00:00.000Z') + c * 2 * MIN), platform: 'BongaCams', username: 'Vip1', username_lower: 'vip1', session_type: 'private', usd: 7.575 })
  }
  paidSessions.push({ id: 'pc-anon', date_time: '2026-10-16T21:00:00.000Z', platform: 'BongaCams', username: null, username_lower: null, session_type: 'group', usd: 4.4 })
  return { tips: [...tips, ...live], paidSessions, shows }
}
