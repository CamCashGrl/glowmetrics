import { describe, it, expect } from 'vitest'
import { computeSessionDuration, computeActualHourlyRate, previewCorrectedSession, formatDurationMinutes } from '../sessionMath'

describe('computeSessionDuration', () => {
  it('subtracts paused time from total elapsed time', () => {
    const startedAt = '2026-07-14T20:00:00Z'
    const endedAt = '2026-07-14T22:30:00Z' // 2h30m total
    const pauseIntervals = [{ start: '2026-07-14T21:00:00Z', end: '2026-07-14T21:16:00Z' }] // 16m pause
    const result = computeSessionDuration(startedAt, endedAt, pauseIntervals)
    expect(result.totalDurationMinutes).toBe(150)
    expect(result.pausedDurationMinutes).toBe(16)
    expect(result.activeDurationMinutes).toBe(134)
  })

  it('treats an open (unresolved) pause as paused up to the boundary', () => {
    const startedAt = '2026-07-14T20:00:00Z'
    const endedAt = '2026-07-14T20:30:00Z'
    const pauseIntervals = [{ start: '2026-07-14T20:10:00Z', end: null }]
    const result = computeSessionDuration(startedAt, endedAt, pauseIntervals)
    expect(result.pausedDurationMinutes).toBe(20)
    expect(result.activeDurationMinutes).toBe(10)
  })

  it('never returns negative active duration', () => {
    const result = computeSessionDuration('2026-07-14T20:00:00Z', '2026-07-14T20:10:00Z', [
      { start: '2026-07-14T19:00:00Z', end: '2026-07-14T21:00:00Z' },
    ])
    expect(result.activeDurationMinutes).toBe(0)
  })
})

describe('computeActualHourlyRate', () => {
  it('computes usd per hour from active minutes', () => {
    expect(computeActualHourlyRate(71.05, 134)).toBeCloseTo(31.81, 2)
  })

  it('returns null instead of dividing by zero/missing duration', () => {
    expect(computeActualHourlyRate(50, 0)).toBeNull()
    expect(computeActualHourlyRate(50, null)).toBeNull()
  })
})

describe('previewCorrectedSession', () => {
  it('recomputes active duration and hourly rate from the proposed correction, not the original', () => {
    const preview = previewCorrectedSession({
      startedAt: '2026-07-14T20:00:00Z',
      endedAt: '2026-07-14T22:30:00Z',
      pauseIntervals: [{ start: '2026-07-14T21:00:00Z', end: '2026-07-14T21:16:00Z' }],
      totalUsd: 63.50,
    })
    expect(formatDurationMinutes(preview.activeDurationMinutes)).toBe('2h 14m')
    expect(preview.actualHourlyRate).toBeCloseTo(28.4, 0)
  })
})

describe('formatDurationMinutes', () => {
  it('formats under an hour without the hour segment', () => {
    expect(formatDurationMinutes(45)).toBe('45m')
  })
  it('formats hours and minutes', () => {
    expect(formatDurationMinutes(150)).toBe('2h 30m')
  })
})
