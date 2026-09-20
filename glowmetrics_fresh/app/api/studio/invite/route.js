export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStudioCaller, findUserIdByEmail } from '../../../../lib/studio/auth'

const InviteSchema = z.object({
  email: z.string().trim().email(),
})

// Invites an existing CamCash account (by email) to the caller's studio.
// Only resolves an existing auth.users id — this never creates an account
// or sends a signup invite; the model must already have signed up.
export async function POST(req) {
  const { supabase, user } = await getStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
  }

  const { data: studio, error: studioError } = await supabase
    .from('studios')
    .select('id, owner_user_id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (studioError) {
    console.error('Failed to load studio for invite', studioError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!studio) {
    return NextResponse.json({ error: 'Create your studio before inviting a model.' }, { status: 404 })
  }

  let modelUserId
  try {
    modelUserId = await findUserIdByEmail(parsed.data.email)
  } catch (err) {
    console.error('Failed to look up invited email', err.message)
    return NextResponse.json({ error: 'Something went wrong looking up that email.' }, { status: 500 })
  }

  if (!modelUserId) {
    return NextResponse.json({ error: 'No CamCash account found for that email.' }, { status: 404 })
  }
  if (modelUserId === user.id) {
    return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('studio_models')
    .insert({ studio_id: studio.id, model_user_id: modelUserId })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation on (studio_id, model_user_id)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That model has already been invited.' }, { status: 409 })
    }
    console.error('Failed to create invite', error.message)
    return NextResponse.json({ error: 'Something went wrong sending the invite.' }, { status: 500 })
  }

  return NextResponse.json({ invite: data })
}
