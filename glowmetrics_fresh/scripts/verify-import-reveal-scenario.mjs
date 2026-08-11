// Standalone verification for app/dashboard/page.js's computeImportScenario()
// — the logic that decides which of the 3 post-import reveal scenarios
// (first_import / same_platform / new_platform) to show, and what
// concretely changed vs. the pre-import snapshot. This repo has no test
// framework and page.js can't be plain-Node-imported (it's a "use client"
// Next.js page with JSX) — this script mirrors the function exactly. Keep
// in sync with app/dashboard/page.js's computeImportScenario() if it changes.

function computeImportScenario({ preSnapshot, analytics, lastUploadResult }) {
  const a = analytics || {}
  if (!preSnapshot) return { scenario: 'first_import', changes: {} }

  const prevPlatforms = new Set((preSnapshot.platforms || []).map(p => p.platform))
  const isNewPlatform = !!lastUploadResult?.platform && !prevPlatforms.has(lastUploadResult.platform)
  const scenario = isNewPlatform ? 'new_platform' : 'same_platform'

  const peakChanged = !!(preSnapshot.bestHour && a.bestHour && String(preSnapshot.bestHour.hour) !== String(a.bestHour.hour))
  const prevTopSupporter = preSnapshot.topTippers?.[0]?.username?.toLowerCase() || null
  const newTopSupporter = a.topTippers?.[0]?.username?.toLowerCase() || null
  const topSupporterChanged = !!(prevTopSupporter && newTopSupporter && prevTopSupporter !== newTopSupporter)
  const prevVipUsernames = new Set((preSnapshot.whales || []).filter(w => w.tier === 'Whale').map(w => w.username.toLowerCase()))
  const newVips = (a.whales || []).filter(w => w.tier === 'Whale' && !prevVipUsernames.has(w.username.toLowerCase()))
  const prevBestPlatform = [...(preSnapshot.platforms || [])].filter(p => p.hours > 0).sort((x, y) => y.usdPerHour - x.usdPerHour)[0] || null
  const newBestPlatform = [...(a.platforms || [])].filter(p => p.hours > 0).sort((x, y) => y.usdPerHour - x.usdPerHour)[0] || null
  const bestPlatformChanged = !!(prevBestPlatform && newBestPlatform && prevBestPlatform.platform !== newBestPlatform.platform)

  return { scenario, changes: { peakChanged, topSupporterChanged, newVips, bestPlatformChanged, isNewPlatform } }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. No preSnapshot -> first_import, regardless of anything else
{
  const r = computeImportScenario({ preSnapshot: null, analytics: { platforms: [{ platform: 'Chaturbate' }] }, lastUploadResult: { platform: 'Chaturbate' } })
  check('1. no prior data: scenario is first_import', r.scenario, 'first_import')
  check('1. no prior data: changes is empty object (nothing to compare)', r.changes, {})
}

// 2. Re-importing a platform already present -> same_platform
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }], bestHour: { hour: 9 }, topTippers: [{ username: 'alice' }], whales: [] }
  const analytics = { platforms: [{ platform: 'Chaturbate', hours: 15, usdPerHour: 5 }], bestHour: { hour: 9 }, topTippers: [{ username: 'alice' }], whales: [] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'Chaturbate' } })
  check('2. re-import of an existing platform: scenario is same_platform', r.scenario, 'same_platform')
  check('2. no actual change: peakChanged is false', r.changes.peakChanged, false)
  check('2. no actual change: topSupporterChanged is false', r.changes.topSupporterChanged, false)
}

// 3. Importing a platform that wasn't in the pre-snapshot -> new_platform
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }], bestHour: { hour: 9 }, topTippers: [], whales: [] }
  const analytics = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }, { platform: 'BongaCams', hours: 5, usdPerHour: 8 }], bestHour: { hour: 9 }, topTippers: [], whales: [] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'BongaCams' } })
  check('3. platform not seen before: scenario is new_platform', r.scenario, 'new_platform')
  check('3. isNewPlatform flag is true', r.changes.isNewPlatform, true)
}

// 4. Peak hour genuinely changed
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate' }], bestHour: { hour: 19 }, topTippers: [], whales: [] }
  const analytics = { platforms: [{ platform: 'Chaturbate' }], bestHour: { hour: 9 }, topTippers: [], whales: [] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'Chaturbate' } })
  check('4. bestHour differs from snapshot: peakChanged is true', r.changes.peakChanged, true)
}

// 5. Top supporter genuinely changed
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate' }], bestHour: null, topTippers: [{ username: 'alice' }], whales: [] }
  const analytics = { platforms: [{ platform: 'Chaturbate' }], bestHour: null, topTippers: [{ username: 'bob' }], whales: [] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'Chaturbate' } })
  check('5. topTippers[0] differs from snapshot: topSupporterChanged is true', r.changes.topSupporterChanged, true)
}

// 6. New VIP (Whale tier) supporter detected
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate' }], bestHour: null, topTippers: [], whales: [{ username: 'alice', tier: 'Whale' }] }
  const analytics = { platforms: [{ platform: 'Chaturbate' }], bestHour: null, topTippers: [], whales: [{ username: 'alice', tier: 'Whale' }, { username: 'carol', tier: 'Whale' }] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'Chaturbate' } })
  check('6. one new Whale-tier fan: newVips has exactly 1 entry', r.changes.newVips.length, 1)
  check('6. the new VIP is carol, not alice (already existed)', r.changes.newVips[0].username, 'carol')
}

// 7. Best-earning platform changed
{
  const preSnapshot = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }, { platform: 'BongaCams', hours: 10, usdPerHour: 3 }], bestHour: null, topTippers: [], whales: [] }
  const analytics = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }, { platform: 'BongaCams', hours: 10, usdPerHour: 9 }], bestHour: null, topTippers: [], whales: [] }
  const r = computeImportScenario({ preSnapshot, analytics, lastUploadResult: { platform: 'BongaCams' } })
  check('7. BongaCams overtakes Chaturbate on $/hr: bestPlatformChanged is true', r.changes.bestPlatformChanged, true)
}

// 8. Nothing changed at all -> every change flag stays false/empty, no fabrication
{
  const snap = { platforms: [{ platform: 'Chaturbate', hours: 10, usdPerHour: 5 }], bestHour: { hour: 9 }, topTippers: [{ username: 'alice' }], whales: [{ username: 'alice', tier: 'Whale' }] }
  const r = computeImportScenario({ preSnapshot: snap, analytics: snap, lastUploadResult: { platform: 'Chaturbate' } })
  check('8. identical before/after: peakChanged false', r.changes.peakChanged, false)
  check('8. identical before/after: topSupporterChanged false', r.changes.topSupporterChanged, false)
  check('8. identical before/after: newVips empty', r.changes.newVips.length, 0)
  check('8. identical before/after: bestPlatformChanged false', r.changes.bestPlatformChanged, false)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
