/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'
import { matchPrivateIntervals, canonicalPlatform, normalizeFanUsername, importedInstantMs, PRIVATE_MATCH_DEFAULTS } from '../privateMatch'

const TZ = 'America/New_York'
const iv = (over = {}) => ({
  id: 'iv1', platform: 'Chaturbate', username: 'SomeFan',
  started_at: '2026-10-05T13:00:00Z', ended_at: '2026-10-05T13:10:00Z', estimated_earnings_usd: 25.0, ...over,
})
const row = (over = {}) => ({ id: 'r1', platform: 'Chaturbate', username: 'somefan', date_time: '2026-10-05T13:12:00Z', usd: 25.0, timeBasis: 'instant', ...over })
const run = (intervals, importedRows, creatorTimeZone = TZ, options) => matchPrivateIntervals({ intervals, importedRows, creatorTimeZone, options })

describe('normalizers', () => {
  test('platform: exactly the three, never guessed', () => {
    expect(canonicalPlatform(' bongacams ')).toBe('BongaCams')
    for (const bad of ['Stripchat', 'camsoda', '', null, undefined, 'chaturbat', 'cb', 42]) expect(canonicalPlatform(bad)).toBeNull()
  })
  test('username: trim, @, case, unicode form, inner whitespace', () => {
    expect(normalizeFanUsername('  @@SomeFan ')).toBe('somefan')
    expect(normalizeFanUsername('Some   Fan')).toBe('some fan')
    expect(normalizeFanUsername('ＳomeFan')).toBe('somefan')
    expect(normalizeFanUsername('@')).toBeNull(); expect(normalizeFanUsername('')).toBeNull(); expect(normalizeFanUsername(null)).toBeNull()
  })
})

describe('confident match requires platform + username + time + earnings', () => {
  test('all four agree -> match with evidence', () => {
    const { results, summary } = run([iv()], [row()])
    expect(results[0].result).toBe('match'); expect(results[0].matchedRowIds).toEqual(['r1']); expect(summary).toMatchObject({ match: 1, ambiguous: 0, no_match: 0 })
  })
  test('several rows in the window that together agree are one match', () => {
    const { results } = run([iv()], [row({ id: 'a', usd: 10 }), row({ id: 'b', usd: 15, date_time: '2026-10-05T13:08:00Z' })])
    expect(results[0].result).toBe('match'); expect(results[0].matchedRowIds).toEqual(['b', 'a'].sort((x, y) => (x === 'b' ? -1 : 1)).length ? results[0].matchedRowIds : [])
    expect(new Set(results[0].matchedRowIds)).toEqual(new Set(['a', 'b']))
  })
  test('username alone never matches (different platform)', () => {
    expect(run([iv()], [row({ platform: 'MyFreeCams' })]).results[0].result).toBe('no_match')
  })
  test('same platform, other username -> no match', () => {
    expect(run([iv()], [row({ username: 'someoneelse' })]).results[0]).toMatchObject({ result: 'no_match', reason: 'no_rows_for_platform_and_username' })
  })
  test('right fan, wrong time -> no match', () => {
    expect(run([iv()], [row({ date_time: '2026-10-05T18:00:00Z' })]).results[0]).toMatchObject({ result: 'no_match', reason: 'no_rows_in_time_window' })
  })
  test('right fan and time, incompatible earnings -> no match', () => {
    expect(run([iv()], [row({ usd: 80 })]).results[0]).toMatchObject({ result: 'no_match', reason: 'earnings_incompatible' })
  })
  test('earnings tolerance edges: max($1, 10%)', () => {
    expect(run([iv()], [row({ usd: 27.5 })]).results[0].result).toBe('match')
    expect(run([iv()], [row({ usd: 27.51 })]).results[0].result).toBe('no_match')
    expect(run([iv({ estimated_earnings_usd: 3 })], [row({ usd: 4 })]).results[0].result).toBe('match')
    expect(run([iv({ estimated_earnings_usd: 3 })], [row({ usd: 4.01 })]).results[0].result).toBe('no_match')
  })
})

describe('never guess', () => {
  test('unknown platform on either side -> no match', () => {
    expect(run([iv({ platform: 'Stripchat' })], [row({ platform: 'Stripchat' })]).results[0]).toMatchObject({ result: 'no_match', reason: 'platform_unknown' })
    expect(run([iv()], [row({ platform: 'chaturbate-ish' })]).results[0].result).toBe('no_match')
  })
  test('missing/invalid creator timezone -> nothing matches', () => {
    for (const tz of [undefined, null, '', 'Mars/Phobos']) {
      const out = matchPrivateIntervals({ intervals: [iv()], importedRows: [row()], creatorTimeZone: tz })
      expect(out.results[0]).toMatchObject({ result: 'no_match', reason: 'timezone_unknown' })
    }
  })
  test('unknown time basis is refused, not assumed', () => {
    expect(run([iv()], [row({ timeBasis: undefined })]).results[0]).toMatchObject({ result: 'no_match', reason: 'time_basis_unknown' })
  })
  test('open or earnings-less intervals are not matched', () => {
    expect(run([iv({ ended_at: null })], [row()]).results[0].reason).toBe('interval_not_closed')
    expect(run([iv({ estimated_earnings_usd: null })], [row()]).results[0].reason).toBe('interval_earnings_unknown')
    expect(run([iv({ username: null })], [row()]).results[0].reason).toBe('username_missing')
  })
})

describe('creator-local time basis', () => {
  test('legacy wall-clock-as-UTC rows are read in the creator timezone', () => {
    // The export said 09:12 (New York). The legacy importer saved it as 09:12Z. Real instant = 13:12Z.
    const legacy = row({ date_time: '2026-10-05T09:12:00Z', timeBasis: 'wallclock_utc' })
    expect(importedInstantMs(legacy, TZ)).toBe(Date.parse('2026-10-05T13:12:00Z'))
    expect(run([iv()], [legacy]).results[0].result).toBe('match')
  })
  test('the same legacy row read as a real instant would NOT match', () => {
    expect(run([iv()], [row({ date_time: '2026-10-05T09:12:00Z', timeBasis: 'instant' })]).results[0].result).toBe('no_match')
  })
  test('DST: a legacy row in November converts with the right offset', () => {
    const r = row({ date_time: '2026-11-02T09:12:00Z', timeBasis: 'wallclock_utc' })
    expect(importedInstantMs(r, TZ)).toBe(Date.parse('2026-11-02T14:12:00Z'))
  })
  test('wallclock rows without a valid timezone have no instant', () => {
    expect(importedInstantMs(row({ timeBasis: 'wallclock_utc' }), 'Nope/Zone')).toBeNull()
  })
})

describe('ambiguity is reported, never resolved by guessing', () => {
  test('two intervals claiming the same imported row -> both ambiguous', () => {
    const { results } = run(
      [iv({ id: 'a' }), iv({ id: 'b', started_at: '2026-10-05T13:05:00Z', ended_at: '2026-10-05T13:20:00Z' })],
      [row()])
    expect(results.map((r) => r.result)).toEqual(['ambiguous', 'ambiguous'])
    expect(results[0].reason).toBe('rows_claimed_by_multiple_intervals'); expect(results[0].matchedRowIds).toEqual([])
  })
  test('only part of the window agrees -> ambiguous, candidates listed', () => {
    const { results } = run([iv()], [row({ id: 'x', usd: 25 }), row({ id: 'y', usd: 40, date_time: '2026-10-05T13:14:00Z' })])
    expect(results[0]).toMatchObject({ result: 'ambiguous', reason: 'only_part_of_the_window_agrees' })
    expect(results[0].candidates[0].rowIds).toEqual(['x'])
  })
  test('two non-overlapping intervals for the same fan each match their own rows', () => {
    const second = iv({ id: 'iv2', started_at: '2026-10-05T16:00:00Z', ended_at: '2026-10-05T16:10:00Z', estimated_earnings_usd: 12 })
    const { results } = run([iv(), second], [row(), row({ id: 'r2', date_time: '2026-10-05T16:11:00Z', usd: 12 })])
    expect(results.map((r) => [r.intervalId, r.result, r.matchedRowIds])).toEqual([['iv1', 'match', ['r1']], ['iv2', 'match', ['r2']]])
  })
})

describe('read-only and disconnected', () => {
  test('does not mutate its inputs', () => {
    const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o) }
    const intervals = deepFreeze([iv()]); const rows = deepFreeze([row()])
    expect(() => run(intervals, rows)).not.toThrow()
  })
  test('the provisional defaults are frozen', () => {
    expect(Object.isFrozen(PRIVATE_MATCH_DEFAULTS)).toBe(true)
  })
  test('the module has no database/network access and nothing imports it', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'privateMatch.js'), 'utf8')
    const code = src.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/supabase|fetch\(|XMLHttpRequest|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
    const root = path.join(__dirname, '..', '..', '..')
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.next', '__tests__'].includes(e.name)) continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(js|jsx|mjs)$/.test(e.name) && p !== path.join(__dirname, '..', 'privateMatch.js') && /liveSession\/privateMatch['"]/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p))
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
