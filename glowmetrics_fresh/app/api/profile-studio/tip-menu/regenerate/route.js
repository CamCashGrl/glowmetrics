export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileStudioCaller, getClientIp } from '../../../../../lib/profileStudio/auth'
import { checkRateLimit } from '../../../../../lib/rateLimit'
import { TIP_MENU_PLATFORMS, SHOW_ENERGY_OPTIONS, ROOM_GOAL_OPTIONS, MENU_STYLES } from '../../../../../lib/profileStudio/constants'
import { violatesBoundaries, cannedItemText } from '../../../../../lib/profileStudio/tipMenuRules'
import { buildTipMenuContentPrompt, TIP_MENU_CONTENT_OUTPUT_SCHEMA } from '../../../../../lib/profileStudio/prompts'
import { generateStructuredContent } from '../../../../../lib/profileStudio/anthropic'

const STYLE_IDS = MENU_STYLES.map(s => s.id)

// Rewrites only the wording of unlocked items — prices, categories, and
// every field of a locked item pass through untouched. This intentionally
// does not touch pricingEngine.js: regeneration never re-prices a slot, it
// only asks the AI for new name/description text for the same slot.
const RegenerateItemSchema = z.object({
  name: z.string().trim().max(80).default(''),
  description: z.string().trim().max(300).default(''),
  price: z.number().nonnegative().max(10000000),
  estimatedEarnings: z.number().nonnegative().max(10000000).optional().default(0),
  category: z.string().trim().min(1).max(60),
  visibility: z.enum(['public', 'private_only', 'approval_required']).default('public'),
  durationSeconds: z.number().int().nonnegative().max(36000).nullable().optional(),
  cooldownMinutes: z.number().int().nonnegative().max(1440).nullable().optional(),
  locked: z.boolean().default(false),
})

const RegenerateRequestSchema = z.object({
  platform: z.enum(TIP_MENU_PLATFORMS),
  style: z.enum(STYLE_IDS).default('balanced'),
  persona: z.array(z.string().max(40)).max(30).default([]),
  showEnergy: z.enum(SHOW_ENERGY_OPTIONS).default('Playful'),
  roomGoal: z.enum(ROOM_GOAL_OPTIONS).default('More small tips'),
  disclaimer: z.string().trim().max(300).optional().default(''),
  neverInclude: z.array(z.string().trim().max(80)).max(30).default([]),
  items: z.array(RegenerateItemSchema).min(1).max(60),
})

// Free and usable signed-out, same as tip-menu/generate — this route never
// persists anything itself (saving still goes through PATCH /tip-menus), so
// there's no account-scoped state to protect here.
export async function POST(req) {
  const { user } = await getProfileStudioCaller()

  const rateKey = user ? `user:${user.id}` : `ip:${getClientIp(req)}`
  const rate = checkRateLimit(`${rateKey}:tip-menu-regenerate`, { windowMs: 60_000, max: 8 })
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before regenerating again.' }, { status: 429 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RegenerateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing fields.', details: parsed.error.issues.slice(0, 10) }, { status: 400 })
  }
  const data = parsed.data

  const unlockedIndexes = data.items.map((it, i) => i).filter(i => !data.items[i].locked)
  if (!unlockedIndexes.length) {
    return NextResponse.json({ items: data.items, warnings: ['Every item is locked — nothing to regenerate.'] })
  }

  const slots = unlockedIndexes.map(i => ({ category: data.items[i].category, price: data.items[i].price, priceLevel: 'existing price point' }))

  const prompt = buildTipMenuContentPrompt({
    persona: data.persona,
    tone: [],
    showEnergy: data.showEnergy,
    roomGoal: data.roomGoal,
    platform: data.platform,
    displayName: '',
    ctaPrimary: data.roomGoal,
    disclaimer: data.disclaimer,
    slots,
    style: data.style,
  })

  const warnings = []
  let aiResult
  try {
    aiResult = await generateStructuredContent({
      prompt,
      schema: TIP_MENU_CONTENT_OUTPUT_SCHEMA,
      maxTokens: Math.min(6000, 600 + slots.length * 140),
    })
  } catch (err) {
    aiResult = null
    warnings.push('Regeneration had an issue — used safe default wording for the unlocked items.')
  }

  const aiItems = Array.isArray(aiResult?.items) ? aiResult.items : []

  const items = data.items.map((item, i) => {
    if (item.locked) return item
    const slotIdx = unlockedIndexes.indexOf(i)
    const candidate = aiItems[slotIdx]
    let name = candidate?.name?.trim()
    let description = candidate?.description?.trim()

    const violatesText = !name || !description || violatesBoundaries(`${name} ${description}`, data.neverInclude)
    if (violatesText) {
      const fallback = cannedItemText(item.category)
      name = fallback.name
      description = fallback.description
    }

    return { ...item, name, description }
  })

  return NextResponse.json({ items, warnings })
}
