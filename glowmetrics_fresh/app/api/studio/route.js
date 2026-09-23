export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStudioCaller, getDisplayNamesByUserId } from '../../../lib/studio/auth'

const CreateStudioSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

// Returns the caller's own studio (if she owns one) with its linked models,
// AND any studio_models rows where she is the invited model (whether
// invited/accepted/revoked) — a user can be a studio owner and a model
// under a different studio at the same time; nothing in the schema
// prevents that, so both are always returned rather than assuming one role.
export async function GET() {
  const { supabase, user } = await getStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ownedStudio, error: studioError } = await supabase
    .from('studios')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (studioError) {
    console.error('Failed to load studio', studioError.message)
    return NextResponse.json({ error: 'Something went wrong loading your studio.' }, { status: 500 })
  }

  let models = []
  if (ownedStudio) {
    const { data: modelRows, error: modelsError } = await supabase
      .from('studio_models')
      .select('*')
      .eq('studio_id', ownedStudio.id)
      .order('invited_at', { ascending: false })

    if (modelsError) {
      console.error('Failed to load studio models', modelsError.message)
      return NextResponse.json({ error: 'Something went wrong loading your models.' }, { status: 500 })
    }

    const names = await getDisplayNamesByUserId(modelRows.map((m) => m.model_user_id))
    models = modelRows.map((m) => ({ ...m, display_name: names[m.model_user_id] ?? null }))
  }

  const { data: myInvites, error: invitesError } = await supabase
    .from('studio_models')
    .select('*, studios(id, name)')
    .eq('model_user_id', user.id)
    .order('invited_at', { ascending: false })

  if (invitesError) {
    console.error('Failed to load invites', invitesError.message)
    return NextResponse.json({ error: 'Something went wrong loading your invites.' }, { status: 500 })
  }

  return NextResponse.json({ studio: ownedStudio, models, invites: myInvites })
}

// Creates a studio for the caller. One studio per owner — not a schema
// constraint (studios has no unique(owner_user_id)), so this is enforced
// here in application code rather than assuming the database forbids it.
export async function POST(req) {
  const { supabase, user } = await getStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateStudioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a studio name.' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('studios')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Failed to check for existing studio', existingError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (existing) {
    return NextResponse.json({ error: 'You already have a studio.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('studios')
    .insert({ owner_user_id: user.id, name: parsed.data.name })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create studio', error.message)
    return NextResponse.json({ error: 'Something went wrong creating your studio.' }, { status: 500 })
  }

  return NextResponse.json({ studio: data })
}
