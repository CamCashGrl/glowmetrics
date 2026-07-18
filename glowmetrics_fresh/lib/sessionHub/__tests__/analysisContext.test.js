import { describe, it, expect } from 'vitest'
import { buildLiveSessionAnalysisContext } from '../analysisContext'

const base = {
  sessionId: 'sess_1',
  platform: 'Chaturbate',
  startedAt: '2026-07-14T20:00:00Z',
  endedAt: '2026-07-14T22:30:00Z',
  timezone: 'America/New_York',
  activeDurationMinutes: 134,
  pausedDurationMinutes: 16,
  totalEarningsUsd: 63.50,
  totalTokens: 1270,
  tipCount: 22,
  uniqueTipperCount: 9,
  coachingEnabled: true,
  promptCounts: { performed: 6, skipped: 2, unmarked: 4 },
  durationConfidence: 'verified',
}

describe('buildLiveSessionAnalysisContext', () => {
  it('stores platform, timing, duration, earnings, and coaching counts', () => {
    const ctx = buildLiveSessionAnalysisContext(base)
    expect(ctx.platform).toBe('Chaturbate')
    expect(ctx.activeDurationMinutes).toBe(134)
    expect(ctx.pausedDurationMinutes).toBe(16)
    expect(ctx.totalEarningsUsd).toBe(63.5)
    expect(ctx.coachingPromptCount).toBe(12)
    expect(ctx.performedPromptCount).toBe(6)
    expect(ctx.skippedPromptCount).toBe(2)
    expect(ctx.unmarkedPromptCount).toBe(4)
    expect(ctx.durationConfidence).toBe('verified')
    expect(ctx.dayOfWeek).toBeGreaterThanOrEqual(0)
    expect(ctx.dayOfWeek).toBeLessThanOrEqual(6)
  })

  it('defaults every future-feature flag to false/null when the beta feature does not exist yet', () => {
    const ctx = buildLiveSessionAnalysisContext(base)
    expect(ctx.goalUsed).toBe(false)
    expect(ctx.streamingPlanWindowId).toBeNull()
    expect(ctx.startedFromStreamingPlan).toBe(false)
    expect(ctx.startedInsideRecommendedWindow).toBe(false)
  })

  it('never accidentally enables a beta feature flag from partial input', () => {
    const ctx = buildLiveSessionAnalysisContext({ ...base, futureFeatureFlags: { goalUsed: undefined } })
    expect(ctx.goalUsed).toBe(false)
  })
})
