// ============================================================
// CREATOR PROFILE STUDIO — DETERMINISTIC TIP MENU PRICING ENGINE
// Prices are computed here, deterministically, from the creator's stated
// strategy/min/max/goal — never left to the AI. The AI (see prompts.js) is
// only ever asked to write the name/description text for a price+category
// slot this engine has already decided; it cannot invent or move a price.
// ============================================================

// Share of items at each price level, by strategy. Every strategy still
// guarantees at least one low-cost and one premium/high-value slot below,
// so "custom" (user hasn't picked a lean yet) defaults to the same curve
// as "balanced".
const STRATEGY_WEIGHTS = {
  budget:   { low: 0.50, mid: 0.35, premium: 0.12, high_value: 0.03 },
  balanced: { low: 0.35, mid: 0.35, premium: 0.20, high_value: 0.10 },
  premium:  { low: 0.15, mid: 0.30, premium: 0.35, high_value: 0.20 },
  luxury:   { low: 0.10, mid: 0.20, premium: 0.30, high_value: 0.40 },
  custom:   { low: 0.35, mid: 0.35, premium: 0.20, high_value: 0.10 },
}

const LEVEL_BAND = {
  low: [0, 0.15],
  mid: [0.15, 0.45],
  premium: [0.45, 0.75],
  high_value: [0.75, 1],
}

function roundPrice(value, currencyType) {
  if (currencyType === 'dollars' || currencyType === 'custom') {
    if (value < 10) return Math.max(1, Math.round(value))
    return Math.round(value / 5) * 5
  }
  // tokens / credits
  if (value < 50) return Math.max(5, Math.round(value / 5) * 5)
  if (value < 200) return Math.round(value / 10) * 10
  return Math.round(value / 25) * 25
}

/**
 * Builds `itemCount` price+category slots. No text yet — that's filled in
 * separately (AI-assisted, with a deterministic fallback) so a price is
 * never a function of anything the AI generates.
 */
export function buildPricingSlots({ categories, itemCount, strategy, minPrice, maxPrice, currencyType }) {
  const weights = STRATEGY_WEIGHTS[strategy] || STRATEGY_WEIGHTS.balanced
  const levels = ['low', 'mid', 'premium', 'high_value']

  // Convert weights into integer slot counts that sum to itemCount, then
  // force at least one low-cost and one premium-or-higher slot so the menu
  // always has an entry point and a reason for big tippers to spend more.
  let counts = {}
  let allocated = 0
  for (const level of levels) {
    counts[level] = Math.round(weights[level] * itemCount)
    allocated += counts[level]
  }
  let diff = itemCount - allocated
  // fix rounding drift on the largest bucket
  const biggest = levels.reduce((a, b) => (counts[a] >= counts[b] ? a : b))
  counts[biggest] += diff

  if (counts.low === 0) { counts.low = 1; counts[biggest] = Math.max(0, counts[biggest] - 1) }
  if (counts.premium + counts.high_value === 0) {
    counts.premium = 1
    counts.mid = Math.max(0, counts.mid - 1)
  }

  const slots = []
  for (const level of levels) {
    const [bandLo, bandHi] = LEVEL_BAND[level]
    const priceLo = minPrice + bandLo * (maxPrice - minPrice)
    const priceHi = minPrice + bandHi * (maxPrice - minPrice)
    const n = counts[level]
    for (let i = 0; i < n; i++) {
      // Spread within the band instead of clustering at one value —
      // "pricing should not be random" but it also shouldn't be flat.
      const t = n === 1 ? 0.4 : i / (n - 1)
      const raw = priceLo + t * (priceHi - priceLo)
      slots.push({ priceLevel: level, price: roundPrice(raw, currencyType) })
    }
  }

  // Assign categories round-robin so items aren't clustered by category,
  // and rotate the starting category by level so, e.g., "low" doesn't
  // always start on the same category as "premium".
  const cats = categories.length ? categories : ['Custom requests']
  let catCursor = 0
  for (const slot of slots) {
    slot.category = cats[catCursor % cats.length]
    catCursor++
  }

  return slots.sort((a, b) => a.price - b.price)
}

export function estimateEarnings(price, currencyType, tokenValue) {
  if (currencyType === 'dollars') return Math.round(price * 100) / 100
  return Math.round(price * tokenValue * 100) / 100
}

// Categories that read as more intense/exclusive by nature — used as a
// deterministic fallback for visibility/cooldown suggestions before any
// AI text exists, and to bias which slots get a suggested duration.
export const INTENSE_CATEGORIES = new Set([
  'Dominant commands', 'Submissive actions', 'Toy actions', 'Lovense levels',
  'Roleplay', 'Private show prompts', 'Custom requests',
])

export const TIMED_CATEGORIES = new Set([
  'Dancing', 'Poses', 'Toy actions', 'Lovense levels', 'Roleplay', 'Outfit actions',
])

export function suggestVisibility(category, priceLevel, boundaries) {
  if (category === 'Custom requests' && boundaries?.requireApproval) return 'approval_required'
  if ((priceLevel === 'high_value' || priceLevel === 'premium') && INTENSE_CATEGORIES.has(category)) {
    return 'private_only'
  }
  return 'public'
}

export function suggestDuration(category, priceLevel) {
  if (!TIMED_CATEGORIES.has(category)) return null
  return priceLevel === 'low' ? 30 : priceLevel === 'mid' ? 60 : priceLevel === 'premium' ? 120 : 180
}

export function suggestCooldown(category, priceLevel) {
  if (INTENSE_CATEGORIES.has(category) && (priceLevel === 'premium' || priceLevel === 'high_value')) return 10
  return null
}
