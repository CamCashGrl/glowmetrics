/**
 * Test suite for Revenue Velocity baseline requirements
 * Ensures minimum session count and early-session guards work correctly
 */

import { computeRevenueVelocity } from '../velocity'

describe('computeRevenueVelocity() baseline requirements', () => {

  // Helper to create a valid session
  const validSession = (totalUSD = 50, durationMinutes = 30) => ({
    totalUSD,
    durationMinutes,
    durationUnknown: false,
  })

  const invalidSession = {
    totalUSD: 0,
    durationMinutes: 30,
    durationUnknown: false,
  }

  const unknownDurationSession = {
    totalUSD: 50,
    durationMinutes: 0,
    durationUnknown: true,
  }

  const tooShortSession = {
    totalUSD: 50,
    durationMinutes: 10,
    durationUnknown: false,
  }

  test('0 qualifying sessions → insufficient_history', () => {
    const result = computeRevenueVelocity(2.0, [])
    expect(result.status).toBe('insufficient_history')
    expect(result.label).toBe('Not enough history yet')
    expect(result.pctVsAvg).toBeNull()
    expect(result.sampleSize).toBe(0)
    expect(result.minSampleSize).toBe(3)
  })

  test('1 qualifying session → insufficient_history', () => {
    const result = computeRevenueVelocity(2.0, [validSession()])
    expect(result.status).toBe('insufficient_history')
    expect(result.label).toBe('Not enough history yet')
    expect(result.sampleSize).toBe(1)
    expect(result.minSampleSize).toBe(3)
  })

  test('2 qualifying sessions → insufficient_history', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
    ])
    expect(result.status).toBe('insufficient_history')
    expect(result.label).toBe('Not enough history yet')
    expect(result.sampleSize).toBe(2)
    expect(result.minSampleSize).toBe(3)
  })

  test('3 qualifying sessions → valid comparison', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),  // 1.67 USD/min
      validSession(60, 40),  // 1.5 USD/min
      validSession(70, 35),  // 2.0 USD/min
    ])
    expect(result.status).toBeUndefined() // valid result has no status field
    expect(result.label).not.toBe('Not enough history yet')
    expect(result.pctVsAvg).not.toBeNull()
    expect(result.avgUPM).toBeGreaterThan(0)
  })

  test('session with durationUnknown=true is excluded from baseline', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      unknownDurationSession,
    ])
    // Only 2 valid sessions, should be insufficient
    expect(result.status).toBe('insufficient_history')
    expect(result.sampleSize).toBe(2)
  })

  test('session with durationMinutes < 15 is excluded from baseline', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      tooShortSession,
    ])
    // Only 2 valid sessions, should be insufficient
    expect(result.status).toBe('insufficient_history')
    expect(result.sampleSize).toBe(2)
  })

  test('session with totalUSD = 0 is excluded from baseline', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      invalidSession,
    ])
    // Only 2 valid sessions, should be insufficient
    expect(result.status).toBe('insufficient_history')
    expect(result.sampleSize).toBe(2)
  })

  test('currentUPH conversion: multiply by 60 exactly once', () => {
    const result = computeRevenueVelocity(3.5, [
      validSession(50, 30),
      validSession(60, 40),
      validSession(70, 35),
    ])
    // If currentUPM = 3.5, currentUPH should = 3.5 * 60 = 210
    expect(result.currentUPM).toBe(3.5)
    expect(result.currentUPH).toBe(210)
  })

  test('early-session guard: < 5 minutes → warming_up', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      validSession(70, 35),
    ], 3)
    expect(result.status).toBe('warming_up')
    expect(result.label).toBe('Still warming up...')
    expect(result.pctVsAvg).toBeNull()
  })

  test('early-session guard: 5+ minutes → normal comparison', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      validSession(70, 35),
    ], 5)
    expect(result.status).toBeUndefined() // valid, no status
    expect(result.pctVsAvg).not.toBeNull()
  })

  test('no elapsedMinutes parameter → skips early-session check', () => {
    const result = computeRevenueVelocity(2.0, [
      validSession(50, 30),
      validSession(60, 40),
      validSession(70, 35),
    ]) // no elapsedMinutes passed
    expect(result.status).toBeUndefined() // valid, proceeds normally
    expect(result.pctVsAvg).not.toBeNull()
  })

  test('zero currentUPM → insufficient_history (no comparison)', () => {
    const result = computeRevenueVelocity(0, [
      validSession(50, 30),
      validSession(60, 40),
      validSession(70, 35),
    ])
    expect(result.status).toBe('insufficient_history')
    expect(result.pctVsAvg).toBeNull()
  })
})
