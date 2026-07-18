import { describe, it, expect } from 'vitest'
import { computeCoachingSummary } from '../coachingSummary'

const events = (statuses) => statuses.map((actionStatus, i) => ({ category: 'pace_management', actionStatus, i }))

describe('computeCoachingSummary', () => {
  it('matches the spec worked example (12 shown, 6 performed, 2 skipped, 4 unmarked)', () => {
    const summary = computeCoachingSummary(events([
      ...Array(6).fill('performed'),
      ...Array(2).fill('skipped'),
      ...Array(4).fill('unmarked'),
    ]))
    expect(summary.promptsShown).toBe(12)
    expect(summary.performedPromptCount).toBe(6)
    expect(summary.skippedPromptCount).toBe(2)
    expect(summary.unmarkedPromptCount).toBe(4)
    expect(summary.markedPromptCount).toBe(8)
    expect(summary.followThroughRate).toBeCloseTo(0.75, 5)
  })

  it('excludes unmarked prompts from the follow-through denominator entirely', () => {
    const summary = computeCoachingSummary(events(['unmarked', 'unmarked', 'unmarked']))
    expect(summary.markedPromptCount).toBe(0)
    expect(summary.followThroughRate).toBeNull()
  })

  it('never treats unmarked as skipped', () => {
    const summary = computeCoachingSummary(events(['unmarked', 'performed']))
    expect(summary.skippedPromptCount).toBe(0)
    expect(summary.unmarkedPromptCount).toBe(1)
  })

  it('lists distinct categories shown', () => {
    const summary = computeCoachingSummary([
      { category: 'pace_management', actionStatus: 'performed' },
      { category: 'goal_momentum', actionStatus: 'unmarked' },
      { category: 'pace_management', actionStatus: 'skipped' },
    ])
    expect(summary.categories).toEqual(['goal_momentum', 'pace_management'])
  })
})
