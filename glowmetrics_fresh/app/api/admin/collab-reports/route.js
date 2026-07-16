import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function requireAdmin(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  return verifyAdminToken(token)
}

// Moderation for the Collab Board. Mirrors the existing admin panel's
// service-role + cookie-token pattern (app/api/admin/stats/route.js) — this
// is intentionally NOT gated by Supabase RLS/roles, same as the rest of
// /admin, so it bypasses collab_reports RLS (which is reporter-only) by
// design.
export async function GET(req) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = sb()
  const { data: reports, error } = await client
    .from('collab_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })

  const postIds = [...new Set(reports.map(r => r.collab_post_id).filter(Boolean))]
  const userIds = [...new Set([
    ...reports.map(r => r.reporter_user_id),
    ...reports.map(r => r.reported_user_id),
  ].filter(Boolean))]

  const [{ data: posts }, { data: profiles }] = await Promise.all([
    postIds.length ? client.from('collab_posts').select('id, title, status, user_id').in('id', postIds) : { data: [] },
    userIds.length ? client.from('profiles').select('id, display_name').in('id', userIds) : { data: [] },
  ])

  const postById = new Map((posts || []).map(p => [p.id, p]))
  const nameById = new Map((profiles || []).map(p => [p.id, p.display_name]))

  const enriched = reports.map(r => ({
    ...r,
    post: r.collab_post_id ? postById.get(r.collab_post_id) || null : null,
    reporter_name: nameById.get(r.reporter_user_id) || null,
    reported_name: r.reported_user_id ? (nameById.get(r.reported_user_id) || null) : null,
  }))

  return NextResponse.json({ reports: enriched })
}

export async function PATCH(req) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.reportId || !body?.status) {
    return NextResponse.json({ error: 'reportId and status are required' }, { status: 400 })
  }
  if (!['open', 'reviewing', 'actioned', 'dismissed'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const client = sb()

  const { data: report, error: reportErr } = await client
    .from('collab_reports')
    .update({ status: body.status, reviewed_at: new Date().toISOString() })
    .eq('id', body.reportId)
    .select('*')
    .single()

  if (reportErr) return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })

  if (body.removePost && report.collab_post_id) {
    const { error: postErr } = await client
      .from('collab_posts')
      .update({
        status: 'removed',
        admin_removed: true,
        admin_removal_reason: (body.removalReason || '').toString().slice(0, 500) || null,
      })
      .eq('id', report.collab_post_id)
    if (postErr) return NextResponse.json({ error: 'Report updated, but failed to remove the post' }, { status: 500 })
  }

  return NextResponse.json({ report })
}
