import { NextResponse } from 'next/server'

export async function GET(req) {
  const origin = new URL(req.url).origin
  const results = {}

  try {
    const res = await fetch(`${origin}/api/notify/digest`)
    results.digest = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to call digest:', err.message)
    results.digest = { success: false, error: err.message }
  }

  try {
    const res = await fetch(`${origin}/api/notify/plan-expiry-reminder`)
    results.planExpiryReminder = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to call plan-expiry-reminder:', err.message)
    results.planExpiryReminder = { success: false, error: err.message }
  }

  return NextResponse.json({ success: true, ...results })
}
