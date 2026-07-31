import { NextResponse } from 'next/server'
import { runDailyDigest } from '../../notify/digest/route'

// Calls the digest logic directly rather than fetching /api/notify/digest
// over HTTP — that self-fetch could hit Vercel's deployment-protection auth
// wall and get back an HTML challenge page, which broke res.json() here.
export async function GET() {
  try {
    const data = await runDailyDigest()
    const { status = 200, ...body } = data
    return NextResponse.json(body, { status })
  } catch (err) {
    console.error('[cron/daily] Failed to call digest:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
