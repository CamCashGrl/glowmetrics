/**
 * @jest-environment node
 */
// Dashboard Live state mirrors the canonical server session ONLY. No button
// and no arriving tip may create, extend or end it, and the allowance bar is
// the shared component fed by the database's state.
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', 'page.js'), 'utf8')
const live = fs.readFileSync(path.join(__dirname, '..', '..', 'live', 'page.js'), 'utf8')

describe('dashboard Live state is derived from the server session', () => {
  test('liveActive and liveStartTime are not React state and have no setters', () => {
    expect(src).not.toMatch(/setLiveActive|setLiveStartTime/)
    expect(src).not.toMatch(/const \[liveActive,/)
    expect(src).not.toMatch(/const \[liveStartTime,/)
    expect(src).toMatch(/const liveActive = liveServerStatus === 'live' \|\| liveServerStatus === 'starting'/)
    expect(src).toMatch(/const liveStartTime = useMemo\(\(\) => \(liveStartedAtIso \? new Date\(liveStartedAtIso\) : null\), \[liveStartedAtIso\]\)/)
  })

  test('the derived values come from the engine\'s server session', () => {
    expect(src).toMatch(/const liveServerStatus = liveEngine\.serverSession\?\.status/)
    expect(src).toMatch(/const liveStartedAtIso = liveEngine\.serverSession\?\.started_at \|\| null/)
  })

  test('tip handlers (extension message, realtime, history hydration) never activate Live', () => {
    const tipBlocks = [
      src.slice(src.indexOf("window.addEventListener('message', handleExtensionMessage)") - 1800, src.indexOf("window.addEventListener('message', handleExtensionMessage)")),
      src.slice(src.indexOf('.subscribe()') - 1200, src.indexOf('.subscribe()')),
      src.slice(src.indexOf('loadRecentLiveTips()') - 1500, src.indexOf('loadRecentLiveTips()') + 40),
    ]
    for (const block of tipBlocks) expect(block).not.toMatch(/setLiveActive|setLiveStartTime|Auto-activate/)
    expect(src).toMatch(/A tip never creates Live state/)
  })

  test('Go Live / Start Streaming / End still drive the real engine', () => {
    expect(src).toMatch(/await liveEngine\.goLive\(livePlatform\)/)
    expect(src).toMatch(/liveEngine\.stop\(\)/)
  })
})

describe('no default platform on the dashboard', () => {
  test('livePlatform starts empty and is restored only from the creator\'s own choice or the server session', () => {
    expect(src).toMatch(/const \[livePlatform, setLivePlatform\] = useState\(''\)/)
    expect(src).toMatch(/localStorage\.getItem\('camcash_live_platform'\)/)
    expect(src).toMatch(/liveEngine\.serverSession\?\.stream_platform/)
  })
  test('every Go Live button is disabled until a platform is chosen', () => {
    const buttons = src.match(/<button onClick=\{startLiveFromDashboard\}[^>]*>/g) || []
    expect(buttons.length).toBe(2)
    for (const b of buttons) expect(b).toMatch(/disabled=\{liveEngine\.actionPending \|\| !livePlatform\}/)
  })
  test('both start surfaces have a platform selector with an empty placeholder', () => {
    expect((src.match(/<option value="">(Platform…|Choose your platform…)<\/option>/g) || []).length).toBe(2)
  })
})

describe('allowance bar', () => {
  test('the dashboard Live tab mounts the SHARED bar with the database state and a timezone saver', () => {
    expect(src).toMatch(/import LiveModeAllowanceBar from '\.\.\/live\/components\/LiveModeAllowanceBar'/)
    expect(src).toMatch(/<LiveModeAllowanceBar\s+allowance=\{liveEngine\.allowance\}\s+receivedAt=\{liveEngine\.allowanceReceivedAt\}\s+onSaveTimezone=\{changeCreatorTimezone\}\s+onRefresh=\{liveEngine\.refresh\}/)
  })
  test('/live uses the same component (one implementation)', () => {
    expect(live).toMatch(/import LiveModeAllowanceBar from '\.\/components\/LiveModeAllowanceBar'/)
    expect(live).toMatch(/<LiveModeAllowanceBar\s+allowance=\{engine\.allowance\}/)
    expect(fs.readdirSync(path.join(__dirname, '..', '..', 'live', 'components')).filter((f) => /Allowance/i.test(f))).toEqual(['LiveModeAllowanceBar.js'])
  })
  test('/live also starts with no default platform', () => {
    expect(live).toMatch(/const \[livePlatform, setLivePlatform\] = useState\(''\)/)
  })
})

describe('Private Mode on the dashboard Live tab', () => {
  test('uses the shared control, only while the server session is live', () => {
    expect(src).toMatch(/import PrivateShowControl from '\.\.\/live\/PrivateShowControl'/)
    expect(src).toMatch(/liveServerStatus === 'live' && \(\s*<PrivateShowControl engine=\{liveEngine\} platform=\{liveEngine\.serverSession\?\.stream_platform\}/)
    expect(fs.readdirSync(path.join(__dirname, '..', '..', 'live')).filter((f) => /PrivateShow/.test(f))).toEqual(['PrivateShowControl.js'])
  })
})
