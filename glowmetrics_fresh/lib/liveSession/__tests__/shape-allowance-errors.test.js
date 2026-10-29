/**
 * @jest-environment node
 */
import { sanitizedErrorResponse, ALLOWANCE_ERRORS, ALLOWANCE_LOCK_CODES } from '../shape'

const pg = (message, code = 'P0001') => ({ code, message })

describe('allowance error mapping', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  test.each([
    ['FREE_LIVE_WEEKLY_LIMIT: Free Live Mode includes 2 streams per week. Upgrade...', 403, 'FREE_LIVE_WEEKLY_LIMIT', /both Free Live Mode streams/],
    ['TIMEZONE_REQUIRED: Choose your timezone...', 403, 'TIMEZONE_REQUIRED', /Choose your timezone/],
    ['PLATFORM_REQUIRED: Live Mode needs Chaturbate...', 400, 'PLATFORM_REQUIRED', /never guesses your platform/],
    ['USERNAME_REQUIRED: the fan username is required', 400, 'USERNAME_REQUIRED', /fan.s username/],
  ])('%s', (message, status, code, text) => {
    const r = sanitizedErrorResponse(pg(message))
    expect(r.status).toBe(status); expect(r.body.code).toBe(code); expect(r.body.error).toMatch(text)
  })

  test('raw database text is never returned', () => {
    const r = sanitizedErrorResponse(pg('FREE_LIVE_WEEKLY_LIMIT: internal detail 12345 stack'))
    expect(JSON.stringify(r.body)).not.toMatch(/internal detail|12345|stack/)
  })
  test('the existing Pro gate message and generic errors are unchanged', () => {
    expect(sanitizedErrorResponse(pg('LIVE_MODE_REQUIRES_PRO: x')).body.code).toBe('LIVE_MODE_REQUIRES_PRO')
    expect(sanitizedErrorResponse(pg('something else')).status).toBe(500)
    expect(sanitizedErrorResponse({ code: '28000', message: 'x' }).status).toBe(401)
  })
  test('an unknown P0001 prefix is a generic 500, not an echo', () => {
    const r = sanitizedErrorResponse(pg('NEW_THING: whatever'))
    expect(r.status).toBe(500); expect(r.body.code).toBeUndefined()
  })
  test('only the two lock codes carry allowance state', () => {
    expect(ALLOWANCE_LOCK_CODES).toEqual(['FREE_LIVE_WEEKLY_LIMIT', 'TIMEZONE_REQUIRED'])
    expect(Object.keys(ALLOWANCE_ERRORS).sort()).toEqual(['FREE_LIVE_WEEKLY_LIMIT', 'PLATFORM_REQUIRED', 'TIMEZONE_REQUIRED', 'USERNAME_REQUIRED'])
  })
})
