/**
 * Canonical earnings-mix composition — how much a creator earns from free
 * chat vs each paid session type vs Live Mode, split by platform.
 *
 * The three revenue streams live in three separate tables and are NEVER
 * merged at the row level (see computePaidSessionAnalytics()'s header and
 * the upload split in app/api/upload/route.js, which routes is_paid_session
 * rows to paid_sessions before tips are stored). They are only ever summed
 * here, for display, which is why this is the one place allowed to add them
 * together — any component needing the mix imports this instead of totalling
 * the three sources itself.
 *
 *   free_chat    — inferred sessions over the tips table (manual_tip)
 *   private_chat / full_private / group_chat / spy_mode — paid_sessions rows
 *   live_mode    — live_tips, earned during a tracked Live Mode session
 */

// paid_sessions.session_type is written by lib/analytics.js's
// PAID_SESSION_TYPE_PATTERNS. Mapping it here keeps the display keys stable
// even if a platform later adds a new label.
const PAID_TYPE_TO_STREAM = {
  'Private Chat':      'private_chat',
  'Full-Private Chat': 'full_private',
  'Group Chat':        'group_chat',
  'Spy Mode':          'spy_mode',
}

/**
 * The canonical paid-session classifier. Order matters: full-private must be
 * tested before private, or "Full-Private Chat" matches /private/ and is
 * silently downgraded. This mirrors PAID_SESSION_TYPE_PATTERNS in
 * lib/analytics.js, which the CSV import already applies when routing rows
 * into paid_sessions — so a row's stream is decided the same way at import
 * time and at display time.
 *
 * Returns null for anything unrecognised. Callers must NOT default an
 * unknown label to a real stream: doing so overstates whichever stream
 * absorbs it. lib/txHub.js previously defaulted to 'private' here.
 *
 * @param {?string} rawType - paid_sessions.session_type or a tip's tip_type
 * @returns {?string} a REVENUE_STREAMS key, or null if unrecognised
 */
export function classifyPaidSessionStream(rawType) {
  if (!rawType) return null
  const t = String(rawType).toLowerCase()
  if (/full[\s-]?private/.test(t)) return 'full_private'
  if (t.includes('private'))        return 'private_chat'
  if (t.includes('spy'))            return 'spy_mode'
  if (t.includes('group'))          return 'group_chat'
  return null
}

export const REVENUE_STREAMS = [
  { key: 'free_chat',    label: 'Free Chat',    color: '#22d3ee', note: 'Public tips in open chat' },
  { key: 'private_chat', label: 'Private',      color: '#a855f7', note: 'One-on-one paid sessions' },
  { key: 'full_private', label: 'Full-Private', color: '#8b5cf6', note: 'Exclusive, no spying allowed' },
  { key: 'group_chat',   label: 'Group',        color: '#f59e0b', note: 'Multi-fan paid sessions' },
  { key: 'spy_mode',     label: 'Spy',          color: '#f472b6', note: 'Fans paying to watch a private' },
  { key: 'live_mode',    label: 'Live Mode',    color: '#4ade80', note: 'Earned during a tracked Live Mode stream' },
  { key: 'other',        label: 'Other',        color: '#64748b', note: 'Paid sessions whose type could not be classified' },
]

const STREAM_ORDER = REVENUE_STREAMS.map(s => s.key)
const emptyStreamTotals = () => Object.fromEntries(STREAM_ORDER.map(k => [k, 0]))

/**
 * @param {Object}  input
 * @param {Array}   input.freeChatSessions - sessions from detectSessions(); the
 *                  caller picks the population (meaningful-only vs all valid)
 *                  so this stays consistent with whatever the page displays.
 * @param {Array}   input.paidSessions     - raw paid_sessions rows
 * @param {?number} input.liveTotalUSD     - live_tips total, or null to omit
 *                  the stream entirely rather than render a misleading $0.
 * @returns {Object} { totalUSD, byStream, byPlatform, platforms, isEmpty }
 */
export function computeRevenueMix({ freeChatSessions = [], paidSessions = [], liveTotalUSD = null } = {}) {
  // platform -> { [streamKey]: usd }, plus a session count per stream.
  const platformMap = {}
  const streamTotals = emptyStreamTotals()
  const streamCounts = emptyStreamTotals()

  const bump = (platform, streamKey, usd, count = 1) => {
    const p = platform || 'Unknown'
    if (!platformMap[p]) platformMap[p] = emptyStreamTotals()
    platformMap[p][streamKey] += usd
    streamTotals[streamKey]   += usd
    streamCounts[streamKey]   += count
  }

  freeChatSessions.forEach(s => bump(s.platform, 'free_chat', s.totalUSD || 0))

  paidSessions.forEach(r => {
    // An unrecognised session_type goes to 'other'. It must NOT be folded
    // into "Private" (that overstates a stream the creator acts on), but it
    // must not be dropped either — dropping it would make this panel's total
    // silently under-report actual earnings and disagree with TX Hub's
    // ledger, which keeps the same rows as 'other'.
    const streamKey = PAID_TYPE_TO_STREAM[r.session_type]
      || classifyPaidSessionStream(r.session_type)
      || 'other'
    bump(r.platform, streamKey, parseFloat(r.usd) || 0)
  })

  // Live Mode earnings carry no platform attribution on the totals endpoint,
  // so they get their own row rather than being spread across platforms.
  if (liveTotalUSD !== null && liveTotalUSD !== undefined) {
    bump('Live Mode', 'live_mode', parseFloat(liveTotalUSD) || 0, 0)
  }

  const totalUSD = STREAM_ORDER.reduce((a, k) => a + streamTotals[k], 0)

  const byStream = REVENUE_STREAMS
    .map(s => ({
      ...s,
      usd:   parseFloat(streamTotals[s.key].toFixed(2)),
      count: streamCounts[s.key],
      pct:   totalUSD > 0 ? (streamTotals[s.key] / totalUSD) * 100 : 0,
    }))
    .filter(s => s.usd > 0)

  const byPlatform = Object.entries(platformMap)
    .map(([platform, totals]) => {
      const platTotal = STREAM_ORDER.reduce((a, k) => a + totals[k], 0)
      return {
        platform,
        totalUSD: parseFloat(platTotal.toFixed(2)),
        pct: totalUSD > 0 ? (platTotal / totalUSD) * 100 : 0,
        streams: REVENUE_STREAMS
          .map(s => ({
            ...s,
            usd: parseFloat(totals[s.key].toFixed(2)),
            pct: platTotal > 0 ? (totals[s.key] / platTotal) * 100 : 0,
          }))
          .filter(s => s.usd > 0),
      }
    })
    .filter(p => p.totalUSD > 0)
    .sort((a, b) => b.totalUSD - a.totalUSD)

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    byStream,
    byPlatform,
    platforms: byPlatform.map(p => p.platform),
    isEmpty: totalUSD <= 0,
  }
}
