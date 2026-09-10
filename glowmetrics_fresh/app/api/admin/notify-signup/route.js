import { NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

export async function POST(req) {
  try {
    const { email, source } = await req.json()

    if (!BOT_TOKEN || !CHAT_ID) {
      // Silently succeed if Telegram isn't configured — never block signup
      return NextResponse.json({ ok: true, skipped: true })
    }

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true,
    })

    const text = [
      '🌟 *New GlowMetrics Signup*',
      '',
      `📧 ${email}`,
      `🕐 ${now} ET`,
      source ? `📍 Source: ${source}` : null,
      '',
      '→ [View Users](https://supabase.com/dashboard/project/_/auth/users)',
    ].filter(Boolean).join('\n')

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('[notify-signup] Telegram error:', data.description)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Never let notification failure affect the user experience
    console.error('[notify-signup] Failed:', err.message)
    return NextResponse.json({ ok: true })
  }
}
