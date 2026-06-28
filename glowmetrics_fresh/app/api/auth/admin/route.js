import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req) {
  const body = await req.json()
  const email = (body.email || '').trim().toLowerCase()
  const password = (body.password || '').trim()
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim()
  if (!email || !password || email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
  }
  const token = crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'fallback')
    .update(`${email}:${Date.now()}`)
    .digest('hex')
  return NextResponse.json({ token, ok: true })
}
