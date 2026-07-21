export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileStudioCaller } from '../../../../lib/profileStudio/auth'

const ItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  price: z.number().nonnegative().max(10000000),
  estimatedEarnings: z.number().nonnegative().max(10000000).optional().default(0),
  category: z.string().trim().min(1).max(60),
  visibility: z.enum(['public', 'private_only', 'approval_required']).default('public'),
  durationSeconds: z.number().int().nonnegative().max(36000).nullable().optional(),
  cooldownMinutes: z.number().int().nonnegative().max(1440).nullable().optional(),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().max(120).optional(),
  intro: z.string().trim().max(500).optional(),
  closingCta: z.string().trim().max(300).optional(),
  rules: z.array(z.string().max(200)).max(20).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  items: z.array(ItemSchema).max(60).optional(),
})

const DuplicateSchema = z.object({
  action: z.literal('duplicate'),
  id: z.string().uuid(),
})

function menuToClient(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    currencyType: row.currency_type,
    tokenValue: Number(row.token_value),
    style: row.style,
    title: row.title,
    intro: row.intro,
    rules: row.rules,
    closingCta: row.closing_cta,
    settings: row.settings,
    review: row.review,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function itemToClient(row) {
  return {
    id: row.id,
    name: row.item_name,
    description: row.description,
    price: Number(row.price),
    estimatedEarnings: Number(row.estimated_earnings),
    category: row.category,
    visibility: row.visibility,
    durationSeconds: row.duration_seconds,
    cooldownMinutes: row.cooldown_minutes,
    sortOrder: row.sort_order,
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
    const { data: menu, error: menuError } = await supabase
      .from('tip_menus')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (menuError) {
      console.error('Failed to load tip menu', menuError.message)
      return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
    if (!menu) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    const { data: items, error: itemsError } = await supabase
      .from('tip_menu_items')
      .select('*')
      .eq('tip_menu_id', id)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (itemsError) {
      console.error('Failed to load tip menu items', itemsError.message)
      return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return NextResponse.json({ menu: { ...menuToClient(menu), items: items.map(itemToClient) } })
  }

  const { data, error } = await supabase
    .from('tip_menus')
    .select('id, name, platform, currency_type, token_value, style, title, intro, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to list tip menus', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  return NextResponse.json({ menus: data.map(menuToClient) })
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
    return NextResponse.json({ error: 'Invalid or missing fields.', details: parsed.error.issues.slice(0, 10) }, { status: 400 })
  }
  const { id, items, ...fields } = parsed.data

  // Ownership check up front — every subsequent statement targets this id,
  // and we want a clean 404 rather than a silent no-op update.
  const { data: existing, error: existingError } = await supabase
    .from('tip_menus')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingError) {
    console.error('Failed to load tip menu for update', existingError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const update = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) update.name = fields.name
  if (fields.title !== undefined) update.title = fields.title
  if (fields.intro !== undefined) update.intro = fields.intro
  if (fields.closingCta !== undefined) update.closing_cta = fields.closingCta
  if (fields.rules !== undefined) update.rules = fields.rules
  if (fields.settings !== undefined) update.settings = fields.settings

  const { data: updatedMenu, error: updateError } = await supabase
    .from('tip_menus')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError) {
    console.error('Failed to update tip menu', updateError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  let clientItems = null
  if (items) {
    const { error: deleteError } = await supabase
      .from('tip_menu_items')
      .delete()
      .eq('tip_menu_id', id)
      .eq('user_id', user.id)
    if (deleteError) {
      console.error('Failed to replace tip menu items', deleteError.message)
      return NextResponse.json({ error: 'Something went wrong saving your items.' }, { status: 500 })
    }

    if (items.length) {
      const rows = items.map((item, i) => ({
        tip_menu_id: id,
        user_id: user.id,
        item_name: item.name,
        description: item.description,
        price: item.price,
        estimated_earnings: item.estimatedEarnings,
        category: item.category,
        visibility: item.visibility,
        duration_seconds: item.durationSeconds ?? null,
        cooldown_minutes: item.cooldownMinutes ?? null,
        sort_order: i,
      }))
      const { data: insertedItems, error: insertError } = await supabase
        .from('tip_menu_items')
        .insert(rows)
        .select('*')
        .order('sort_order', { ascending: true })
      if (insertError) {
        console.error('Failed to save tip menu items', insertError.message)
        return NextResponse.json({ error: 'Something went wrong saving your items.' }, { status: 500 })
      }
      clientItems = insertedItems.map(itemToClient)
    } else {
      clientItems = []
    }
  }

  return NextResponse.json({ menu: { ...menuToClient(updatedMenu), items: clientItems } })
}

export async function DELETE(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('tip_menus')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete tip menu', error.message)
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

  const { data: sourceMenu, error: sourceError } = await supabase
    .from('tip_menus')
    .select('*')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (sourceError) {
    console.error('Failed to load tip menu to duplicate', sourceError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!sourceMenu) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: sourceItems, error: sourceItemsError } = await supabase
    .from('tip_menu_items')
    .select('*')
    .eq('tip_menu_id', sourceMenu.id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
  if (sourceItemsError) {
    console.error('Failed to load tip menu items to duplicate', sourceItemsError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  const { data: copyMenu, error: copyMenuError } = await supabase
    .from('tip_menus')
    .insert({
      user_id: user.id,
      profile_id: sourceMenu.profile_id,
      name: `${sourceMenu.name} (copy)`,
      platform: sourceMenu.platform,
      currency_type: sourceMenu.currency_type,
      token_value: sourceMenu.token_value,
      style: sourceMenu.style,
      title: sourceMenu.title,
      intro: sourceMenu.intro,
      rules: sourceMenu.rules,
      closing_cta: sourceMenu.closing_cta,
      settings: sourceMenu.settings,
      review: sourceMenu.review,
    })
    .select('*')
    .single()

  if (copyMenuError) {
    console.error('Failed to duplicate tip menu', copyMenuError.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  if (sourceItems.length) {
    const rows = sourceItems.map(item => ({
      tip_menu_id: copyMenu.id,
      user_id: user.id,
      item_name: item.item_name,
      description: item.description,
      price: item.price,
      estimated_earnings: item.estimated_earnings,
      category: item.category,
      visibility: item.visibility,
      duration_seconds: item.duration_seconds,
      cooldown_minutes: item.cooldown_minutes,
      sort_order: item.sort_order,
    }))
    const { error: copyItemsError } = await supabase.from('tip_menu_items').insert(rows)
    if (copyItemsError) {
      console.error('Failed to duplicate tip menu items', copyItemsError.message)
      return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
  }

  return NextResponse.json({ menu: menuToClient(copyMenu) })
}
