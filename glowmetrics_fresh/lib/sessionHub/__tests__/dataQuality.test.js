import { describe, it, expect } from 'vitest'
import { computeSessionDataQuality, MIN_ELIGIBLE_ACTIVE_MINUTES } from '../dataQuality'

const baseDuration = { activeDurationMinutes: 60, completed: true, hasEstimatedEnd: false }

describe('computeSessionDataQuality', () => {
  it('is eligible for future impact analysis when everything checks out', () => {
    const quality = computeSessionDataQuality({
      duration: baseDuration,
      hasUserCorrection: false,
      containsPauseIntervals: false,
    })
    expect(quality.eligibleForFutureImpactAnalysis).toBe(true)
    expect(quality.ineligibilityReasons).toEqual([])
  })

  it('flags missing duration as ineligible', () => {
    const quality = computeSessionDataQuality({
      duration: { activeDurationMinutes: null, completed: true, hasEstimatedEnd: false },
      hasUserCorrection: false,
      containsPauseIntervals: false,
    })
    expect(quality.eligibleForFutureImpactAnalysis).toBe(false)
    expect(quality.ineligibilityReasons).toContain('duration_missing')
  })

  it('flags an extremely short session as ineligible', () => {
    const quality = computeSessionDataQuality({
      duration: { activeDurationMinutes: MIN_ELIGIBLE_ACTIVE_MINUTES - 1, completed: true, hasEstimatedEnd: false },
      hasUserCorrection: false,
      containsPauseIntervals: false,
    })
    expect(quality.eligibleForFutureImpactAnalysis).toBe(false)
    expect(quality.ineligibilityReasons).toContain('session_too_short')
  })

  it('flags a session that was not actually completed', () => {
    const quality = computeSessionDataQuality({
      duration: { activeDurationMinutes: 60, completed: false, hasEstimatedEnd: true },
      hasUserCorrection: false,
      containsPauseIntervals: false,
    })
    expect(quality.eligibleForFutureImpactAnalysis).toBe(false)
    expect(quality.ineligibilityReasons).toContain('session_not_completed')
  })

  it('flags unresolved duplicate tips and incomplete coaching data', () => {
    const quality = computeSessionDataQuality({
      duration: baseDuration,
      hasUserCorrection: false,
      containsPauseIntervals: false,
      duplicateTipCount: 2,
      coachingDataComplete: false,
      outcomeWindowsComplete: false,
    })
    expect(quality.ineligibilityReasons).toEqual(
      expect.arrayContaining(['unresolved_duplicate_tips', 'coaching_timestamps_incomplete', 'outcome_windows_incomplete'])
    )
  })

  it('records hasUserCorrection without affecting other flags', () => {
    const quality = computeSessionDataQuality({
      duration: baseDuration,
      hasUserCorrection: true,
      containsPauseIntervals: true,
    })
    expect(quality.hasUserCorrection).toBe(true)
    expect(quality.containsPauseIntervals).toBe(true)
    expect(quality.eligibleForFutureImpactAnalysis).toBe(true)
  })

  it('never exposes a "hidden" or "deleted" flag — ineligible sessions stay visible', () => {
    const quality = computeSessionDataQuality({
      duration: { activeDurationMinutes: null, completed: false, hasEstimatedEnd: true },
      hasUserCorrection: false,
      containsPauseIntervals: false,
    })
    expect(quality).not.toHaveProperty('hidden')
    expect(quality).not.toHaveProperty('deleted')
    expect(quality).not.toHaveProperty('visible')
  })
})
