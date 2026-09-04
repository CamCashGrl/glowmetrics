// ============================================================================
// PRO PLATFORM ENTITLEMENT
//
// A Pro subscription entitles one platform to full history and gives the
// second platform a rolling 31-day window. This module answers the five
// questions the rest of the app needs, and nothing else:
//
//   which platform is the full-Pro one?
//   which platform has the rolling window?
//   where does that window currently start?
//   what is the newest eligible date for that platform?
//   is a given record inside or outside the entitled window?
//
// WHAT THIS IS NOT
//   - not a second subscription system: `plan` / `plan_expires_at` on
//     `profiles` remain the single source of truth for whether Pro is active,
//     read through the existing isProPlan()
//   - not a retention policy: it decides what may be ANALYSED, never what is
//     stored. No caller may delete or mutate a tip because of it
//   - not an analytics change: it computes no metric and no threshold
//
// NO PLATFORM IS HARDCODED. The primary is the creator's stored choice when
// she has made one, and otherwise the platform with the most eligible data —
// a deterministic default derived from her own imports. Names are canonical
// (lib/constants.js canonicalPlatform), so 'BC' and 'BongaCams' are one
// platform here exactly as they are everywhere else.
// ============================================================================

import { canonicalPlatform } from './constants'
import { isProPlan } from './plan'

/** Rolling window length for the second platform, in calendar days inclusive. */
export const SECONDARY_WINDOW_DAYS = 31

/** The offset that makes the window 31 days INCLUSIVE of its latest day. */
const WINDOW_OFFSET_DAYS = SECONDARY_WINDOW_DAYS - 1

const DAY_MS = 86400000

/** Midnight UTC for a date, so a window boundary is a whole day, not a time. */
function startOfUtcDay(value) {
  // null/undefined/'' must return null, NOT the epoch. `new Date(null)` is a
  // VALID date (1970-01-01), so a bare NaN check lets an absent date through:
  // a Pro account with only one platform would then get a real-looking
  // secondaryWindowStart of 1969-12-02 instead of "no second platform".
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * window_start = latest_eligible_date - 30 days, floored to the day.
 * A true rolling window: it moves with the creator's newest eligible record
 * for that platform, never with the calendar month and never with an upload
 * count. Exported so the rule is testable on its own.
 *
 * @param {Date|string|null} latestEligibleDate
 * @returns {Date|null}
 */
export function rollingWindowStart(latestEligibleDate) {
  const latest = startOfUtcDay(latestEligibleDate)
  if (!latest) return null
  return new Date(latest.getTime() - WINDOW_OFFSET_DAYS * DAY_MS)
}

/**
 * Per-platform totals from raw rows, used only to rank platforms and to find
 * each one's newest date. Counting rows is not an analytics metric and this
 * deliberately reuses no engine figure — it must work on any row list.
 *
 * @param {Array<{platform?:string, date_time?:string, dateRaw?:string}>} rows
 * @returns {Map<string, {platform:string, records:number, latest:Date|null}>}
 */
export function summarizePlatforms(rows = []) {
  const out = new Map()
  for (const row of rows) {
    const platform = canonicalPlatform(row?.platform)
    if (!platform || platform === 'Unknown') continue
    const when = startOfUtcDay(row?.date_time || row?.dateRaw)
    const entry = out.get(platform) || { platform, records: 0, latest: null }
    entry.records += 1
    if (when && (!entry.latest || when > entry.latest)) entry.latest = when
    out.set(platform, entry)
  }
  return out
}

/**
 * Rank platforms for entitlement. Most eligible records first; the platform
 * with the newer data breaks a tie, then the name, so the order is stable
 * across renders and never depends on import order.
 */
function rankPlatforms(summary) {
  return [...summary.values()].sort((a, b) =>
    b.records - a.records ||
    (b.latest?.getTime() || 0) - (a.latest?.getTime() || 0) ||
    a.platform.localeCompare(b.platform)
  )
}

/**
 * Resolve the full entitlement for one creator.
 *
 * @param {Object} args
 * @param {Object} args.profile - the profiles row (plan, plan_expires_at,
 *                                primary_pro_platform)
 * @param {Array}  [args.rows]  - the creator's tip rows
 * @param {Map}    [args.summary] - or a pre-built summarizePlatforms() result
 * @returns {{
 *   isPro: boolean,
 *   primary: string|null,
 *   secondary: string|null,
 *   others: string[],
 *   windowDays: number,
 *   secondaryLatestEligible: Date|null,
 *   secondaryWindowStart: Date|null,
 *   platforms: Array<{platform:string, tier:'full'|'rolling'|'none', windowStart:Date|null, latest:Date|null, records:number}>
 * }}
 */
export function resolvePlatformEntitlement({ profile = null, rows = null, summary = null } = {}) {
  const isPro = isProPlan(profile || {})
  const stats = summary || summarizePlatforms(rows || [])
  const ranked = rankPlatforms(stats)

  // The creator's stored choice wins, but only if she actually has data on it
  // — a stale choice must never entitle a platform she no longer imports, and
  // must never leave her with no primary at all.
  const stored = canonicalPlatform(profile?.primary_pro_platform || '')
  const storedIsEligible = stored && stored !== 'Unknown' && stats.has(stored)
  const primaryEntry = storedIsEligible ? stats.get(stored) : ranked[0] || null
  const primary = primaryEntry?.platform || null

  const secondaryEntry = ranked.find(p => p.platform !== primary) || null
  const secondary = secondaryEntry?.platform || null

  // Third and beyond are NOT entitled. The rolling window belongs to exactly
  // one platform; letting it spread would hand out unlimited platforms.
  const others = ranked
    .filter(p => p.platform !== primary && p.platform !== secondary)
    .map(p => p.platform)

  const secondaryLatestEligible = secondaryEntry?.latest || null
  const secondaryWindowStart = isPro ? rollingWindowStart(secondaryLatestEligible) : null

  const platforms = ranked.map(p => ({
    platform: p.platform,
    records: p.records,
    latest: p.latest,
    tier: !isPro ? 'none' : p.platform === primary ? 'full' : p.platform === secondary ? 'rolling' : 'none',
    windowStart: isPro && p.platform === secondary ? secondaryWindowStart : null,
  }))

  return {
    isPro,
    primary,
    secondary,
    others,
    windowDays: SECONDARY_WINDOW_DAYS,
    secondaryLatestEligible,
    secondaryWindowStart,
    platforms,
  }
}

/**
 * Is one record inside the creator's entitled analytics window?
 *
 * Free plans are untouched by this module: it returns true for everything, so
 * enforcing it somewhere new can never silently change what a free creator
 * sees. Pro: the primary platform is always in; the secondary is in only from
 * its rolling window start onward; anything else is out.
 *
 * A false answer means "do not include this row in entitled analytics". It
 * never means "delete this row".
 *
 * @param {Object} entitlement - resolvePlatformEntitlement() output
 * @param {string} platform    - raw or canonical platform name
 * @param {Date|string} date
 * @returns {boolean}
 */
export function isWithinEntitlement(entitlement, platform, date) {
  if (!entitlement?.isPro) return true
  const name = canonicalPlatform(platform)
  if (!name || name === 'Unknown') return false
  if (name === entitlement.primary) return true
  if (name !== entitlement.secondary) return false
  const start = entitlement.secondaryWindowStart
  const day = startOfUtcDay(date)
  if (!start || !day) return false
  return day.getTime() >= start.getTime()
}

/**
 * The entitled subset of rows. Returns a NEW array — the input is never
 * mutated, and nothing is deleted anywhere.
 */
export function filterEntitledRows(entitlement, rows = []) {
  if (!entitlement?.isPro) return [...rows]
  return rows.filter(r => isWithinEntitlement(entitlement, r?.platform, r?.date_time || r?.dateRaw))
}
