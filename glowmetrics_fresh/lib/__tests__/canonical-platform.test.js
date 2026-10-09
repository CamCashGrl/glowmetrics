/**
 * Platform aliases: 519 production tips are stored as 'BC'. They must count
 * as BongaCams everywhere (rate, name, color, totals), never as a separate
 * platform and never at the 0.05 default rate.
 */
import { canonicalPlatform, tokenRate, platformDisplayName, platformColor, viewerRate } from '../constants'
import { aggregateRows } from '../analytics'

test('short codes and casing resolve to the canonical name', () => {
  expect(canonicalPlatform('BC')).toBe('BongaCams')
  expect(canonicalPlatform(' bc ')).toBe('BongaCams')
  expect(canonicalPlatform('bongacams')).toBe('BongaCams')
  expect(canonicalPlatform('CB')).toBe('Chaturbate')
  expect(canonicalPlatform('MFC')).toBe('MyFreeCams')
  expect(canonicalPlatform('Unknown')).toBe('Unknown')
  expect(canonicalPlatform(null)).toBeNull()
})

test("'BC' uses the BongaCams token rate, not the 0.05 default", () => {
  expect(tokenRate('BC')).toBe(0.025)
  expect(tokenRate('BongaCams')).toBe(0.025)
  expect(tokenRate('CB')).toBe(0.05)
  expect(viewerRate('BC')).toBe(viewerRate('BongaCams'))
})

test("'BC' displays and colors as BongaCams", () => {
  expect(platformDisplayName('BC')).toBe('BongaCams')
  expect(platformColor('BC')).toBe(platformColor('BongaCams'))
})

test('canonicalized rows give one BongaCams platform total', () => {
  const rows = [
    { date_time: '2026-01-05T10:00:00Z', platform: 'BC', username: 'a', usd: 7.16, tokens: 300, tip_type: 'FreeChat' },
    { date_time: '2026-01-05T10:40:00Z', platform: 'BongaCams', username: 'b', usd: 2.5, tokens: 100, tip_type: 'Tip' },
  ].map((r) => ({ ...r, platform: canonicalPlatform(r.platform) }))
  const a = aggregateRows(rows, 'UTC')
  expect(a.platforms.map((p) => p.platform)).toEqual(['BongaCams'])
  expect(a.platforms[0].totalUSD).toBeCloseTo(9.66, 2)
  expect(a.totalUSD).toBeCloseTo(9.66, 2)
})
