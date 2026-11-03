/**
 * @jest-environment node
 */
import { sanitizedErrorResponse } from '../shape'

describe('sanitizedErrorResponse', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => console.error.mockRestore())

  test('Pro start gate → 403 with a readable reason', () => {
    const { status, body } = sanitizedErrorResponse({
      code: 'P0001',
      message: 'LIVE_MODE_REQUIRES_PRO: Live Mode is a Pro feature. Upgrade to Pro to start a live session.',
    })
    expect(status).toBe(403)
    expect(body.code).toBe('LIVE_MODE_REQUIRES_PRO')
    expect(body.error).toMatch(/Pro feature/)
  })

  test('other P0001 errors stay generic (no raw DB text leaks)', () => {
    const { status, body } = sanitizedErrorResponse({ code: 'P0001', message: 'some internal detail' })
    expect(status).toBe(500)
    expect(body.error).not.toMatch(/internal detail/)
  })

  test('existing mappings unchanged', () => {
    expect(sanitizedErrorResponse({ code: '28000' }).status).toBe(401)
    expect(sanitizedErrorResponse({ code: '22023' }).status).toBe(400)
  })
})
