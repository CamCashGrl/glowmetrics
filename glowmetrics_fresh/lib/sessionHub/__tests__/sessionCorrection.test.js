import { describe, it, expect } from 'vitest'
import { buildSessionTimeCorrection, resolveDurationConfidence } from '../sessionCorrection'

describe('buildSessionTimeCorrection', () => {
  const original = { id: 'sess_1', startedAt: '2026-07-14T20:00:00Z', endedAt: '2026-07-14T22:00:00Z' }
  const corrected = {
    startedAt: '2026-07-14T20:05:00Z',
    endedAt: '2026-07-14T22:30:00Z',
    pauseIntervals: [{ start: '2026-07-14T21:00:00Z', end: '2026-07-14T21:16:00Z' }],
    platform: 'Chaturbate',
    completed: true,
  }

  it('preserves the original timestamps unchanged inside the correction record', () => {
    const correction = buildSessionTimeCorrection(original, corrected, new Date('2026-07-15T00:00:00Z'))
    expect(correction.originalStartedAt).toBe(original.startedAt)
    expect(correction.originalEndedAt).toBe(original.endedAt)
    expect(correction.correctedStartedAt).toBe(corrected.startedAt)
    expect(correction.correctedEndedAt).toBe(corrected.endedAt)
  })

  it('never mutates the original session object', () => {
    const originalCopy = { ...original }
    buildSessionTimeCorrection(original, corrected)
    expect(original).toEqual(originalCopy)
  })

  it('always marks the correction as user-initiated', () => {
    const correction = buildSessionTimeCorrection(original, corrected)
    expect(correction.correctedByUser).toBe(true)
  })
})

describe('resolveDurationConfidence', () => {
  it('is user_confirmed once a correction exists, regardless of completion', () => {
    expect(resolveDurationConfidence({ hasUserCorrection: true, completed: false })).toBe('user_confirmed')
  })
  it('is verified for a cleanly completed, uncorrected session', () => {
    expect(resolveDurationConfidence({ hasUserCorrection: false, completed: true })).toBe('verified')
  })
  it('is estimated for an active/uncompleted, uncorrected session', () => {
    expect(resolveDurationConfidence({ hasUserCorrection: false, completed: false })).toBe('estimated')
  })
})
