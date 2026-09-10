import { NextResponse } from 'next/server'

// Cron endpoint — never statically optimize this (see the same note in
// app/api/cron/expire-goodwill-trials/route.js).
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const origin = new URL(req.url).origin
  let digest = null
  let digestError = null
  try {
    const res = await fetch(`${origin}/api/notify/digest`)
    digest = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to call digest:', err.message)
    digestError = err.message
  }

  let goodwillExpiry = null
  let goodwillExpiryError = null
  try {
    const res = await fetch(`${origin}/api/cron/expire-goodwill-trials`)
    goodwillExpiry = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to expire goodwill trials:', err.message)
    goodwillExpiryError = err.message
  }

  return NextResponse.json({
    success: !digestError && !goodwillExpiryError,
    digest, digestError,
    goodwillExpiry, goodwillExpiryError,
  })
}
