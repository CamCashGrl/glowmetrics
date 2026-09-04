'use client'
// ═══════════════════════════════════════════════════════════════════════════
// UNLOCK PROGRESS — the body of the Creator Report.
//
// The report is not where findings live. It answers one question: what does
// CamCash still need in order to finish building this dashboard, and how far
// along is each piece? Every row is a locked capability with a real progress
// bar, and every row DISAPPEARS the moment it unlocks — the page gets shorter
// as she imports, and the unlock is announced in the Command Center.
//
// Per-platform cards do the same for imports: what has landed from each site,
// and whether it is enough for that platform to join the comparison.
//
// Every number is read from lib/unlockProgress.js, which itself reads the
// engine's nextMilestone. Nothing here computes a requirement.
// ═══════════════════════════════════════════════════════════════════════════

import { C, panel, GRADIENT } from './theme'

const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`

function Bar({ pct, color = C.cyan }) {
  return (
    <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.max(Math.min(pct || 0, 100), 2)}%`, height: '100%', borderRadius: 6,
        background: pct >= 100 ? C.green : GRADIENT,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

export default function UnlockProgress({
  locked = [],
  platforms = [],
  isPro = false,
  onImport,
}) {
  const everythingUnlocked = !locked.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── WHAT IS STILL LOCKED ─────────────────────────────────── */}
      <div style={{ ...panel, padding: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 3 }}>
          {everythingUnlocked ? 'Your dashboard is fully built' : 'Still building your dashboard'}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: everythingUnlocked ? 0 : 18, lineHeight: 1.6 }}>
          {everythingUnlocked
            ? 'Every pattern CamCash tracks has enough evidence behind it. New findings now appear in your Command Center.'
            : 'Each of these needs a little more history before CamCash will state it. They disappear from this page as they unlock.'}
        </div>

        {locked.map(cap => (
          <div key={cap.id} style={{
            padding: '14px 16px', borderRadius: 12, marginBottom: 10,
            background: C.card2, border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: C.white }}>{cap.title}</span>
              {cap.have != null && cap.need != null && (
                <span style={{ fontSize: 11.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {cap.have} of {cap.need}
                </span>
              )}
            </div>

            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>{cap.promise}</div>

            <Bar pct={cap.pct} />

            <div style={{ fontSize: 12, color: C.cyan, marginTop: 8, fontWeight: 700 }}>
              {cap.label ? `Needs ${cap.label}` : 'Keep importing — CamCash cannot name the gap yet'}
            </div>
          </div>
        ))}

        {!everythingUnlocked && onImport && (
          <button onClick={onImport} style={{
            marginTop: 6, padding: '12px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
            background: GRADIENT, color: '#06101A', fontSize: 13.5, fontWeight: 850,
            boxShadow: '0 10px 30px rgba(124,92,255,0.28)',
          }}>Import more history →</button>
        )}
      </div>

      {/* ── PER-PLATFORM IMPORT PROGRESS ─────────────────────────── */}
      {platforms.length > 0 && (
        <div style={{ ...panel, padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 3 }}>Data by platform</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            What has landed from each site you stream on.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            {platforms.map(p => (
              <div key={p.platform} style={{
                padding: '15px 16px', borderRadius: 12,
                background: C.card2,
                border: `1px solid ${p.comparable ? 'rgba(16,185,129,0.35)' : C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: C.white }}>{p.platform}</span>
                  {p.comparable && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: 20, color: C.green,
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                    }}>Comparable</span>
                  )}
                </div>

                {p.imported ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 11 }}>
                      <Stat label="tips" value={p.tips.toLocaleString()} />
                      <Stat label="sessions" value={p.sessions.toLocaleString()} />
                      <Stat label="hours" value={`${Number(p.hours || 0).toFixed(1)}h`} />
                      <Stat label="earned" value={fmtUsd0(p.totalUSD)} color={C.cyan} />
                    </div>
                    <div style={{ fontSize: 12, color: p.comparable ? C.green : C.muted, lineHeight: 1.55 }}>
                      {p.comparable
                        ? 'Enough streaming time here to compare it against your other platforms.'
                        : 'Not enough streaming time here yet to compare it against your other platforms.'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
                    You told CamCash you stream here, but no history has been imported yet.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || C.white, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{label}</div>
    </div>
  )
}
