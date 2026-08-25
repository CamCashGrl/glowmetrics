import crypto from 'crypto'

const SESSION_MS = 24 * 3600 * 1000

export const ADMIN_COOKIE = 'gm_admin'
export const ADMIN_SESSION_MS = SESSION_MS

function getSecret() {
  const secret = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET is not configured')
  return secret
}

// True only when all three admin env vars are present. The login route calls
// this first so a missing-config deploy reports itself instead of throwing a
// 500 out of signAdminToken() and surfacing as a generic "something went wrong".
export function isAdminConfigured() {
  return Boolean(
    process.env.ADMIN_SECRET &&
    process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD
  )
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function signAdminToken() {
  const expiresAt = Date.now() + SESSION_MS
  return `${expiresAt}.${sign(String(expiresAt))}`
}

export function verifyAdminToken(token) {
  if (!token) return false
  const [expiresAtStr, sig] = token.split('.')
  if (!expiresAtStr || !sig) return false

  let expected
  try {
    expected = sign(expiresAtStr)
  } catch {
    return false
  }

  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return false
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false

  const expiresAt = parseInt(expiresAtStr, 10)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  return true
}

export function getAdminTokenFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)gm_admin=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}
