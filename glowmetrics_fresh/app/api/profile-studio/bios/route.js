export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileStudioCaller } from '../../../../lib/profileStudio/auth'

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  generatedText: z.string().trim().min(1).max(4000).optional(),
})

const DuplicateSchema = z.object({
  action: z.literal('duplicate'),
  id: z.string().uuid(),
})

function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    format: row.format,
    style: row.style,
    text: row.generated_text,
    characterCount: row.character_count,
    lengthOption: row.length_option,
    emojiOption: row.emoji_option,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export async function GET(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')

  if (id) {
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('generated_bios')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('Failed to load bio', error.message)
      return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    return NextResponse.json({ bio: toClient(data) })
  }

  const { data, error } = await supabase
    .from('generated_bios')
    .select('id, name, platform, format, style, character_count, length_option, emoji_option, updated_at, created_at, generated_text')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to list bios', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  return NextResponse.json({ bios: data.map(toClient) })
}

export async function PATCH(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing fields.' }, { status: 400 })
  }

  const update = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) update.name = parsed.data.name
  if (parsed.data.generatedText !== undefined) {
    update.generated_text = parsed.data.generatedText
    update.character_count = parsed.data.generatedText.length
  }

  const { data, error } = await supabase
    .from('generated_bios')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Failed to update bio', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  return NextResponse.json({ bio: toClient(data) })
}

export async function DELETE(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('generated_bios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete bio', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = DuplicateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { data: source, error: sourceError } = await supabase
    .from('generated_bios')
    .select('*')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (sourceError) {
    console.error('Failed to load bio to duplicate', sourceError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!source) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: copy, error: copyError } = await supabase
    .from('generated_bios')
    .insert({
      user_id: user.id,
      profile_id: source.profile_id,
      name: `${source.name} (copy)`,
      platform: source.platform,
      format: source.format,
      style: source.style,
      length_option: source.length_option,
      emoji_option: source.emoji_option,
      input_snapshot: source.input_snapshot,
      generated_text: source.generated_text,
      character_count: source.character_count,
    })
    .select('*')
    .single()

  if (copyError) {
    console.error('Failed to duplicate bio', copyError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  return NextResponse.json({ bio: toClient(copy) })
}
