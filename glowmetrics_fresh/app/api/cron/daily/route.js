import { NextResponse } from 'next/server'

export async function GET(req) {
  const origin = new URL(req.url).origin
  try {
    const res = await fetch(`${origin}/api/notify/digest`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[cron/daily] Failed to call digest:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
