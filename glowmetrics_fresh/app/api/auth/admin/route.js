import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { signAdminToken, isAdminConfigured, verifyAdminToken, getAdminTokenFromCookieHeader, ADMIN_COOKIE, ADMIN_SESSION_MS } from '../../../../lib/adminAuth'

// ── Brute-force throttle ────────────────────────────────────────────────────
// In-memory and therefore per-instance: on serverless this resets on cold start
// and is not shared across regions, so it slows a single-source guessing attack
// rather than stopping a distributed one. It is deliberately dependency-free —
// a durable limiter would need Redis/Upstash.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const attempts = new Map()

function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : null)?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > ATTEMPT_WINDOW_MS) return false
  return rec.count >= MAX_ATTEMPTS
}

function recordFailure(ip) {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > ATTEMPT_WINDOW_MS) attempts.set(ip, { first: now, count: 1 })
  else rec.count += 1
  // Bound the map so a spray of unique IPs can't grow it without limit.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) {
      if (now - v.first > ATTEMPT_WINDOW_MS) attempts.delete(k)
    }
  }
}

// Constant-time string compare that doesn't leak length via early return.
function safeEqual(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest()
  const bh = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ah, bh)
}

export async function POST(req) {
  // Misconfiguration is reported distinctly from bad credentials. This leaks
  // nothing an attacker can use (no secret, no hint about a valid email) and
  // turns an otherwise silent 500 into an actionable message.
  if (!isAdminConfigured()) {
    console.error('[admin-auth] ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_SECRET are not all set')
    return NextResponse.json(
      { error: 'Admin login is not configured on this server.' },
      { status: 503 }
    )
  }

  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429 }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
  }

  const email = (body?.email || '').trim().toLowerCase()
  const password = (body?.password || '').trim()
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim()

  const ok = Boolean(email) && Boolean(password) &&
    safeEqual(email, adminEmail) && safeEqual(password, adminPassword)

  if (!ok) {
    recordFailure(ip)
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
  }

  attempts.delete(ip)

  // The token is set as an HttpOnly cookie here and deliberately NOT returned
  // in the body — client JS must never be able to read the admin session, or
  // any XSS anywhere on the site becomes full admin takeover.
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, signAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MS / 1000,
  })
  return res
}

// Logout — the cookie is HttpOnly, so it can only be cleared server-side.
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}

// Session probe — lets admin pages check auth without reading the (HttpOnly)
// cookie from JS. Returns only a boolean, never the token.
export async function GET(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  return NextResponse.json({ authenticated: verifyAdminToken(token) })
}
