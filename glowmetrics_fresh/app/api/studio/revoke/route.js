export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStudioCaller } from '../../../../../lib/studio/auth'

const RevokeSchema = z.object({
  studio_model_id: z.string().uuid(),
})

// Either the studio owner or the linked model can revoke the link — both
// are already permitted by existing RLS ("studio owner manage own invites"
// and "model accept or revoke own invite"). No ownership check is done here
// beyond the update itself: if the caller is neither the owner nor the
// model, RLS matches zero rows and this returns 404, exactly as intended.
export async function POST(req) {
  const { supabase, user } = await getStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RevokeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invite id.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('studio_models')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', parsed.data.studio_model_id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Failed to revoke link', error.message)
    return NextResponse.json({ error: 'Something went wrong revoking this link.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Link not found.' }, { status: 404 })
  }

  return NextResponse.json({ link: data })
}
