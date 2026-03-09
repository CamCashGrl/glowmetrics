import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req) {
  const { email, password } = await req.json()
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
  }
  const token = crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'fallback')
    .update(`${email}:${Date.now()}`)
    .digest('hex')
  return NextResponse.json({ token, ok: true })
}
