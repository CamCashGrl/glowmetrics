'use client'
// ═══════════════════════════════════════════════════════════════════════════
// FREE TIER NOTICE — one dismissible line, not a wall.
//
// It states what the free plan actually gives her right now, in her own
// numbers, and it can be closed. Dismissal is remembered per browser so it
// does not reappear on every visit and become the thing she learns to ignore.
//
// It makes no claim about what Pro would earn her. It names the shape of the
// sample she is seeing — full depth on her top few supporters, basics on the
// rest — because that is a fact about the product, not a projection about her.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { C, GRADIENT } from './theme'

const KEY = 'camcash_free_notice_dismissed'

export default function FreeTierNotice({ isPro = false, fanCount = 0, sampleCount = 3, onUpgrade }) {
  // Starts hidden and reveals after the stored flag is read, so a dismissed
  // notice never flashes on the way in.
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isPro) return
    try { if (localStorage.getItem(KEY) !== '1') setShow(true) }
    catch { setShow(true) }   // private mode: show it rather than swallow it
  }, [isPro])

  if (isPro || !show) return null

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(KEY, '1') } catch { /* nothing to remember, fine */ }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '12px 14px', borderRadius: 14, marginBottom: 14,
      background: 'rgba(15,20,32,0.75)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(124,92,255,0.30)',
      boxShadow: '0 0 30px rgba(124,92,255,0.10)',
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true">✨</span>

      <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
        You&apos;re on the free plan — all{' '}
        <strong style={{ color: C.white }}>{Number(fanCount || 0).toLocaleString()}</strong> of your
        supporters are here, with full timing insight on your top{' '}
        <strong style={{ color: C.white }}>{sampleCount}</strong>. Pro opens that depth for every fan.
      </div>

      {onUpgrade && (
        <button onClick={() => onUpgrade('free_tier_notice')} style={{
          flexShrink: 0, padding: '8px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
          background: GRADIENT, color: '#06101A', fontSize: 12, fontWeight: 850,
        }}>See what Pro adds</button>
      )}

      <button onClick={dismiss} aria-label="Dismiss this notice" style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
        background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
        color: C.muted, fontSize: 13, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  )
}
