import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../../lib/supabase-server'

export async function POST(req, { params }) {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json()
  if (!body || !body.trim()) {
    return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
  }

  const { notificationId } = params
  const { data, error } = await supabase
    .from('notification_replies')
    .insert({
      notification_id: notificationId,
      sender_type: 'user',
      sender_id: user.id,
      body,
    })
    .select()
    .single()

  // RLS (replies_insert_own_thread) is what actually enforces the user can
  // only reply into a notification row they own — this insert fails with a
  // policy violation rather than succeeding for a foreign thread.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true, reply: data })
}
