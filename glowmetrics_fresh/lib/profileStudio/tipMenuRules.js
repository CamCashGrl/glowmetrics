// ============================================================
// CREATOR PROFILE STUDIO — TIP MENU VALIDATION & SMART REVIEW
// Server-side only.
// ============================================================

import { z } from 'zod'
import {
  TIP_MENU_PLATFORMS, CURRENCY_TYPES, SHOW_ENERGY_OPTIONS, ROOM_GOAL_OPTIONS,
  COMFORT_LEVELS, TIP_MENU_CATEGORIES, PRICING_STRATEGIES, MENU_ITEM_COUNTS, MENU_STYLES,
} from './constants'

const CURRENCY_IDS = CURRENCY_TYPES.map(c => c.id)
const COMFORT_IDS = COMFORT_LEVELS.map(c => c.id)
const STRATEGY_IDS = PRICING_STRATEGIES.map(s => s.id)
const STYLE_IDS = MENU_STYLES.map(s => s.id)

export const TipMenuBoundariesSchema = z.object({
  neverInclude: z.array(z.string().trim().max(80)).max(30).default([]),
  privateOnly: z.array(z.string().trim().max(80)).max(30).default([]),
  amountGated: z.array(z.string().trim().max(80)).max(30).default([]),
  requireApproval: z.boolean().default(true),
  maxIntensity: z.enum(['mild', 'moderate', 'high']).default('moderate'),
  countdownsAllowed: z.boolean().default(true),
  tipsStack: z.boolean().default(true),
  oneUserControl: z.boolean().default(false),
  refundable: z.boolean().default(false),
  disclaimer: z.string().trim().max(300).optional().default(''),
})

export const TipMenuGenerateRequestSchema = z.object({
  platform: z.enum(TIP_MENU_PLATFORMS),
  currencyType: z.enum(CURRENCY_IDS).default('tokens'),
  tokenValue: z.number().positive().max(10).default(0.05),
  privateShowPrice: z.number().nonnegative().max(100000).optional(),
  averageTip: z.number().nonnegative().max(100000).optional(),
  earningsGoalPerHour: z.number().nonnegative().max(1000000).optional(),

  persona: z.array(z.string().max(40)).max(30).default([]),
  showEnergy: z.enum(SHOW_ENERGY_OPTIONS).default('Playful'),
  roomGoal: z.enum(ROOM_GOAL_OPTIONS).default('More small tips'),
  comfortLevel: z.enum(COMFORT_IDS).default('moderate'),

  categories: z.array(z.enum(TIP_MENU_CATEGORIES)).min(1).max(TIP_MENU_CATEGORIES.length),
  customCategories: z.array(z.string().trim().max(40)).max(10).default([]),

  boundaries: TipMenuBoundariesSchema.default({}),

  strategy: z.enum(STRATEGY_IDS).default('balanced'),
  minPrice: z.number().positive().max(1000000),
  maxPrice: z.number().positive().max(10000000),
  itemCount: z.number().int().refine(n => MENU_ITEM_COUNTS.includes(n), 'itemCount must be 10, 15, 20, or 30'),
  style: z.enum(STYLE_IDS).default('balanced'),

  hideEarningsFromCustomer: z.boolean().default(false),
}).refine(d => d.maxPrice > d.minPrice, { message: 'maxPrice must be greater than minPrice', path: ['maxPrice'] })

// ── Boundary enforcement ─────────────────────────────────────────────────
// The generator must never suggest an excluded activity. This is checked
// against every candidate item name+description before it's ever returned.
export function violatesBoundaries(itemText, neverInclude = []) {
  const haystack = itemText.toLowerCase()
  return neverInclude.some(term => {
    const t = term.trim().toLowerCase()
    return t.length > 0 && haystack.includes(t)
  })
}

// ── Deterministic copy fallback ──────────────────────────────────────────
// Used when the AI response doesn't line up 1:1 with the priced slots, or
// when generated text trips a boundary check — the price/category structure
// is never allowed to fail just because the copy did.
const CANNED_ITEM_TEXT = {
  'Greetings and attention': { name: 'Say Hello', description: 'A personal hello and a shoutout to your name in chat.' },
  'Reactions': { name: 'Reaction Tip', description: 'Pick something for me to react to on stream.' },
  'Compliments': { name: 'Compliment Round', description: 'I will give you a genuine compliment on stream.' },
  'Outfit actions': { name: 'Outfit Change', description: 'A quick outfit change just for this tip.' },
  'Dancing': { name: 'Dance Break', description: 'A short dance to a song of your choice.' },
  'Poses': { name: 'Pose Request', description: 'Strike a pose you pick.' },
  'Toy actions': { name: 'Toy Moment', description: 'A toy action tied to this tip amount.' },
  'Lovense levels': { name: 'Lovense Level Up', description: 'Bumps my interactive toy up a level for a bit.' },
  'Games': { name: 'Mini Game', description: 'Play a quick game with me on stream.' },
  'Spin wheel': { name: 'Spin the Wheel', description: 'Spin my wheel for a random fun outcome.' },
  'Roll the dice': { name: 'Roll the Dice', description: 'Roll the dice for a surprise result.' },
  'Goals': { name: 'Goal Contribution', description: 'Adds toward my current room goal.' },
  'Roleplay': { name: 'Roleplay Moment', description: 'A short roleplay scene based on this tip.' },
  'Dominant commands': { name: 'Give Me a Command', description: 'You give the direction for this moment.' },
  'Submissive actions': { name: 'Follow a Command', description: 'I follow a command within my limits.' },
  'Private show prompts': { name: 'Private Show Interest', description: 'A nudge toward booking a private show with me.' },
  'Fan club promotion': { name: 'Fan Club Shoutout', description: 'A reminder about what my fan club includes.' },
  'Social promotion': { name: 'Follow My Socials', description: 'A shoutout reminding you to follow my other pages.' },
  'Custom requests': { name: 'Custom Request', description: 'Send a custom request for me to review and approve.' },
  'Non-nude activities': { name: 'Fun Non-Nude Moment', description: 'A playful non-nude activity for this tip.' },
}

export function cannedItemText(category) {
  return CANNED_ITEM_TEXT[category] || { name: category, description: `A ${category.toLowerCase()} moment for this tip.` }
}

// ── Smart menu review ────────────────────────────────────────────────────
// Fully deterministic (no AI) so recommendations are explainable and
// reproducible from the same item list.
function wordOverlap(a, b) {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  if (!setA.size || !setB.size) return 0
  let shared = 0
  for (const w of setA) if (setB.has(w)) shared++
  return shared / Math.min(setA.size, setB.size)
}

export function reviewTipMenu(items, { boundaries = {}, minPrice, maxPrice } = {}) {
  const issues = []
  const recommendations = []
  const prices = items.map(i => i.price).sort((a, b) => a - b)
  const lowCap = prices[Math.floor(prices.length * 0.33)] ?? prices[0]
  const highCap = prices[Math.floor(prices.length * 0.66)] ?? prices[prices.length - 1]

  const lowCount = items.filter(i => i.price <= lowCap).length
  const highCount = items.filter(i => i.price >= highCap).length

  if (items.length && lowCount / items.length > 0.7) {
    issues.push('Too many low-priced items compared to mid and premium tips.')
    recommendations.push('Consider moving a couple of low-cost items up a price tier to balance the menu.')
  }
  if (items.length && highCount / items.length > 0.5) {
    issues.push('Too many expensive items — this may feel intimidating for smaller tippers.')
    recommendations.push('Add a few more easy, low-cost entry tips so new viewers have somewhere to start.')
  }

  const cheapest = prices[0]
  if (cheapest == null || cheapest > (minPrice ?? cheapest) * 3) {
    issues.push('Your menu has no clear low-cost engagement option.')
    recommendations.push('Add at least one tip near your minimum price so viewers can participate without spending much.')
  }
  const priciest = prices[prices.length - 1]
  if (priciest == null || (maxPrice && priciest < maxPrice * 0.5)) {
    issues.push('Missing a premium item — nothing takes advantage of your higher-spending viewers.')
    recommendations.push('Add one or two premium or goal-based items near your maximum price.')
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const overlap = wordOverlap(`${items[i].name} ${items[i].description}`, `${items[j].name} ${items[j].description}`)
      if (overlap > 0.6) {
        issues.push(`"${items[i].name}" and "${items[j].name}" are too similar.`)
        recommendations.push(`Consider merging or differentiating "${items[i].name}" and "${items[j].name}".`)
      }
    }
  }

  for (const item of items) {
    const isLongOrIntense = (item.durationSeconds && item.durationSeconds > 180) || item.price >= highCap
    if (isLongOrIntense && item.visibility === 'public') {
      recommendations.push(`"${item.name}" may work better as a private-only request given its price or duration.`)
    }
    if (item.price <= lowCap && item.durationSeconds && item.durationSeconds > 120 && item.cooldownMinutes == null) {
      recommendations.push(`"${item.name}" may be underpriced compared with its duration — consider a cooldown or a higher price.`)
    }
  }

  if (!boundaries.disclaimer) {
    issues.push('No custom request disclaimer set.')
    recommendations.push('Add a short disclaimer explaining how custom requests are approved and priced.')
  }
  if (items.length < 8) {
    issues.push('Menu is short — viewers have few options to choose from.')
  }
  if (items.length > 35) {
    issues.push('Menu is very long — consider trimming to keep it easy to scan.')
    recommendations.push('Consider limiting the menu to your most requested 20-30 items.')
  }

  const estimatedEarningPotential = Math.round(
    items.reduce((sum, i) => sum + (i.estimatedEarnings || 0), 0) * 100
  ) / 100

  let score = 100
  score -= issues.length * 6
  score = Math.max(40, Math.min(100, score))

  return {
    score,
    issues: [...new Set(issues)],
    recommendations: [...new Set(recommendations)],
    estimatedEarningPotential,
  }
}
