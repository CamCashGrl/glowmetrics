import { describe, it, expect } from 'vitest'
import { resolveTimezone, isValidTimezone, FALLBACK_TIMEZONE } from './timezone'

describe('resolveTimezone', () => {
  it('accepts a real IANA timezone', () => {
    expect(resolveTimezone('America/New_York')).toBe('America/New_York')
    expect(resolveTimezone('Europe/London')).toBe('Europe/London')
  })

  it('falls back to UTC for an invalid timezone string', () => {
    expect(resolveTimezone('Not/A_Zone')).toBe(FALLBACK_TIMEZONE)
    expect(resolveTimezone('banana')).toBe(FALLBACK_TIMEZONE)
  })

  it('falls back to UTC for missing/empty/non-string input', () => {
    expect(resolveTimezone(null)).toBe(FALLBACK_TIMEZONE)
    expect(resolveTimezone(undefined)).toBe(FALLBACK_TIMEZONE)
    expect(resolveTimezone('')).toBe(FALLBACK_TIMEZONE)
    expect(resolveTimezone(123)).toBe(FALLBACK_TIMEZONE)
  })
})

describe('isValidTimezone', () => {
  it('reports validity correctly', () => {
    expect(isValidTimezone('America/Chicago')).toBe(true)
    expect(isValidTimezone('nonsense-zone')).toBe(false)
  })
})
