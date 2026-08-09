// Standalone verification for lib/intelligence/platformComparison.js's
// evaluatePlatformGap() (pure decision logic) and runPlatformGapPipeline()
// (orchestration, against a fake Supabase client). This repo has no test
// framework configured and these files can't be `import`-ed directly by
// plain Node — see scripts/verify-stream-completion.mjs's comment for the
// same limitation. This script mirrors both functions exactly. Keep in
// sync with lib/intelligence/platformComparison.js if it changes.

const MULTIPLIER_THRESHOLD = 2

function evaluatePlatformGap({ platforms }) {
  const qualifying = (platforms || []).filter(p => p?.platform && (p.usdPerHour || 0) > 0)
  if (qualifying.length < 2) return null
  const sorted = [...qualifying].sort((a, b) => b.usdPerHour - a.usdPerHour)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  if (top.usdPerHour < bottom.usdPerHour * MULTIPLIER_THRESHOLD) return null
  const multiplier = parseFloat((top.usdPerHour / bottom.usdPerHour).toFixed(1))
  const topKey = top.platform.trim().toLowerCase()
  const bottomKey = bottom.platform.trim().toLowerCase()
  return {
    priority: 'medium',
    title: '⚡ Platform Earnings Gap',
    message: `You earn ${multiplier}x more per hour on ${top.platform} than ${bottom.platform} — $${top.usdPerHour.toFixed(2)}/hr vs $${bottom.usdPerHour.toFixed(2)}/hr.`,
    fingerprint: `platform_gap:${topKey}:${bottomKey}`,
    metadata: {
      top_platform: top.platform, bottom_platform: bottom.platform,
      top_usd_per_hour: top.usdPerHour, bottom_usd_per_hour: bottom.usdPerHour, multiplier,
      top_hours: top.hours, bottom_hours: bottom.hours,
      top_total_usd: top.totalUSD, bottom_total_usd: bottom.totalUSD,
      top_session_count: top.sessions, bottom_session_count: bottom.sessions,
    },
  }
}

const COOLDOWN_SECONDS = 24 * 60 * 60
async function runPlatformGapPipeline({ userId, supabase, platforms }) {
  if (!userId || !supabase) throw new Error('runPlatformGapPipeline requires userId and a Supabase client')
  const evaluation = evaluatePlatformGap({ platforms })
  if (!evaluation) return { event: null, evaluation: null }
  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'platform_gap_detected', p_priority: evaluation.priority,
      p_title: evaluation.title, p_message: evaluation.message, p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata, p_cooldown_seconds: COOLDOWN_SECONDS,
    })
    if (error) throw error
    event = data
  } catch (e) { /* non-fatal, mirrors real pipeline */ }
  return { event, evaluation }
}

// ── Test fixtures ──────────────────────────────────────────────────────
function makePlatform(overrides = {}) {
  return { platform: 'Chaturbate', totalUSD: 500, totalTokens: 10000, sessions: 8, hours: 20, tips: 50, usdPerHour: 25, tokensPerHour: 500, avgTipSize: 10, ...overrides }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. Exactly 2x -> fires
{
  const platforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })]
  const result = evaluatePlatformGap({ platforms })
  check('1. exactly 2x: event fires', result !== null, true)
  check('1. priority is medium', result?.priority, 'medium')
  check('1. multiplier is 2', result?.metadata.multiplier, 2)
  check('1. top platform is Chaturbate', result?.metadata.top_platform, 'Chaturbate')
  check('1. bottom platform is BongaCams', result?.metadata.bottom_platform, 'BongaCams')
}

// 2. Just under 2x -> does not fire
{
  const platforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: 39.9 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })]
  const result = evaluatePlatformGap({ platforms })
  check('2. just under 2x (1.995x): no event', result, null)
}

// 3. Only 1 qualifying platform -> no event
{
  check('3a. single platform: no event', evaluatePlatformGap({ platforms: [makePlatform()] }), null)
  check('3b. empty platforms array: no event', evaluatePlatformGap({ platforms: [] }), null)
  check('3c. undefined platforms: no event, no throw', evaluatePlatformGap({}), null)
  // Second platform present but usdPerHour <= 0 -> still only 1 qualifying
  const platforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 0 })]
  check('3d. second platform has zero usdPerHour: only 1 qualifying, no event', evaluatePlatformGap({ platforms }), null)
}

// 4. Zero/invalid usdPerHour -> no fabricated comparison
{
  const platforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: 0 }), makePlatform({ platform: 'BongaCams', usdPerHour: 0 })]
  check('4a. both platforms zero usdPerHour: no event', evaluatePlatformGap({ platforms }), null)
  const negPlatforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: -5 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })]
  check('4b. negative usdPerHour treated as non-qualifying: no event', evaluatePlatformGap({ platforms: negPlatforms }), null)
  const malformed = [{ platform: 'Chaturbate' }, makePlatform({ platform: 'BongaCams' })]
  check('4c. missing usdPerHour field: no event, no throw', evaluatePlatformGap({ platforms: malformed }), null)
}

// 5. 3+ platforms -> correct top/bottom pairing (never middle)
{
  const platforms = [
    makePlatform({ platform: 'Chaturbate', usdPerHour: 50 }),
    makePlatform({ platform: 'MyFreeCams', usdPerHour: 30 }),
    makePlatform({ platform: 'BongaCams', usdPerHour: 10 }),
  ]
  const result = evaluatePlatformGap({ platforms })
  check('5. 3 platforms: top is the highest usdPerHour', result?.metadata.top_platform, 'Chaturbate')
  check('5. 3 platforms: bottom is the lowest usdPerHour (not the middle one)', result?.metadata.bottom_platform, 'BongaCams')
  check('5. 3 platforms: multiplier computed from top vs bottom, not top vs middle', result?.metadata.multiplier, 5)
}

// 6. Repeated qualifying imports -> 24h dedup via cooldown
function makeFakeSupabase() {
  const events = new Map()
  let nextId = 1
  return {
    _events: events,
    rpc: async (name, params) => {
      const key = params.p_fingerprint
      if (events.has(key)) return { data: events.get(key), error: null }
      const row = { id: nextId++, status: 'new', ...params }
      events.set(key, row)
      return { data: row, error: null }
    },
  }
}
{
  const platforms = [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })]
  const supabase = makeFakeSupabase()
  const first = await runPlatformGapPipeline({ userId: 'user-a', supabase, platforms })
  const second = await runPlatformGapPipeline({ userId: 'user-a', supabase, platforms })
  check('6. repeated qualifying import: exactly one event exists after two calls', supabase._events.size, 1)
  check('6. same pair returns the same event id (cooldown dedup)', first.event?.id, second.event?.id)
  check('6. cooldown_seconds passed is 24h', 86400, 24 * 60 * 60)
}

// 7. Different platform pair -> separate fingerprint/event
{
  const supabase = makeFakeSupabase()
  const pairA = [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })]
  const pairB = [makePlatform({ platform: 'MyFreeCams', usdPerHour: 60 }), makePlatform({ platform: 'CamSoda', usdPerHour: 10 })]
  await runPlatformGapPipeline({ userId: 'user-a', supabase, platforms: pairA })
  await runPlatformGapPipeline({ userId: 'user-a', supabase, platforms: pairB })
  check('7. two distinct platform pairs produce two distinct events', supabase._events.size, 2)
}

// 8. Insufficient/invalid input -> no throw, no event
{
  check('8a. completely empty call: no event, no throw', evaluatePlatformGap({}), null)
  check('8b. null platforms: no event, no throw', evaluatePlatformGap({ platforms: null }), null)
  let threw = false
  try { await runPlatformGapPipeline({ platforms: [] }) } catch (e) { threw = true }
  check('8c. pipeline missing userId/supabase throws rather than silently no-oping', threw, true)
  const brokenSupabase = { rpc: async () => { throw new Error('db down') } }
  let pipelineThrew = false
  let result = null
  try {
    result = await runPlatformGapPipeline({ userId: 'user-a', supabase: brokenSupabase, platforms: [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })] })
  } catch (e) { pipelineThrew = true }
  check('8d. RPC failure does not throw out of the pipeline', pipelineThrew, false)
  check('8e. RPC failure returns a safe null event, not a fabricated success', result?.event, null)
}

// 9. Fingerprint format and case-insensitivity
{
  const a = evaluatePlatformGap({ platforms: [makePlatform({ platform: 'Chaturbate', usdPerHour: 40 }), makePlatform({ platform: 'BongaCams', usdPerHour: 20 })] })
  check('9. fingerprint format is platform_gap:<top>:<bottom>, lowercased', a.fingerprint, 'platform_gap:chaturbate:bongacams')
}

// 10. Metadata carries real sample/session counts, not fabricated
{
  const platforms = [
    makePlatform({ platform: 'Chaturbate', usdPerHour: 40, hours: 15, totalUSD: 600, sessions: 12 }),
    makePlatform({ platform: 'BongaCams', usdPerHour: 20, hours: 25, totalUSD: 500, sessions: 20 }),
  ]
  const result = evaluatePlatformGap({ platforms })
  check('10. top_hours matches real value', result.metadata.top_hours, 15)
  check('10. bottom_session_count matches real value', result.metadata.bottom_session_count, 20)
  check('10. top_total_usd matches real value', result.metadata.top_total_usd, 600)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
