'use client'

// ════════════════════════════════════════════════════════════════════════
// THE EXTENSION OFFER — introduced at Creator Pro, never before it.
//
// This used to be a standalone install step at the END of onboarding, before
// the creator had seen a single number of their own, with the CTA "Install
// Live Tracker — it's free". Two things were wrong with that placement:
//
//   1. Live Mode is Pro-only and server-enforced (lib/liveSession/
//      entitlement.js, check_live_mode_pro_entitlement, and the
//      live_sessions INSERT trigger). A Free creator who installed it got an
//      extension feeding a session the database would refuse to create.
//   2. A browser-extension install does nothing until the creator actually
//      streams — possibly days later — so the highest-friction ask sat at
//      the lowest-intent moment, in front of the dashboard.
//
// It now appears only once the creator genuinely HAS Pro access, and again
// on the Live Mode surface where intent is highest.
//
// THE EXTENSION IS OPTIONAL, AND THIS COMPONENT MUST KEEP SAYING SO.
// send_website_heartbeat() starts and sustains a session on its own — see
// 20260802g_website_heartbeat_also_starts_session.sql, which fixed exactly
// the bug where the extension was treated as a requirement and creators
// without it were stuck on "Waiting for extension to connect..." forever.
// The extension is an auto-tip-capture enhancement. Never a gate.
// ════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import Button from '../../components/ui/Button'
import { track } from '../../lib/track'

export const EXTENSION_DISMISS_KEY = 'camcash_extension_offer_dismissed'

export function isExtensionOfferDismissed() {
  try { return localStorage.getItem(EXTENSION_DISMISS_KEY) === '1' } catch (_) { return false }
}

/**
 * @param {object}   C        dashboard palette (passed in so this file does
 *                            not fork a second set of brand colours)
 * @param {boolean}  isPro    hard guard: the offer never renders for Free,
 *                            so it can never imply Live Mode is available
 * @param {'success'|'reminder'} variant
 * @param {function} onDismiss
 */
export default function ExtensionOffer({ C, isPro = false, variant = 'success', onDismiss }) {
  const [gone, setGone] = useState(false)

  // Belt and braces alongside the caller's own gate. A Free creator must
  // never see an extension pitch, because the extension only does anything
  // through Live Mode and Live Mode is refused for them at the database.
  if (!isPro || gone) return null

  const dismiss = () => {
    setGone(true)
    try { localStorage.setItem(EXTENSION_DISMISS_KEY, '1') } catch (_) {}
    track('extension_offer_dismissed', { variant })
    onDismiss?.()
  }

  const isSuccess = variant === 'success'

  return (
    <div
      data-testid="extension-offer"
      style={{
        borderRadius: 16,
        padding: isSuccess ? '22px 24px' : '16px 18px',
        marginBottom: 20,
        background: isSuccess
          ? 'linear-gradient(115deg, rgba(33,230,243,0.10), rgba(108,92,255,0.08))'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSuccess ? 'rgba(33,230,243,0.28)' : C.border}`,
      }}
    >
      <div style={{ fontSize: isSuccess ? 16 : 14, fontWeight: 800, color: C.white, marginBottom: 7 }}>
        {isSuccess ? "You're on Creator Pro — one last thing." : 'Capture tips automatically while you stream'}
      </div>

      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 8 }}>
        Add the CamCash extension to capture tips automatically while you stream, so your
        coaching can react in real time instead of waiting for your next import.
      </div>

      {/* The optionality is part of the offer, not a footnote we can drop.
          See the header: the website heartbeat runs Live Mode on its own. */}
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
        Optional: Live Mode works without the extension. The extension simply makes automatic
        tip capture easier.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          as="a"
          href="/camcash-extension.zip"
          download="camcash-extension.zip"
          onClick={() => track('extension_download_clicked', { source_page: `dashboard:${variant}` })}
          style={{ minHeight: 44, padding: '12px 22px', fontSize: 14 }}
        >
          Add the extension →
        </Button>
        <Button
          variant="secondary"
          onClick={dismiss}
          style={{ minHeight: 44, padding: '12px 20px', fontSize: 14 }}
        >
          Maybe later
        </Button>
      </div>
    </div>
  )
}
