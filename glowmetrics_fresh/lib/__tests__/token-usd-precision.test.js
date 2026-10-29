/**
 * Canonical per-tip USD (tokensToUsd) and aggregation, against the approved
 * CamCash money rule: each tip keeps its exact USD at 4 decimals (1
 * BongaCams token = 0.0250), totals are summed from exact values, and only a
 * displayed total is rounded to cents. Regression for per-tip cent rounding,
 * which stored 1 BongaCams token as 0.03 and inflated totals.
 */
import { tokensToUsd, tokenRate, USD_STORAGE_DECIMALS } from '../constants'

// Sums in 1/10000 dollars so the test never depends on float addition order.
const sumUsd = (values) => values.reduce((acc, v) => acc + Math.round(v * 10000), 0) / 10000

describe('tokensToUsd — exact per-tip USD from the canonical rate', () => {
  test('storage precision is 4 decimals (matches tips.usd / live_tips.usd numeric(12,4))', () => {
    expect(USD_STORAGE_DECIMALS).toBe(4)
  })

  test('Chaturbate: 100 tokens = 5.0000', () => {
    expect(tokensToUsd(100, 'Chaturbate')).toBe(5)
  })

  test('MyFreeCams: 100 tokens = 5.0000', () => {
    expect(tokensToUsd(100, 'MyFreeCams')).toBe(5)
  })

  test.each([
    [1, 0.025],
    [2, 0.05],
    [3, 0.075],
  ])('BongaCams: %i token(s) = %f, never rounded to cents', (tokens, usd) => {
    expect(tokensToUsd(tokens, 'BongaCams')).toBe(usd)
  })

  test('1 BongaCams token is 0.025, not the old per-tip rounded 0.03', () => {
    expect(tokensToUsd(1, 'BongaCams')).not.toBe(0.03)
    expect(tokensToUsd(1, 'BongaCams').toFixed(4)).toBe('0.0250')
  })

  test.each(['BongaCams', 'bongacams', 'BONGACAMS', 'BC', 'bc', ' BongaCams '])(
    'platform casing/alias %p resolves to the BongaCams rate',
    (platform) => {
      expect(tokensToUsd(1, platform)).toBe(0.025)
    }
  )

  test('uses the canonical rate table instead of its own formula', () => {
    for (const platform of ['Chaturbate', 'BongaCams', 'MyFreeCams']) {
      for (const tokens of [1, 7, 33, 999, 12345]) {
        expect(tokensToUsd(tokens, platform)).toBeCloseTo(tokens * tokenRate(platform), 10)
      }
    }
  })

  test('no float noise: every BongaCams amount 1..10000 has at most 4 decimals', () => {
    for (let tokens = 1; tokens <= 10000; tokens++) {
      const usd = tokensToUsd(tokens, 'BongaCams')
      expect(Math.round(usd * 10000) / 10000).toBe(usd)
    }
  })
})

describe('aggregating exact per-tip USD', () => {
  const singles = Array.from({ length: 40 }, () => tokensToUsd(1, 'BongaCams'))
  const ramp = Array.from({ length: 40 }, (_, i) => tokensToUsd(i + 1, 'BongaCams'))

  test('40 x 1-token BongaCams tips = 1.0000 (old per-tip rounding gave 1.20)', () => {
    expect(sumUsd(singles)).toBe(1)
    expect(sumUsd(singles.map((v) => Math.round(v * 100) / 100))).toBe(1.2)
  })

  test('BongaCams token amounts 1..40 (820 tokens) = 20.5000', () => {
    expect(sumUsd(ramp)).toBe(20.5)
  })

  test('both together = 21.5000 internally, 21.50 when displayed', () => {
    const total = sumUsd([...singles, ...ramp])
    expect(total).toBe(21.5)
    expect(total.toFixed(2)).toBe('21.50')
  })

  test('adding one valid tip raises the total by exactly its converted value', () => {
    const before = sumUsd(ramp)
    const after = sumUsd([...ramp, tokensToUsd(3, 'BongaCams')])
    expect(Math.round((after - before) * 10000)).toBe(750)
  })

  test('cross-platform total equals the sum of per-platform totals', () => {
    const cb = [tokensToUsd(100, 'Chaturbate'), tokensToUsd(1, 'Chaturbate')]
    const mfc = [tokensToUsd(100, 'MyFreeCams')]
    const bc = [...singles, ...ramp]
    expect(sumUsd([...cb, ...mfc, ...bc])).toBe(sumUsd([sumUsd(cb), sumUsd(mfc), sumUsd(bc)]))
  })
})
