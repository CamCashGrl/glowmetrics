import { describe, it, expect } from 'vitest'
import { setCoachingActionStatus, clearCoachingActionResponse } from '../coachingActions'
import { buildCoachingEventFields } from '../coachingCategory'

describe('coaching prompts default to unmarked', () => {
  it('a freshly built coaching event field set carries no action status opinion', () => {
    const fields = buildCoachingEventFields({ key: 'dead_air_critical', priority: 1, text: 'No tips in 8 minutes' })
    // actionStatus is set by the caller/table default, never inferred from content
    expect(fields).not.toHaveProperty('actionStatus')
  })
})

describe('Performed/Skip remain optional and can be changed later', () => {
  it('leaves a prompt unmarked until the user responds', () => {
    const now = new Date('2026-07-14T21:00:00Z')
    const untouched = setCoachingActionStatus('unmarked', now)
    expect(untouched.actionStatus).toBe('unmarked')
    expect(untouched.actionRespondedAt).toBeNull()
  })

  it('marking Performed sets a responded timestamp', () => {
    const now = new Date('2026-07-14T21:05:00Z')
    const performed = setCoachingActionStatus('performed', now)
    expect(performed.actionStatus).toBe('performed')
    expect(performed.actionRespondedAt).toBe(now.toISOString())
  })

  it('a response can be changed later (performed -> skipped)', () => {
    const first = setCoachingActionStatus('performed', new Date('2026-07-14T21:05:00Z'))
    const second = setCoachingActionStatus('skipped', new Date('2026-07-14T21:10:00Z'))
    expect(first.actionStatus).toBe('performed')
    expect(second.actionStatus).toBe('skipped')
    expect(second.actionRespondedAt).not.toBe(first.actionRespondedAt)
  })
})

describe('no response must not be counted as skipped', () => {
  it('unmarked is a distinct state from skipped', () => {
    const unmarked = setCoachingActionStatus('unmarked')
    expect(unmarked.actionStatus).not.toBe('skipped')
  })
})

describe('clearing coaching response data (privacy control)', () => {
  it('resets status to unmarked without deleting the event', () => {
    const cleared = clearCoachingActionResponse(new Date('2026-07-14T22:00:00Z'))
    expect(cleared.actionStatus).toBe('unmarked')
    expect(cleared.actionRespondedAt).toBeNull()
  })
})
