import { describe, it, expect } from 'vitest'
import { buildEarningsSummary, normalizeRecord, filterRecords } from './earningsSummary'

function tip(overrides = {}) {
  return {
    id: 1,
    date_time: '2026-06-15T18:00:00Z',
    platform: 'Chaturbate',
    username: 'fan1',
    tip_type: 'Tip',
    tokens: 100,
    usd: '5.00', // Supabase numeric columns arrive as strings
    upload_id: null,
    tip_ref: null,
    ...overrides,
  }
}

function paidSession(overrides = {}) {
  return {
    id: 1,
    date_time: '2026-06-15T18:00:00Z',
    platform: 'BongaCams',
    username: 'client1',
    session_type: 'Private Chat',
    tokens: 200,
    usd: '5.00',
    upload_id: null,
    session_ref: null,
    ...overrides,
  }
}

describe('buildEarningsSummary — empty data', () => {
  it('returns zeroed totals and no records for an empty dataset', () => {
    const result = buildEarningsSummary({ tipsRows: [], paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.totals.totalGrossUSD).toBe(0)
    expect(result.totals.recordCount).toBe(0)
    expect(result.totals.earliestDate).toBeNull()
    expect(result.totals.latestDate).toBeNull()
    expect(result.records).toEqual([])
    expect(result.monthly).toEqual([])
    expect(result.platforms).toEqual([])
  })
})

describe('buildEarningsSummary — two-source combination (tips + paid_sessions)', () => {
  it('keeps tips and paid-session totals separate and additive, never blended silently', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ usd: '10.00' })],
      paidSessionRows: [paidSession({ usd: '4.00' })],
      requestedTimezone: 'UTC',
    })
    expect(result.totals.tipsAndImportedUSD).toBe(10)
    expect(result.totals.paidSessionUSD).toBe(4)
    expect(result.totals.totalGrossUSD).toBe(14)
    expect(result.totals.hasPaidSessionData).toBe(true)
  })

  it('reports hasPaidSessionData: false when no paid sessions are present', () => {
    const result = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.totals.hasPaidSessionData).toBe(false)
    expect(result.totals.paidSessionUSD).toBe(0)
  })

  it('does not double count when tips and paid_sessions have no matching stable identifiers', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ id: 1, usd: '10.00', username: 'fanA' })],
      paidSessionRows: [paidSession({ id: 1, usd: '10.00', username: 'fanB' })],
      requestedTimezone: 'UTC',
    })
    expect(result.totals.totalGrossUSD).toBe(20)
    expect(result.totals.recordCount).toBe(2)
  })
})

describe('buildEarningsSummary — session-quality exclusion is never applied', () => {
  it('includes a single isolated low-value tip with no surrounding session', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ usd: '0.05', tokens: 1 })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.totals.recordCount).toBe(1)
    expect(result.totals.totalGrossUSD).toBe(0.05)
  })
})

describe('buildEarningsSummary — platform filters', () => {
  it('filters by platform case-insensitively', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ platform: 'chaturbate', usd: '5.00' }), tip({ id: 2, platform: 'BongaCams', usd: '3.00' })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
      platforms: ['Chaturbate'],
    })
    expect(result.totals.recordCount).toBe(1)
    expect(result.totals.totalGrossUSD).toBe(5)
  })

  it('groups case variants of the same platform into one breakdown row', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ platform: 'Chaturbate', usd: '5.00' }), tip({ id: 2, platform: 'chaturbate', usd: '3.00' })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.platforms).toHaveLength(1)
    expect(result.platforms[0].platform).toBe('Chaturbate')
    expect(result.platforms[0].totalUSD).toBe(8)
  })

  it('labels an empty/unknown platform as "Unknown platform" and flags it in data quality', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ platform: 'Unknown', usd: '2.00' })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.platforms[0].platform).toBe('Unknown platform')
    const issue = result.dataQuality.issues.find(i => i.type === 'unknown_platform')
    expect(issue).toBeTruthy()
    expect(issue.message).toContain('2.00')
  })
})

describe('buildEarningsSummary — monthly and platform totals', () => {
  it('buckets by local-tz month and sums correctly across both sources', () => {
    const result = buildEarningsSummary({
      tipsRows: [
        tip({ id: 1, date_time: '2026-01-15T12:00:00Z', usd: '10.00' }),
        tip({ id: 2, date_time: '2026-02-15T12:00:00Z', usd: '20.00' }),
      ],
      paidSessionRows: [paidSession({ id: 1, date_time: '2026-01-20T12:00:00Z', usd: '5.00' })],
      requestedTimezone: 'UTC',
    })
    expect(result.monthly).toEqual([
      { month: '2026-01', tipsUSD: 10, paidSessionUSD: 5, totalUSD: 15, recordCount: 2 },
      { month: '2026-02', tipsUSD: 20, paidSessionUSD: 0, totalUSD: 20, recordCount: 1 },
    ])
  })

  it('computes platform percentage of period correctly', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ platform: 'Chaturbate', usd: '75.00' }), tip({ id: 2, platform: 'BongaCams', usd: '25.00' })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    const cb = result.platforms.find(p => p.platform === 'Chaturbate')
    const bc = result.platforms.find(p => p.platform === 'BongaCams')
    expect(cb.pctOfPeriod).toBe(75)
    expect(bc.pctOfPeriod).toBe(25)
  })
})

describe('buildEarningsSummary — tax-year and timezone boundaries', () => {
  it('places a near-midnight UTC transaction in the correct LOCAL calendar year', () => {
    // 2026-01-01 00:30 UTC is still 2025-12-31 in US/Pacific (UTC-8).
    const result = buildEarningsSummary({
      tipsRows: [tip({ date_time: '2026-01-01T00:30:00Z', usd: '10.00' })],
      paidSessionRows: [],
      requestedTimezone: 'America/Los_Angeles',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    })
    expect(result.totals.recordCount).toBe(1)
    expect(result.totals.totalGrossUSD).toBe(10)
  })

  it('excludes that same transaction from the following year’s local range', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ date_time: '2026-01-01T00:30:00Z', usd: '10.00' })],
      paidSessionRows: [],
      requestedTimezone: 'America/Los_Angeles',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    expect(result.totals.recordCount).toBe(0)
  })

  it('falls back to UTC and flags it when the requested timezone is invalid', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip()],
      paidSessionRows: [],
      requestedTimezone: 'Definitely/Not_A_Zone',
    })
    expect(result.timezone).toBe('UTC')
    expect(result.requestedTimezoneWasInvalid).toBe(true)
    expect(result.dataQuality.issues.some(i => i.type === 'invalid_timezone_fallback')).toBe(true)
  })

  it('does not flag a valid requested timezone as invalid', () => {
    const result = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'America/New_York' })
    expect(result.requestedTimezoneWasInvalid).toBe(false)
    expect(result.dataQuality.issues.some(i => i.type === 'invalid_timezone_fallback')).toBe(false)
  })
})

describe('buildEarningsSummary — token conversion provenance', () => {
  it('treats a stored USD value as authoritative and labels it "Stored USD value"', () => {
    const rec = normalizeRecord(tip({ usd: '5.00', tokens: 100 }), 'tips', 'UTC')
    expect(rec.usd).toBe(5)
    expect(rec.conversionMethod).toBe('Stored USD value')
    expect(rec.usedFallback).toBe(false)
  })

  it('never claims a stored USD value was "Imported" vs "calculated" — provenance is not asserted', () => {
    const rec = normalizeRecord(tip({ usd: '5.00' }), 'tips', 'UTC')
    expect(rec.conversionMethod).not.toMatch(/imported/i)
  })

  it('falls back to token x rate ONLY when USD is missing/zero, and discloses it', () => {
    const rec = normalizeRecord(tip({ usd: '0', tokens: 100, platform: 'Chaturbate' }), 'tips', 'UTC')
    expect(rec.usd).toBe(5) // 100 tokens * 0.05
    expect(rec.usedFallback).toBe(true)
    expect(rec.conversionMethod).toContain('display-time fallback')
    expect(rec.conversionMethod).toContain('not recorded')
  })

  it('uses the correct per-platform rate for the fallback (BongaCams 0.025)', () => {
    const rec = normalizeRecord(paidSession({ usd: '0', tokens: 100, platform: 'BongaCams' }), 'paid_sessions', 'UTC')
    expect(rec.usd).toBe(2.5)
  })

  it('marks a row with neither USD nor tokens as conversion method not recorded', () => {
    const rec = normalizeRecord(tip({ usd: '0', tokens: 0 }), 'tips', 'UTC')
    expect(rec.usd).toBe(0)
    expect(rec.conversionMethod).toBe('Conversion method not recorded')
  })

  it('flags a fallback-conversion row in the data-quality panel', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ usd: '0', tokens: 100 })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    const issue = result.dataQuality.issues.find(i => i.type === 'fallback_conversion_used')
    expect(issue).toBeTruthy()
  })
})

describe('buildEarningsSummary — multiple rates on the same platform', () => {
  it('detects and flags more than one implied token rate on one platform', () => {
    const result = buildEarningsSummary({
      tipsRows: [
        tip({ id: 1, platform: 'Chaturbate', tokens: 100, usd: '5.00' }), // $0.05/token
        tip({ id: 2, platform: 'Chaturbate', tokens: 100, usd: '5.00' }),
        tip({ id: 3, platform: 'Chaturbate', tokens: 100, usd: '10.00' }), // $0.10/token
        tip({ id: 4, platform: 'Chaturbate', tokens: 100, usd: '10.00' }),
      ],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    const cb = result.platforms.find(p => p.platform === 'Chaturbate')
    expect(cb.multipleRatesObserved).toBe(true)
    expect(cb.ratesObservedInPeriod).toEqual([0.05, 0.1])
    expect(result.dataQuality.issues.some(i => i.type === 'multiple_rates_used')).toBe(true)
  })

  it('does not flag a single noisy 1-row implied rate as "multiple rates"', () => {
    const result = buildEarningsSummary({
      tipsRows: [
        tip({ id: 1, platform: 'Chaturbate', tokens: 100, usd: '5.00' }),
        tip({ id: 2, platform: 'Chaturbate', tokens: 100, usd: '5.00' }),
        tip({ id: 3, platform: 'Chaturbate', tokens: 3, usd: '0.17' }), // odd one-off rounding, appears once
      ],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    const cb = result.platforms.find(p => p.platform === 'Chaturbate')
    expect(cb.multipleRatesObserved).toBe(false)
  })
})

describe('buildEarningsSummary — missing fee/payout data is never fabricated as $0', () => {
  it('reports data-availability flags as false rather than showing zeroed fee/payout cards', () => {
    const result = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.dataAvailability).toEqual({
      platformFeesRecorded: false,
      processingFeesRecorded: false,
      refundsAndChargebacksRecorded: false,
      confirmedPayoutsRecorded: false,
    })
  })
})

describe('buildEarningsSummary — duplicate-looking records', () => {
  it('flags same user/tokens/usd within the same minute without removing either record', () => {
    const result = buildEarningsSummary({
      tipsRows: [
        tip({ id: 1, username: 'fan1', tokens: 100, usd: '5.00', date_time: '2026-06-15T18:00:10Z' }),
        tip({ id: 2, username: 'fan1', tokens: 100, usd: '5.00', date_time: '2026-06-15T18:00:40Z' }),
      ],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.totals.recordCount).toBe(2) // both retained
    expect(result.totals.totalGrossUSD).toBe(10) // both counted
    expect(result.dataQuality.issues.some(i => i.type === 'duplicate_looking_records')).toBe(true)
  })

  it('surfaces a possible cross-source duplicate between tips and paid_sessions rather than merging them', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ id: 1, username: 'sameuser', tokens: 50, usd: '2.50', date_time: '2026-06-15T18:00:00Z' })],
      paidSessionRows: [paidSession({ id: 1, username: 'sameuser', tokens: 50, usd: '2.50', date_time: '2026-06-15T18:02:00Z' })],
      requestedTimezone: 'UTC',
    })
    expect(result.totals.recordCount).toBe(2)
    expect(result.totals.totalGrossUSD).toBe(5) // both still counted — no silent merge
    expect(result.dataQuality.issues.some(i => i.type === 'possible_cross_source_duplicate')).toBe(true)
  })
})

describe('buildEarningsSummary — decimal rounding', () => {
  it('sums many small amounts without floating-point drift', () => {
    const rows = Array.from({ length: 100 }, (_, i) => tip({ id: i, usd: '0.10' }))
    const result = buildEarningsSummary({ tipsRows: rows, paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.totals.totalGrossUSD).toBe(10) // not 9.999999999999998
  })
})

describe('buildEarningsSummary — large dataset', () => {
  it('handles several thousand rows without error and produces consistent totals', () => {
    const rows = Array.from({ length: 5000 }, (_, i) =>
      tip({ id: i, usd: '1.23', date_time: `2026-0${(i % 9) + 1}-10T12:00:00Z`, platform: i % 2 === 0 ? 'Chaturbate' : 'BongaCams' })
    )
    const result = buildEarningsSummary({ tipsRows: rows, paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.totals.recordCount).toBe(5000)
    expect(result.totals.totalGrossUSD).toBeCloseTo(5000 * 1.23, 2)
  })
})

describe('buildEarningsSummary — per-record warning tagging', () => {
  it('tags a fallback-conversion record with a matching warning label', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ usd: '0', tokens: 100 })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.records[0].warnings).toContain('Token conversion used (USD not recorded)')
  })

  it('tags an unknown-platform record', () => {
    const result = buildEarningsSummary({
      tipsRows: [tip({ platform: '' })],
      paidSessionRows: [],
      requestedTimezone: 'UTC',
    })
    expect(result.records[0].warnings).toContain('Unknown platform')
  })

  it('leaves a clean record with no warnings', () => {
    const result = buildEarningsSummary({ tipsRows: [tip({ usd: '5.00' })], paidSessionRows: [], requestedTimezone: 'UTC' })
    expect(result.records[0].warnings).toEqual([])
  })
})

describe('filterRecords', () => {
  it('is inclusive of both boundary dates', () => {
    const records = [
      normalizeRecord(tip({ id: 1, date_time: '2026-01-01T12:00:00Z' }), 'tips', 'UTC'),
      normalizeRecord(tip({ id: 2, date_time: '2026-12-31T12:00:00Z' }), 'tips', 'UTC'),
      normalizeRecord(tip({ id: 3, date_time: '2027-01-01T12:00:00Z' }), 'tips', 'UTC'),
    ]
    const filtered = filterRecords(records, { startDate: '2026-01-01', endDate: '2026-12-31' })
    expect(filtered).toHaveLength(2)
  })
})
