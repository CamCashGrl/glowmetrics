import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'

const TEST_EMAIL_PATTERNS = [
  'daphneoncam+test',
  'daphenoncam+testing',
  'camcashgrl+testing',
]

function isTestAccount(email) {
  if (!email) return false
  const e = email.toLowerCase()
  return TEST_EMAIL_PATTERNS.some(p => e.includes(p))
}

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

function requireAdmin(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  return verifyAdminToken(token)
}

export async function GET(req) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = sb()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const [authResult, notificationsResult, repliesResult] = await Promise.all([
    client.auth.admin.listUsers({ perPage: 1000 }),
    client.from('notifications').select('*').order('created_at', { ascending: true }),
    client.from('notification_replies').select('*').order('created_at', { ascending: true }),
  ])

  const users = authResult.data?.users || []
  const emailById = Object.fromEntries(users.map(u => [u.id, u.email]))
  const notifications = notificationsResult.data || []
  const replies = repliesResult.data || []

  if (userId) {
    const thread = notifications
      .filter(n => n.user_id === userId)
      .map(n => ({ ...n, replies: replies.filter(r => r.notification_id === n.id) }))
    return NextResponse.json({ email: emailById[userId] || userId, thread })
  }

  const repliesByNotification = replies.reduce((acc, r) => {
    (acc[r.notification_id] ||= []).push(r)
    return acc
  }, {})

  const byUser = new Map()
  for (const n of notifications) {
    const list = byUser.get(n.user_id) || []
    list.push({ ...n, replies: repliesByNotification[n.id] || [] })
    byUser.set(n.user_id, list)
  }

  const threads = Array.from(byUser.entries()).map(([uid, msgs]) => {
    const activity = msgs
      .flatMap(m => [
        { at: m.created_at, senderType: m.sender_type, body: m.body },
        ...m.replies.map(r => ({ at: r.created_at, senderType: r.sender_type, body: r.body })),
      ])
      .sort((a, b) => (a.at > b.at ? 1 : -1))
    const latest = activity[activity.length - 1]
    return {
      userId: uid,
      email: emailById[uid] || uid,
      isTest: isTestAccount(emailById[uid]),
      messageCount: msgs.length,
      latestAt: latest?.at,
      latestBody: latest?.body,
      latestSenderType: latest?.senderType,
      needsResponse: latest?.senderType === 'user',
    }
  }).sort((a, b) => (b.latestAt || '').localeCompare(a.latestAt || ''))

  return NextResponse.json({
    threads,
    users: users.map(u => ({ id: u.id, email: u.email, isTest: isTestAccount(u.email) })),
  })
}

export async function POST(req) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, broadcast, senderType, subject, body } = await req.json()

  if (!['admin_personal', 'system'].includes(senderType)) {
    return NextResponse.json({ error: 'Invalid senderType' }, { status: 400 })
  }
  if (!body || !body.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }
  if (!broadcast && !userId) {
    return NextResponse.json({ error: 'userId is required unless broadcasting' }, { status: 400 })
  }

  const client = sb()
  const senderId = senderIdFor(senderType)

  if (broadcast) {
    const { data: authData, error: authError } = await client.auth.admin.listUsers({ perPage: 1000 })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    const recipients = authData.users.filter(u => !isTestAccount(u.email))
    const broadcastId = randomUUID()
    const rows = recipients.map(u => ({
      user_id: u.id,
      broadcast_id: broadcastId,
      sender_type: senderType,
      sender_id: senderId,
      subject: subject || null,
      body,
    }))

    const { error } = await client.from('notifications').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, broadcastId, recipientCount: rows.length })
  }

  const { data, error } = await client
    .from('notifications')
    .insert({ user_id: userId, sender_type: senderType, sender_id: senderId, subject: subject || null, body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, notification: data })
}
