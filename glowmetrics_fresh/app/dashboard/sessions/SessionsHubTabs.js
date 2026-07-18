"use client"

// Segmented control that separates inferred CSV sessions from verified
// Live Mode sessions — the two must never be mixed into one list.

const C = { cyan: '#22D3EE', pink: '#EC4899', white: '#F1F5F9', muted: '#94a3b8' }

const TABS = [
  { id: 'uploaded', label: 'Uploaded Tip Sessions' },
  { id: 'live', label: 'Live Mode Sessions' },
]

export default function SessionsHubTabs({ active, onChange }) {
  return (
    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
      {TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
              color: isActive ? '#04101a' : C.muted,
              background: isActive ? `linear-gradient(90deg, ${C.cyan}, ${C.pink})` : 'transparent',
              transition: 'all 0.18s',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
