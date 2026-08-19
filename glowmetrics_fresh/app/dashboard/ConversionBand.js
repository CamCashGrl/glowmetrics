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

import Button from '../../components/ui/Button'
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
        glow: 'linear-gradient(115deg,rgba(16,185,129,0.11),rgba(34,211,238,0.08))',
        border: 'rgba(16,185,129,0.28)',
        label: 'Historical value available',
        title: 'Your history contains more insight',
        body: (
          <>
            We found additional historical patterns beyond your Free {freeHistoryDays}-day window
            (counted per platform) —{' '}
            <strong style={{ color: C.green }}>{fmtUsd(lockedHistory.totalUsd)}</strong> across{' '}
            <strong style={{ color: C.cyan }}>{fmtInt(lockedHistory.tips)}</strong> tips
            {lockedHistory.dateFrom && lockedHistory.dateTo ? (
              <> from {formatDate(lockedHistory.dateFrom)} – {formatDate(lockedHistory.dateTo)}</>
            ) : null}
            . It&apos;s already saved — no re-upload needed.
          </>
        ),
        cta: 'See what Pro unlocks →',
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

  return (
    <div
      className="cc-band"
      data-cc-surface={band.source}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 22, flexWrap: 'wrap', padding: '20px 24px', borderRadius: 18,
        background: band.glow, border: `1px solid ${band.border}`, marginBottom: 18,
      }}
    >
      <div style={{ minWidth: 260, flex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 900, letterSpacing: '0.10em', textTransform: 'uppercase',
          color: band.accent, marginBottom: 6,
        }}>
          {band.label}
        </div>
        <div style={{ fontSize: 16.5, fontWeight: 800, color: C.white, letterSpacing: '-0.015em' }}>
          {band.title}
        </div>
        <div style={{ fontSize: 13.5, color: C.text, marginTop: 7, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
          {band.body}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 0 }}>
        <Button
          data-cc-action={`upgrade_cta:${band.source}`}
          onClick={() => onUpgrade?.(band.source)}
          style={{ padding: '13px 24px', fontSize: 14.5, borderRadius: 12, whiteSpace: 'nowrap' }}
        >
          {band.cta}
        </Button>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 7, whiteSpace: 'nowrap' }}>
          {PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}
        </div>
      </div>
    </div>
  )
}
