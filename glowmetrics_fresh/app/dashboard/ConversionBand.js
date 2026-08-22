'use client'
// ============================================================
// CAMCASH — DASHBOARD CONVERSION LAYER
//
// The post-import result screen (app/dashboard/ImportResult.js) explains what
// Free can see, what CamCash already found, and what Pro unlocks. That
// explanation used to die the moment the creator clicked "View Dashboard" —
// the Command Center said nothing about the history sitting one plan tier
// away, so the strongest moment in the funnel had no follow-through.
//
// This is the follow-through, and deliberately nothing more. It is NOT a
// dashboard redesign and NOT a generic upgrade banner: it renders AT MOST ONE
// band, only when a real, measured condition is true for this creator, and it
// renders nothing at all for Pro.
//
// Three conditions, in priority order:
//
//   1. lockedHistory  — rows exist in the database beyond the Free window
//   2. platformCap    — all Free platform slots are in use
//   3. sparseRecent   — the Free window is thin but the history behind it is not
//
// EVERY number rendered here is measured by the caller from rows already
// loaded (see buildConversionContext in app/dashboard/page.js), using the
// canonical splitFreeHistory() boundary. This component computes nothing and
// invents nothing — if the caller cannot support a claim, it passes no
// context and no band renders.
// ============================================================

import { UnlockButton } from './components/LockedModule'
import { PRO_PRICE_MONTHLY_LABEL, PRO_PRICE_NOTE } from '../../lib/constants'

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtInt = (n) => Number(n || 0).toLocaleString()

// Conversion-measurement seam (Phase 13). Every surface carries a stable
// `data-cc-surface` so an impression/click can be attributed later without
// re-deriving which band the creator actually saw. No tracking table, no new
// analytics system — just a durable hook on the markup.
export default function ConversionBand({
  C, context, isPro, freeHistoryDays, freeMaxPlatforms, formatDate, onUpgrade,
}) {
  if (isPro || !context) return null

  const { lockedHistory, platformCap, sparseRecent } = context

  // Priority: the creator's own locked earnings beat a structural limit, and a
  // structural limit beats a "you're quiet lately" observation. Only one band
  // is ever shown — stacking all three is the generic-banner failure mode.
  const band = lockedHistory
    ? {
        key: 'locked_history',
        source: 'dashboard_locked_history',
        accent: C.green,
        glow: 'linear-gradient(115deg,rgba(16,185,129,0.11),rgba(34,211,238,0.07))',
        border: 'rgba(16,185,129,0.28)',
        label: 'Your unlocked potential',
        // The creator's own measured figure leads. It was previously buried
        // mid-sentence, where the single most persuasive number we have read
        // as a supporting detail.
        value: fmtUsd(lockedHistory.totalUsd),
        title: 'additional earnings history already saved',
        body: (
          <>
            {fmtInt(lockedHistory.tips)} tips beyond your Free {freeHistoryDays}-day window
            {lockedHistory.dateFrom && lockedHistory.dateTo ? (
              <> ({formatDate(lockedHistory.dateFrom)} – {formatDate(lockedHistory.dateTo)})</>
            ) : null}
            . Already saved — no re-upload needed.
          </>
        ),
        cta: 'Unlock Full History →',
      }
    : platformCap
    ? {
        key: 'platform_cap',
        source: 'dashboard_platform_cap',
        accent: C.cyan,
        glow: 'linear-gradient(115deg,rgba(34,211,238,0.10),rgba(124,92,255,0.08))',
        border: 'rgba(34,211,238,0.26)',
        label: 'Platform limit reached',
        title: `You're using all ${freeMaxPlatforms} Free platform slots`,
        body: (
          <>
            Pro unlocks additional platform analysis and cross-platform intelligence — so you can
            see where you actually earn best across {platformCap.platforms.join(', ')} and beyond.
          </>
        ),
        cta: 'Compare More Platforms →',
      }
    : sparseRecent
    ? {
        key: 'sparse_recent',
        source: 'dashboard_sparse_recent',
        accent: C.indigo,
        glow: 'linear-gradient(115deg,rgba(124,92,255,0.10),rgba(236,72,153,0.07))',
        border: 'rgba(124,92,255,0.26)',
        label: 'Recent activity is light',
        title: 'Your history contains more data',
        body: (
          <>
            Your most recent {freeHistoryDays} days per platform hold {fmtInt(sparseRecent.tips)} tip
            {sparseRecent.tips === 1 ? '' : 's'} — real, saved, and counted. There&apos;s more in
            your history that can reveal stronger patterns than this window alone.
          </>
        ),
        cta: 'Explore your history →',
      }
    : null

  if (!band) return null

  // Compact by design. This sits above the Command Center, which is the
  // creator's daily briefing — a second full-height hero card there would
  // bury the product under its own upsell. One label, one number, one line,
  // one CTA.
  return (
    <div
      className="cc-band"
      data-cc-surface={band.source}
      style={{
        borderRadius: 14, marginBottom: 18,
        background: band.glow, border: `1px solid ${band.border}`,
      }}
    >
      <div className="cc-band-copy">
        <div className="cc-band-label" style={{ color: band.accent }}>{band.label}</div>
        {band.value && (
          <div className="cc-band-value" style={{ color: band.accent }}>{band.value}</div>
        )}
        <div className="cc-band-title" style={{ color: C.white }}>{band.title}</div>
        <div className="cc-band-body" style={{ color: C.text }}>{band.body}</div>
      </div>
      <div className="cc-band-action">
        <UnlockButton surface={band.source} onClick={() => onUpgrade?.(band.source)}>
          {band.cta.replace(/\s*\u2192\s*$/, '')}
        </UnlockButton>
        <div className="cc-band-price" style={{ color: C.muted }}>
          {PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}
        </div>
      </div>
    </div>
  )
}
