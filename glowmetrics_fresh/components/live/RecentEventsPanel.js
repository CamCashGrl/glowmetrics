"use client"
import { LM, cardBase, labelStyle } from './theme'

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ago`;
}

// Tips-only feed sourced from the real liveEvents session array — no
// separate "why this alert" or timeline duplicate elsewhere on the page.
export default function RecentEventsPanel({ events, onViewAll }) {
  const rows = (events || []).slice(0, 6);
  return (
    <div style={{ ...cardBase, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...labelStyle, marginBottom: 12 }}>Recent Events (Live)</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: LM.textMuted, padding: '8px 0' }}>No events yet this session.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((e, i) => (
            <div key={e._id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'lm-slide-in 0.35s ease' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(25,211,154,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>💸</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: LM.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.username} sent {e.tokens ? `${e.tokens} tokens` : 'a tip'}
                </div>
                <div style={{ fontSize: 11, color: LM.textMuted }}>{timeAgo(e.timestamp)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: LM.green, flexShrink: 0 }}>+${(e.normalizedRevenue || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onViewAll} style={{ marginTop: 14, background: 'none', border: 'none', color: LM.cyan, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        View All Events →
      </button>
    </div>
  )
}
