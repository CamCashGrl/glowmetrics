/**
 * @jest-environment node
 */
// The dashboard Live tab's Go Live / Start Streaming / End buttons must drive
// the real session engine. Before this, they only flipped local liveActive,
// which the server-session mirror effect immediately reset — so no session
// was ever created and the timer never ran.
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', 'page.js'), 'utf8')

describe('dashboard Live controls', () => {
  test('Start buttons call the session engine', () => {
    expect(src).toMatch(/const startLiveFromDashboard = async \(\) => \{\s*const session = await liveEngine\.goLive\(livePlatform\)/)
    expect((src.match(/onClick=\{startLiveFromDashboard\}/g) || []).length).toBe(2)
  })

  test('End button calls the session engine', () => {
    expect(src).toMatch(/const endLiveFromDashboard = \(\) => liveEngine\.stop\(\)/)
    expect(src).toMatch(/onClick=\{endLiveFromDashboard\}/)
  })

  test('no button flips liveActive locally any more', () => {
    expect(src).not.toMatch(/onClick=\{\(\) => \{ ?setLiveActive\(true\)/)
    expect(src).not.toMatch(/onClick=\{\(\) => setLiveActive\(false\)\}/)
  })

  test('engine errors are shown to the user', () => {
    expect((src.match(/\{liveEngine\.actionError && \(/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
