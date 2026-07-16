import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  validateCollabPostInput,
  validateInterestInput,
  validateMessageInput,
  validateReportInput,
} from '../validation'

const validPost = {
  title: 'Looking for a duo stream partner',
  description: 'Want to do a fun duo stream this weekend, open to niches.',
  collabType: 'duo_stream',
  platforms: ['chaturbate', 'stripchat'],
  participationMode: 'online',
  dateIsFlexible: true,
  experiencePreference: 'any',
  acknowledgedNoVerification: true,
}

describe('sanitizeText', () => {
  it('strips control characters but keeps normal whitespace', () => {
    const withNull = 'hello' + String.fromCharCode(0) + 'world'
    expect(sanitizeText(withNull)).toBe('helloworld')
    expect(sanitizeText('  padded  ')).toBe('padded')
    expect(sanitizeText('line1\nline2')).toBe('line1\nline2')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
    expect(sanitizeText(42)).toBe('')
  })
})

describe('validateCollabPostInput', () => {
  it('accepts a well-formed post', () => {
    const result = validateCollabPostInput(validPost)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.data.collab_type).toBe('duo_stream')
    expect(result.data.platforms).toEqual(['chaturbate', 'stripchat'])
  })

  it('rejects a missing title', () => {
    const result = validateCollabPostInput({ ...validPost, title: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it('rejects a title that is too long', () => {
    const result = validateCollabPostInput({ ...validPost, title: 'x'.repeat(200) })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it('rejects an invalid collab type (not in allowlist)', () => {
    const result = validateCollabPostInput({ ...validPost, collabType: 'not_a_real_type' })
    expect(result.valid).toBe(false)
    expect(result.errors.collabType).toBeTruthy()
  })

  it('rejects an empty platforms list', () => {
    const result = validateCollabPostInput({ ...validPost, platforms: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.platforms).toBeTruthy()
  })

  it('rejects a platform outside the allowlist (defense in depth vs the DB CHECK constraint)', () => {
    const result = validateCollabPostInput({ ...validPost, platforms: ['definitely-not-a-platform'] })
    expect(result.valid).toBe(false)
    expect(result.errors.platforms).toBeTruthy()
  })

  it('requires the no-verification acknowledgement checkbox', () => {
    const result = validateCollabPostInput({ ...validPost, acknowledgedNoVerification: false })
    expect(result.valid).toBe(false)
    expect(result.errors.acknowledgedNoVerification).toBeTruthy()
  })

  it('rejects an age requirement under 18', () => {
    const result = validateCollabPostInput({ ...validPost, ageRequirement: 16 })
    expect(result.valid).toBe(false)
    expect(result.errors.ageRequirement).toBeTruthy()
  })

  it('accepts an age requirement of exactly 18', () => {
    const result = validateCollabPostInput({ ...validPost, ageRequirement: 18 })
    expect(result.valid).toBe(true)
    expect(result.data.age_requirement).toBe(18)
  })

  it('caps tags at the configured maximum', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`)
    const result = validateCollabPostInput({ ...validPost, tags })
    expect(result.valid).toBe(false)
    expect(result.errors.tags).toBeTruthy()
  })

  it('dedupes tags', () => {
    const result = validateCollabPostInput({ ...validPost, tags: ['fun', 'fun', 'Fun'] })
    expect(result.data.tags.length).toBeLessThanOrEqual(3)
  })
})

describe('validateInterestInput', () => {
  it('allows an empty introduction message', () => {
    const result = validateInterestInput({})
    expect(result.valid).toBe(true)
    expect(result.data.introduction_message).toBeNull()
  })

  it('rejects an introduction message over the limit', () => {
    const result = validateInterestInput({ introductionMessage: 'x'.repeat(2000) })
    expect(result.valid).toBe(false)
    expect(result.errors.introductionMessage).toBeTruthy()
  })
})

describe('validateMessageInput', () => {
  it('rejects an empty message', () => {
    const result = validateMessageInput({ message: '   ' })
    expect(result.valid).toBe(false)
  })

  it('accepts a normal message', () => {
    const result = validateMessageInput({ message: 'Hey, still interested in collabing?' })
    expect(result.valid).toBe(true)
  })

  it('rejects a message over the length limit', () => {
    const result = validateMessageInput({ message: 'x'.repeat(3000) })
    expect(result.valid).toBe(false)
  })
})

describe('validateReportInput', () => {
  it('requires a valid reason', () => {
    const result = validateReportInput({ reason: 'not_a_reason', collabPostId: 'post-1' })
    expect(result.valid).toBe(false)
    expect(result.errors.reason).toBeTruthy()
  })

  it('requires a target (post or user)', () => {
    const result = validateReportInput({ reason: 'spam' })
    expect(result.valid).toBe(false)
    expect(result.errors.target).toBeTruthy()
  })

  it('accepts a valid post report', () => {
    const result = validateReportInput({ reason: 'spam', collabPostId: 'post-1', details: 'looks fake' })
    expect(result.valid).toBe(true)
  })
})
