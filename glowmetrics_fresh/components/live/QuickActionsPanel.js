"use client"
import { LM, cardBase, labelStyle } from './theme'

function Tile({ icon, label, onClick, active, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 72, padding: '12px 8px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(232,42,184,0.14)' : LM.card,
        border: `1px solid ${active ? LM.magenta : LM.border}`,
        color: active ? LM.magenta : LM.textSecondary,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = active ? 'rgba(232,42,184,0.2)' : LM.surface; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = active ? 'rgba(232,42,184,0.14)' : LM.card; }}
    >
      <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center' }}>{label}</span>
    </button>
  )
}

// Five compact tiles. Two reference actions ("Tip Goal", "Send a Message")
// don't have a real backing feature in this product yet — rather than wire
// fake handlers, they're mapped to the closest real Live Mode capabilities
// (coaching strategy selection, manual tip log) with the tile design kept
// identical. Clear Feed and Pause Prompts are real, non-destructive-by-
// accident actions: Clear Feed requires confirmation (it hides tip rows),
// Pause Prompts only stops the coaching poll, never the stream.
export default function QuickActionsPanel({ onSetGoal, onStrategy, onLogTip, onClearFeed, onTogglePausePrompts, promptsPaused }) {
  return (
    <div style={{ ...cardBase, marginBottom: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 12 }}>Quick Actions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <Tile icon="🎯" label="Set Goal" onClick={onSetGoal} />
        <Tile icon="🧭" label="Coaching Strategy" onClick={onStrategy} />
        <Tile icon="✍️" label="Log a Tip" onClick={onLogTip} />
        <Tile icon="🗑️" label="Clear Feed" onClick={onClearFeed} />
        <Tile icon={promptsPaused ? '▶️' : '⏸️'} label={promptsPaused ? 'Resume Prompts' : 'Pause Prompts'} onClick={onTogglePausePrompts} active={promptsPaused} />
      </div>
    </div>
  )
}
