import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../../../lib/adminAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function senderIdFor(senderType) {
  if (senderType === 'admin_personal') return (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  return 'system'
}

export async function POST(req, { params }) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { senderType, body } = await req.json()
  if (!['admin_personal', 'system'].includes(senderType)) {
    return NextResponse.json({ error: 'Invalid senderType' }, { status: 400 })
  }
  if (!body || !body.trim()) {
    return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
  }

  const { notificationId } = params
  const { data, error } = await sb()
    .from('notification_replies')
    .insert({
      notification_id: notificationId,
      sender_type: senderType,
      sender_id: senderIdFor(senderType),
      body,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, reply: data })
}
