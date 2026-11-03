/**
 * Regression tests for two production data-corruption mechanisms in the
 * onboarding paste parser (parseRows, headerless fallback). Tracked in the
 * critical data-corruption issue.
 *
 *  1. A running token BALANCE was saved as the tip's USD. In a headerless
 *     `date, user, tokens, balance` row, the loop took "the next positive
 *     number" as the payout, so `tokens=1, usd=7886` was stored. A tip amount
 *     must come from a labeled/money-formatted value or tokens x rate, never
 *     from a bare integer in an unlabeled column.
 *  2. tryParseDate() fell back to new Date(s) for ANY string, so bare numbers
 *     and year-less strings became dates in year 2000/2001 or year 1-999.
 *     A row with no full date must be skipped, not stored with an invented one.
 *
 * Row shapes are taken from the production rows. These tests exercise the real
 * exported parseRows(), not a re-implementation.
 */
jest.mock('../../../lib/supabase', () => ({ supabase: {} }))

import { parseRows } from '../page.js'

const tsv = (...cells) => cells.join('\t')

describe('headerless paste: a running balance is never a tip amount', () => {
  test('Chaturbate-style row [date, user, tokens, balance]: usd = tokens x rate, not the balance', () => {
    // Observed in production: tokens=1 / usd=7886.00
    const { rows } = parseRows(tsv('2026-08-02 08:54:54', 'fan_a', '1', '7886'), 'chaturbate')
    expect(rows).toHaveLength(1)
    expect(rows[0].tokens).toBe(1)
    expect(rows[0].usd).toBe(0.05)
  })

  test('the observed run of rows (balance climbing 7875 -> 7886) totals tokens x rate', () => {
    const text = [
      tsv('2026-08-02 08:48:36', 'fan_a', '3', '7875'),
      tsv('2026-08-02 08:48:46', 'fan_b', '3', '7878'),
      tsv('2026-08-02 08:48:56', 'fan_c', '3', '7881'),
      tsv('2026-08-02 08:49:06', 'fan_d', '3', '7884'),
      tsv('2026-08-02 08:51:49', 'fan_e', '1', '7885'),
      tsv('2026-08-02 08:54:54', 'fan_f', '1', '7886'),
    ].join('\n')
    const { rows } = parseRows(text, 'chaturbate')
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.tokens)).toEqual([3, 3, 3, 3, 1, 1])
    expect(rows.reduce((s, r) => s + r.usd, 0)).toBeCloseTo(14 * 0.05, 10)
    expect(Math.max(...rows.map((r) => r.usd))).toBeLessThan(1)
  })

  test('a balance with a thousands separator is not money either', () => {
    const { rows } = parseRows(tsv('2026-08-02 08:54:54', 'fan_a', '5', '17,276'), 'chaturbate')
    expect(rows[0].usd).toBe(0.25)
  })

  test('a balance followed by a note keeps the note and the correct usd', () => {
    const { rows } = parseRows(tsv('2026-08-02 08:48:56', 'fan_b', '3', '7881', 'thanks'), 'chaturbate')
    expect(rows[0].tokens).toBe(3)
    expect(rows[0].usd).toBe(0.15)
  })
})

describe('headerless paste: explicitly supported payout formats still work', () => {
  // From scripts/verify-bongacams-whole-dollar-payout.mjs and importStep.test.jsx
  test('whole-dollar payout "9.00" (no $) is preserved as the real usd', () => {
    const { rows } = parseRows(tsv('18.07.2026 14:00', 'crossplatformfan', '450', '9.00'), 'bongacams')
    expect(rows[0]).toMatchObject({ tokens: 450, usd: 9 })
  })

  test('"$20.00" payout is preserved', () => {
    const { rows } = parseRows(tsv('18.07.2026 14:00', 'dollarfan', '450', '$20.00'), 'bongacams')
    expect(rows[0]).toMatchObject({ tokens: 450, usd: 20 })
  })

  test('fractional payout "9.50" is preserved', () => {
    const { rows } = parseRows(tsv('18.07.2026 14:00', 'controlfan', '450', '9.50'), 'bongacams')
    expect(rows[0]).toMatchObject({ tokens: 450, usd: 9.5 })
  })

  test('no payout column falls back to tokens x rate (450 x 0.025)', () => {
    const { rows } = parseRows(tsv('18.07.2026 14:00', 'noUsdFan', '450'), 'bongacams')
    expect(rows[0]).toMatchObject({ tokens: 450, usd: 11.25 })
  })

  test('real BongaCams tab rows keep their exact payouts', () => {
    const { rows } = parseRows(tsv('08.06.2023 11:56', 'tonytony1975', '63', '2.29'), 'bongacams')
    expect(rows[0]).toMatchObject({ tokens: 63, usd: 2.29 })
  })
})

describe('headerless paste: a row without a full date is skipped, never given an invented one', () => {
  test.each([
    ['a bare number in the date column', tsv('7', 'fan_a', '5')],
    ['a bare 5-digit number (a balance) in the date column', tsv('17298', 'fan_a', '5')],
    ['a month and day with no year ("Apr 1")', tsv('Apr 1', 'fan_a', '5')],
    ['a split date: "Apr 1" then the year as its own cell', tsv('Apr 1', '2026', 'fan_a', '5')],
    ['a bare year as the only date-like cell', tsv('2026', 'fan_a', '5')],
    ['a 3-digit number', tsv('393', 'fan_a', '5')],
  ])('%s', (_label, line) => {
    const { rows, skipped } = parseRows(line, 'chaturbate')
    expect(rows).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  test('a year-like cell is never read as the token count of a skipped row', () => {
    const { rows } = parseRows(tsv('Jun 1', '2026', 'fan_a', '12'), 'chaturbate')
    expect(rows.some((r) => r.tokens === 2026)).toBe(false)
  })
})

describe('headerless paste: valid full dates are still accepted', () => {
  test.each([
    ['ISO date-time', '2026-08-02 08:54:54', 2026, 7, 2],
    ['ISO date-time with fractional seconds', '2026-02-12 06:05:59.000000', 2026, 1, 12],
    ['BongaCams dd.mm.yyyy hh:mm', '18.06.2026 14:32', 2026, 5, 18],
  ])('%s', (_label, cell, y, m, d) => {
    const { rows } = parseRows(tsv(cell, 'fan_a', '5'), 'chaturbate')
    expect(rows).toHaveLength(1)
    const ts = rows[0].ts
    expect([ts.getFullYear(), ts.getMonth(), ts.getDate()]).toEqual([y, m, d])
  })

  test('every accepted date lies in the real export range (no 2000/2001/0001 years)', () => {
    const text = [
      tsv('2026-08-02 08:48:36', 'fan_a', '3', '7875'),
      tsv('2026-08-03 09:00:00', 'fan_b', '4'),
    ].join('\n')
    const { rows } = parseRows(text, 'chaturbate')
    expect(rows.every((r) => r.ts.getFullYear() === 2026)).toBe(true)
  })
})
