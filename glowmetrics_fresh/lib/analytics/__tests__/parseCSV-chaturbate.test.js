/**
 * Regression tests for lib/analytics.js parseCSV() against Chaturbate's
 * "Timestamp, Token change, Token balance, Transaction type, User, Note"
 * export format — the CSV-file-upload path (app/api/upload/route.js).
 *
 * Guards against two previously-shipped bugs:
 *   - parseHeaderless() treating the running "Token balance" column as USD
 *     (a ~580x earnings inflation)
 *   - parseCSVLine() failing to strip quotes from individual field values,
 *     breaking header detection and misaligning every column
 */
import { parseCSV, detectPlatform } from '../../analytics.js'

const HEADER = '"Timestamp","Token change","Token balance","Transaction type","User","Note"'
const tipRow = (ts, change, balance, user, note = '') =>
  `"${ts}",${change},${balance},"Tip received","${user}","${note}"`
const cashoutRow = (ts, change, balance) =>
  `"${ts}",${change},${balance},"Tokens cashed out","",""`

describe('parseCSV — Chaturbate CSV file upload', () => {
  test('detects Chaturbate from the quoted header row', () => {
    const csv = [HEADER, tipRow('2026-02-12 06:05:59.000000', 5, 181, 'fanA')].join('\n')
    expect(detectPlatform(csv)).toBe('Chaturbate')
  })

  test('canonical dataset shape: totals derived from tokenChange, never Token balance', () => {
    const lines = [
      HEADER,
      cashoutRow('2026-02-14 13:54:51.000000', -181, 0),
      tipRow('2026-02-12 06:05:59.000000', 5, 181, '69j0hndo', 'i wanna feel u cum on me so bad'),
      tipRow('2026-02-12 05:59:38.000000', 1, 176, 'prov46', 'mmmm let me fill you with cum'),
      tipRow('2026-02-12 05:58:46.000000', 1, 175, 'prov46', 'god i want to nut in you'),
      tipRow('2026-02-01 10:23:58.000000', 1500, 30, 'l1ttlesubbitch', 'the whale tip'),
      tipRow('2026-02-01 10:24:58.000000', 12, 42, 'l1ttlesubbitch', ''),
    ]
    const rows = parseCSV(lines.join('\n'))

    expect(rows.length).toBe(5) // cashout excluded, 5 tips survive
    const totalTokens = rows.reduce((s, r) => s + r.tokens, 0)
    const totalUsd = +rows.reduce((s, r) => s + r.usd, 0).toFixed(2)
    expect(totalTokens).toBe(5 + 1 + 1 + 1500 + 12)
    expect(totalUsd).toBe(+((5 + 1 + 1 + 1500 + 12) * 0.05).toFixed(2))

    const fans = new Set(rows.map(r => r.username))
    expect(fans.size).toBe(3)
    expect(fans.has('tip received')).toBe(false)

    const byUser = {}
    rows.forEach(r => { byUser[r.username] = (byUser[r.username] || 0) + r.tokens })
    const top = Object.entries(byUser).sort((a, b) => b[1] - a[1])[0]
    expect(top[0]).toBe('l1ttlesubbitch')
    expect(top[1]).toBe(1512)
  })

  test('running "Token balance" is never used as usd, even when wildly larger than the tip', () => {
    const csv = [HEADER, tipRow('2026-02-12 06:05:59.000000', 5, 999999, 'fanA')].join('\n')
    const rows = parseCSV(csv)
    expect(rows.length).toBe(1)
    expect(rows[0].tokens).toBe(5)
    expect(rows[0].usd).toBe(0.25)
  })

  test('cashout rows never contribute to tip count or earnings', () => {
    const lines = [
      HEADER,
      cashoutRow('2026-02-14 13:54:51.000000', -181, 0),
      cashoutRow('2026-02-01 14:13:00.000000', -1551, 0),
      tipRow('2026-02-12 06:05:59.000000', 5, 181, 'fanA'),
    ]
    const rows = parseCSV(lines.join('\n'))
    expect(rows.length).toBe(1)
    expect(rows[0].tokens).toBe(5)
  })

  test('quoted headers and quoted note fields with embedded commas parse correctly', () => {
    const csv = [HEADER, tipRow('2026-02-12 06:05:59.000000', 5, 181, 'fanA', 'Portland, Oregon? Me too!')].join('\n')
    const rows = parseCSV(csv)
    expect(rows.length).toBe(1)
    expect(rows[0].username).toBe('fana')
    expect(rows[0].tokens).toBe(5)
    expect(rows[0].tip_note).toBe('Portland, Oregon? Me too!')
  })

  test('fan notes containing common English words do not cause row loss', () => {
    // Regression for a false-positive "looks like a header" heuristic found
    // in the separate onboarding-paste parser; parseCSV() only inspects the
    // very first line for headers, so it should never be at risk of this,
    // but we assert it explicitly since these notes are realistic input.
    const lines = [
      HEADER,
      tipRow('2026-02-12 05:41:12.000000', 10, 54, 'fanA', 'next time ur in vegas'),
      tipRow('2026-02-09 14:30:53.000000', 1, 34, 'fanB', "I'm 24 and from Tennessee"),
      tipRow('2026-02-01 10:17:45.000000', 1, 12, 'fanC', 'feel these tips ;P'),
      tipRow('2026-01-26 07:18:36.000000', 10, 42, 'fanD', 'roleplay in private'),
    ]
    const rows = parseCSV(lines.join('\n'))
    expect(rows.length).toBe(4)
  })
})
