"use client"
import { LM, cardBase, labelStyle } from './theme'

function Row({ icon, label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: LM.textSecondary }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: valueColor || LM.text, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  )
}

// Only non-duplicated insights — current earnings/tokens/tip-count/pace are
// already shown in the summary cards above and never repeated here.
export default function LiveInsightsPanel({ bestEarningLabel, topTipperLabel, paceVsNormalLabel, paceVsNormalColor, engagementLabel, promptPerformedPct, onViewFull }) {
  return (
    <div style={{ ...cardBase, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...labelStyle, marginBottom: 12 }}>Live Insights</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Row icon="⭐" label="Best earning time today" value={bestEarningLabel || '—'} />
        <Row icon="💗" label="Top tipper today" value={topTipperLabel || '—'} />
        <Row icon="📈" label="Your pace is" value={paceVsNormalLabel || '—'} valueColor={paceVsNormalColor} />
        <Row icon="🎛️" label="Engagement" value={engagementLabel || '—'} />
        {promptPerformedPct != null && <Row icon="✅" label="Coaching follow-through" value={`${promptPerformedPct}% of prompts acted on`} />}
      </div>
      <button onClick={onViewFull} style={{ marginTop: 14, background: 'none', border: 'none', color: LM.cyan, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        View Full Insights →
      </button>
    </div>
  )
}
