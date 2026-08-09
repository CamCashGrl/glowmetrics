"use client"
// CamCash Intelligence — the ONE curated surface for retrospective/account-
// level dashboard_events on the main dashboard (see app/api/dashboard/events
// for the read path, and lib/intelligence/* for what writes these rows).
//
// This component is presentation-only: it never recomputes, rewrites, or
// invents any event content. title/message/priority/metadata are used
// exactly as the RPC-recorded them. Grouping below is a display label only —
// it does not change event_type, fingerprint, priority, or any stored value.
//
// Deliberately NOT a notification inbox: it shows at most one event at a
// time (carousel through "new" events only), never a stacked list of eight
// cards. The bell/NotificationPanel is the separate history/access surface.
import { useState, useEffect } from "react"

const C = {
  bg: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#f87171",
}

// Display-only grouping — purely presentational, never written back to the
// event or used to alter evaluator behavior. Events not listed fall back to
// no group label (e.g. import_completed, which the product spec calls out
// as intentionally subordinate/ungrouped).
const GROUP = {
  peak_window: "STREAMING OPPORTUNITY",
  new_whale_detected: "AUDIENCE",
  platform_gap_detected: "PLATFORM",
  weekly_momentum_up: "MOMENTUM",
  weekly_momentum_down: "MOMENTUM",
  stream_below_baseline: "STREAM PERFORMANCE",
  stream_outperformed_baseline: "STREAM PERFORMANCE",
  import_completed: "IMPORT",
}

const ICON = {
  peak_window: "🔥",
  new_whale_detected: "🐋",
  platform_gap_detected: "⚖️",
  weekly_momentum_up: "📈",
  weekly_momentum_down: "📉",
  stream_below_baseline: "📊",
  stream_outperformed_baseline: "📊",
  import_completed: "📥",
}

// Visual interpretation only, keyed off the existing `priority` field.
// Never changes backend priority — purely how strongly a card is styled.
const PRIORITY_STYLE = {
  critical: { accent: C.red, glow: "rgba(248,113,113,0.30)", label: "CRITICAL" },
  high: { accent: C.gold, glow: "rgba(245,158,11,0.22)", label: "HIGH" },
  medium: { accent: C.cyan, glow: "rgba(34,211,238,0.16)", label: null },
  low: { accent: C.muted, glow: "rgba(148,163,184,0.10)", label: null },
}

export default function IntelligenceCard({ events = [], onMarkSeen, onOpenPanel }) {
  const newEvents = events.filter(e => e.status === "new")
  const [idx, setIdx] = useState(0)

  // Reset to the first new event whenever the new-event set actually
  // changes shape (a fresh realtime INSERT arrives, or one drops out after
  // being marked seen) — never mid-read while the same set is displayed.
  useEffect(() => {
    setIdx(0)
  }, [newEvents.map(e => e.id).join(",")])

  const hasNew = newEvents.length > 0
  const current = hasNew ? newEvents[Math.min(idx, newEvents.length - 1)] : (events[0] || null)

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        padding: "20px 22px",
        marginBottom: 20,
        background: C.bg,
        border: `1px solid ${hasNew ? "rgba(16,185,129,0.35)" : C.border}`,
        boxShadow: hasNew
          ? "0 0 0 1px rgba(16,185,129,0.12), 0 0 34px rgba(16,185,129,0.14)"
          : "none",
        transition: "border-color 250ms ease, box-shadow 250ms ease",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: current ? 14 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>✨</span>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: C.white, textTransform: "uppercase" }}>
            CamCash Intelligence
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {newEvents.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: C.green, padding: "3px 8px", borderRadius: 20, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
              {newEvents.length} NEW
            </span>
          )}
          <button
            onClick={onOpenPanel}
            style={{ fontSize: 11, fontWeight: 700, color: C.text, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            View all →
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      {!current && (
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          CamCash is watching your business — new insights will show up here as they happen.
        </div>
      )}

      {current && (
        <EventBody
          key={current.id}
          event={current}
          isNew={current.status === "new"}
          onMarkSeen={onMarkSeen}
        />
      )}

      {/* ── CAROUSEL CONTROLS — only when there's more than one NEW event ── */}
      {hasNew && newEvents.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
          <button
            onClick={() => setIdx(i => (i - 1 + newEvents.length) % newEvents.length)}
            style={navBtnStyle}
            aria-label="Previous"
          >
            ‹
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            {newEvents.map((e, i) => (
              <div
                key={e.id}
                onClick={() => setIdx(i)}
                style={{
                  width: 6, height: 6, borderRadius: "50%", cursor: "pointer",
                  background: i === idx ? C.green : "rgba(255,255,255,0.15)",
                  transition: "background 150ms ease",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => setIdx(i => (i + 1) % newEvents.length)}
            style={navBtnStyle}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

const navBtnStyle = {
  width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.text,
  fontSize: 14, cursor: "pointer", lineHeight: 1,
}

function EventBody({ event, isNew, onMarkSeen }) {
  const group = GROUP[event.event_type] || null
  const icon = ICON[event.event_type] || "💡"
  const style = PRIORITY_STYLE[event.priority] || PRIORITY_STYLE.medium

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {group && (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: style.accent, textTransform: "uppercase" }}>
            {icon} {group}
          </span>
        )}
        {style.label && (
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: style.accent, padding: "1px 6px", borderRadius: 4, background: `${style.accent}1a` }}>
            {style.label}
          </span>
        )}
        {isNew && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: "camcash-new-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: C.green }}>NEW</span>
          </span>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 4, lineHeight: 1.4 }}>
        {!group && `${icon} `}{event.title}
      </div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
        {event.message}
      </div>

      {isNew && (
        <button
          onClick={() => onMarkSeen?.(event.id)}
          style={{
            marginTop: 12, fontSize: 12, fontWeight: 700, color: style.accent,
            background: "transparent", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          View insight →
        </button>
      )}

      <style jsx>{`
        @keyframes camcash-new-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
