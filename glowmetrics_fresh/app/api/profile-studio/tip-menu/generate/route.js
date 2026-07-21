export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getProfileStudioCaller } from '../../../../../lib/profileStudio/auth'
import { getIsProUser } from '../../../../../lib/profileStudio/entitlements'
import { checkRateLimit } from '../../../../../lib/rateLimit'
import { TipMenuGenerateRequestSchema, violatesBoundaries, reviewTipMenu, cannedItemText } from '../../../../../lib/profileStudio/tipMenuRules'
import { buildPricingSlots, estimateEarnings, suggestVisibility, suggestDuration, suggestCooldown } from '../../../../../lib/profileStudio/pricingEngine'
import { buildTipMenuContentPrompt, TIP_MENU_CONTENT_OUTPUT_SCHEMA } from '../../../../../lib/profileStudio/prompts'
import { generateStructuredContent } from '../../../../../lib/profileStudio/anthropic'
import { FREE_TIER_LIMITS } from '../../../../../lib/profileStudio/constants'

const STYLE_STRATEGY = {
  balanced: null, // uses the creator's chosen strategy
  high_engagement: 'budget',
  premium: 'premium',
}

async function generateOneMenu({ style, data, user, supabase, isPro }) {
  const strategy = STYLE_STRATEGY[style] || data.strategy

  const neverInclude = (data.boundaries.neverInclude || []).map(t => t.toLowerCase().trim()).filter(Boolean)
  const allCategories = [...data.categories, ...data.customCategories]
  const safeCategories = allCategories.filter(cat => !neverInclude.some(term => cat.toLowerCase().includes(term)))
  const categories = safeCategories.length ? safeCategories : allCategories

  const itemCount = isPro ? data.itemCount : Math.min(data.itemCount, FREE_TIER_LIMITS.maxTipMenuItemsFree)

  const slots = buildPricingSlots({
    categories,
    itemCount,
    strategy,
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    currencyType: data.currencyType,
  }).map((slot, i) => ({
    ...slot,
    sortOrder: i,
    estimatedEarnings: estimateEarnings(slot.price, data.currencyType, data.tokenValue),
    visibility: suggestVisibility(slot.category, slot.priceLevel, data.boundaries),
    durationSeconds: suggestDuration(slot.category, slot.priceLevel),
    cooldownMinutes: suggestCooldown(slot.category, slot.priceLevel),
  }))

  const prompt = buildTipMenuContentPrompt({
    persona: data.persona,
    tone: [],
    showEnergy: data.showEnergy,
    roomGoal: data.roomGoal,
    platform: data.platform,
    displayName: '',
    ctaPrimary: data.roomGoal,
    disclaimer: data.boundaries.disclaimer,
    slots,
  })

  const warnings = []
  let aiResult
  try {
    aiResult = await generateStructuredContent({
      prompt,
      schema: TIP_MENU_CONTENT_OUTPUT_SCHEMA,
      maxTokens: Math.min(6000, 600 + itemCount * 140),
    })
  } catch (err) {
    aiResult = null
    warnings.push('Menu copy generation had an issue — used safe default wording for some items.')
  }

  const aiItems = Array.isArray(aiResult?.items) ? aiResult.items : []

  const items = slots.map((slot, i) => {
    const candidate = aiItems[i]
    let name = candidate?.name?.trim()
    let description = candidate?.description?.trim()

    const violatesText = !name || !description || violatesBoundaries(`${name} ${description}`, data.boundaries.neverInclude)
    if (violatesText) {
      const fallback = cannedItemText(slot.category)
      name = fallback.name
      description = fallback.description
    }

    return {
      id: `item_${i + 1}`,
      name,
      description,
      price: slot.price,
      estimatedEarnings: slot.estimatedEarnings,
      category: slot.category,
      visibility: slot.visibility,
      durationSeconds: slot.durationSeconds,
      cooldownMinutes: slot.cooldownMinutes,
      sortOrder: slot.sortOrder,
    }
  })

  const review = reviewTipMenu(items, { boundaries: data.boundaries, minPrice: data.minPrice, maxPrice: data.maxPrice })

  const title = aiResult?.title?.trim() || `Tip Menu`
  const intro = aiResult?.intro?.trim() || 'Pick something fun and make my day.'
  const closingCta = aiResult?.closingCta?.trim() || 'Thank you for tipping!'
  const rules = Array.isArray(aiResult?.rules) && aiResult.rules.length
    ? aiResult.rules.slice(0, 8)
    : ['Tips are non-refundable.', 'Custom requests are reviewed before approval.']

  const settings = {
    showEnergy: data.showEnergy,
    roomGoal: data.roomGoal,
    comfortLevel: data.comfortLevel,
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    itemCount,
    strategy,
    hideEarningsFromCustomer: data.hideEarningsFromCustomer,
    boundaries: data.boundaries,
    theme: 'dark_neon',
  }

  const { data: menuRow, error: menuError } = await supabase
    .from('tip_menus')
    .insert({
      user_id: user.id,
      name: `${title}`,
      platform: data.platform,
      currency_type: data.currencyType,
      token_value: data.tokenValue,
      style,
      title,
      intro,
      rules,
      closing_cta: closingCta,
      settings,
      review,
    })
    .select('id, created_at, updated_at')
    .single()

  if (menuError) {
    throw new Error('Menu generated, but saving it failed. Please try again.')
  }

  const itemRows = items.map(item => ({
    tip_menu_id: menuRow.id,
    user_id: user.id,
    item_name: item.name,
    description: item.description,
    price: item.price,
    estimated_earnings: item.estimatedEarnings,
    category: item.category,
    visibility: item.visibility,
    duration_seconds: item.durationSeconds,
    cooldown_minutes: item.cooldownMinutes,
    sort_order: item.sortOrder,
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from('tip_menu_items')
    .insert(itemRows)
    .select('id, item_name, description, price, estimated_earnings, category, visibility, duration_seconds, cooldown_minutes, sort_order')

  if (itemsError) {
    throw new Error('Menu items failed to save. Please try again.')
  }

  return {
    id: menuRow.id,
    style,
    platform: data.platform,
    currencyType: data.currencyType,
    tokenValue: data.tokenValue,
    title,
    intro,
    closingCta,
    rules,
    settings,
    review,
    items: insertedItems.map(row => ({
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
    })),
    warnings,
  }
}

export async function POST(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to generate a tip menu.' }, { status: 401 })
  }

  const rate = checkRateLimit(`${user.id}:tip-menu-generate`, { windowMs: 60_000, max: 5 })
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before generating again.' }, { status: 429 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = TipMenuGenerateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing fields.', details: parsed.error.issues.slice(0, 10) }, { status: 400 })
  }
  const data = parsed.data

  const isPro = await getIsProUser(supabase, user.id)

  if (!isPro) {
    const { count, error: countError } = await supabase
      .from('tip_menus')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (countError) {
      console.error('Failed to check tip menu generation count', countError.message)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
    if ((count ?? 0) >= FREE_TIER_LIMITS.maxSavedTipMenus) {
      return NextResponse.json({
        error: 'Free plan includes one 10-item tip menu. Upgrade to Pro for unlimited menus, smart review, and every export format.',
        code: 'free_limit_reached',
      }, { status: 403 })
    }
  }

  const styles = isPro ? ['balanced', 'high_engagement', 'premium'] : [data.style || 'balanced']

  try {
    const menus = []
    for (const style of styles) {
      // Sequential, not parallel — keeps generation load predictable and lets
      // the client's staged loading messages track real progress.
      const menu = await generateOneMenu({ style, data, user, supabase, isPro })
      menus.push(menu)
    }

    return NextResponse.json({
      menus,
      warnings: menus.flatMap(m => m.warnings),
      meta: { isPro },
    })
  } catch (err) {
    console.error('Tip menu generation failed', err.message)
    return NextResponse.json({ error: err.message || 'Generation failed. Please try again.' }, { status: 502 })
  }
}
