"use client"
import { LM, cardBase, labelStyle } from './theme'

// Opportunity is a *different* facet than Room Pulse — it weighs goal
// proximity and recency toward "should I push right now for a sale",
// where Room Pulse answers "how hot is the room". Score comes straight
// from lib/analytics/opportunity.js (already existed, wasn't wired into
// this page) — never recomputed here.
export default function OpportunityCard({ opportunity, estimate, hasSession }) {
  const pct = hasSession ? opportunity.score : 0
  return (
    <div style={{ ...cardBase, marginBottom: 12, display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 20, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 104, height: 104, margin: '0 auto' }}>
          <svg viewBox="0 0 104 104" width={104} height={104}>
            <circle cx="52" cy="52" r="44" fill="none" stroke={LM.border} strokeWidth="9" />
            <circle cx="52" cy="52" r="44" fill="none" stroke={hasSession ? opportunity.color : LM.border} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - pct / 100)}
              transform="rotate(-90 52 52)"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: LM.text }}>{pct}</span>
            <span style={{ fontSize: 10, color: LM.textMuted }}>/ 100</span>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: hasSession ? opportunity.color : LM.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {hasSession ? opportunity.label : 'No session yet'}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Opportunity</div>
        {estimate && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: LM.green }}>{estimate.value}</span>
            <div style={{ fontSize: 12, color: LM.textMuted, marginTop: 2 }}>{estimate.caption}</div>
          </div>
        )}
        {hasSession && opportunity.signals?.length > 0 && (
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {opportunity.signals.slice(0, 3).map((s, i) => (
              <li key={i} style={{ fontSize: 12, color: LM.textSecondary, display: 'flex', gap: 6 }}>
                <span style={{ color: opportunity.color }}>•</span>{s}
              </li>
            ))}
          </ul>
        )}
        {!hasSession && <div style={{ fontSize: 12.5, color: LM.textMuted, marginTop: 8 }}>Starts scoring conversion windows once your session has activity.</div>}
      </div>
    </div>
  )
}
