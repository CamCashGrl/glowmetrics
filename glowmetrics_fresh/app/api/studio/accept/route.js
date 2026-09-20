export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStudioCaller } from '../../../../lib/studio/auth'

const AcceptSchema = z.object({
  studio_model_id: z.string().uuid(),
})

// A model accepts her own pending invite. RLS ("model accept or revoke own
// invite") already restricts this to rows where model_user_id = auth.uid(),
// so the update below can only ever affect the caller's own invite. The
// status filter below additionally restricts this to the invited -> accepted
// transition only, so an already-accepted or revoked row is left untouched
// (returns the same "not found" response used for a row that doesn't exist
// or isn't hers, rather than a new error case).
export async function POST(req) {
  const { supabase, user } = await getStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = AcceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invite id.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('studio_models')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', parsed.data.studio_model_id)
    .eq('model_user_id', user.id)
    .eq('status', 'invited')
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Failed to accept invite', error.message)
    return NextResponse.json({ error: 'Something went wrong accepting the invite.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  }

  return NextResponse.json({ invite: data })
}
