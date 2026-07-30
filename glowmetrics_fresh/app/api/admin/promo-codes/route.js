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

// Readable random code like CAMCASH-7F3K9Q — avoids ambiguous chars (0/O, 1/I).
function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `CAMCASH-${suffix}`
}

export async function GET(req) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await sb()
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ codes: data })
}

export async function POST(req) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const durationDays = Number.isFinite(body.duration_days) ? body.duration_days : parseInt(body.duration_days, 10) || 30
  if (durationDays < 1 || durationDays > 365) {
    return NextResponse.json({ error: 'duration_days must be between 1 and 365' }, { status: 400 })
  }

  let maxRedemptions = null
  if (body.max_redemptions !== undefined && body.max_redemptions !== null && body.max_redemptions !== '') {
    maxRedemptions = parseInt(body.max_redemptions, 10)
    if (!Number.isFinite(maxRedemptions) || maxRedemptions < 1) {
      return NextResponse.json({ error: 'max_redemptions must be a positive number' }, { status: 400 })
    }
  }

  const code = (body.code && String(body.code).trim().toUpperCase()) || generateCode()

  const { data, error } = await sb()
    .from('promo_codes')
    .insert({
      code,
      description: body.description || null,
      duration_days: durationDays,
      max_redemptions: maxRedemptions,
      expires_at: body.expires_at || null,
      created_by: 'admin',
    })
    .select()
    .single()

  if (error) {
    const message = error.code === '23505' ? 'That code already exists.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ code: data })
}

export async function PATCH(req) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  if (!body.code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  const { data, error } = await sb()
    .from('promo_codes')
    .update({ active: !!body.active })
    .eq('code', String(body.code).trim().toUpperCase())
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ code: data })
}
