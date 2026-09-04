'use client'
// ═══════════════════════════════════════════════════════════════════════════
// UNIMPORTED PLATFORMS — conversion built on something she actually told us.
//
// Onboarding asks the creator to name every platform she streams on. That
// answer lets the dashboard tell apart two states it previously conflated:
//
//   "she does not stream there"        → say nothing
//   "she streams there, no data yet"   → a gap worth naming
//
// The second is the honest conversion moment on this product. It does not
// invent a benefit or promise an outcome: it states a gap she described
// herself, and what CamCash cannot currently answer because of it. A creator
// who streams on three sites and has imported one is not seeing her business,
// and saying so is a fact, not a pitch.
//
// It claims NOTHING about the missing platforms — no projected earnings, no
// "you're probably leaving money on the table". There is no data behind those
// sentences, which is exactly why they are absent.
//
// Renders nothing when the roster is unknown (the column is not migrated yet,
// or she onboarded before it existed), or when everything she named is in.
// ═══════════════════════════════════════════════════════════════════════════

import { C, panel, GRADIENT } from './theme'

export default function UnimportedPlatforms({
  analytics,
  streamingPlatforms = null,
  isPro = false,
  onImport,
  onUpgrade,
}) {
  if (!Array.isArray(streamingPlatforms) || !streamingPlatforms.length) return null

  const imported = new Set(
    (analytics?.platforms || [])
      .filter(p => p.platform && p.platform.toLowerCase() !== 'unknown')
      .map(p => p.platform.toLowerCase())
  )
  const missing = streamingPlatforms.filter(p => p && !imported.has(String(p).toLowerCase()))
  if (!missing.length) return null

  const named = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`
  const importedCount = imported.size

  return (
    <div style={{ ...panel, padding: 22, borderColor: 'rgba(124,92,255,0.32)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.indigo, marginBottom: 8 }}>
        Missing from your picture
      </div>

      <div style={{ fontSize: 19, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 10 }}>
        You stream on {named} — CamCash has nothing from {missing.length > 1 ? 'them' : 'it'} yet
      </div>

      <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, maxWidth: 620, marginBottom: 16 }}>
        {importedCount > 0 ? (
          <>
            Every figure on your dashboard is drawn from {importedCount === 1 ? 'one platform' : `${importedCount} platforms`}.
            Until {missing.length > 1 ? 'these are' : 'this is'} imported, CamCash cannot tell you which platform pays you
            best per hour, or whether your best window holds across all of them — it can only describe the part it can see.
          </>
        ) : (
          <>You named the platforms you work, but no tip history has landed yet. Import any one of them and the first pattern appears.</>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {missing.map(p => (
          <span key={p} style={{
            fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 100,
            background: C.card2, border: `1px solid ${C.border2}`, color: C.text,
          }}>{p} · no data</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {onImport && (
          <button onClick={onImport} style={{
            padding: '12px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
            background: GRADIENT, color: '#06101A', fontSize: 13.5, fontWeight: 850,
            boxShadow: '0 10px 30px rgba(124,92,255,0.28)',
          }}>Import {missing[0]} →</button>
        )}
        {/* The upgrade is offered only where Pro is genuinely the thing that
            unlocks the answer: comparing platforms against each other. */}
        {!isPro && missing.length > 0 && importedCount > 0 && onUpgrade && (
          <button onClick={() => onUpgrade('platform_comparison')} style={{
            padding: '12px 20px', borderRadius: 100, cursor: 'pointer',
            background: C.card2, border: `1px solid ${C.border2}`, color: C.white,
            fontSize: 13, fontWeight: 700,
          }}>Compare my platforms</button>
        )}
      </div>
    </div>
  )
}
