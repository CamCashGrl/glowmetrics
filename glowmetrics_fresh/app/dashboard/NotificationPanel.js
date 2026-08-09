"use client"
// Notification bell panel — the history/access layer for dashboard_events.
// This is deliberately a different surface from IntelligenceCard (the
// curated single-event highlight on the main dashboard): this panel is
// where every recent event lives, groupable by NEW / RECENT / HISTORY.
//
// Reuses the existing dashboard_events status values only:
//   new        -> NEW section
//   seen       -> RECENT section
//   dismissed  -> HISTORY section (collapsed by default)
// No new statuses, no new API routes — actions call the existing
// PATCH /api/dashboard/events/[id] via the onMarkSeen/onDismiss props
// passed down from app/dashboard/page.js.
const C = {
  bg: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#f87171",
}

const PRIORITY_ACCENT = { critical: C.red, high: C.gold, medium: C.cyan, low: C.muted }
const ICON = {
  peak_window: "🔥", new_whale_detected: "🐋", platform_gap_detected: "🎯",
  weekly_momentum_up: "📈", weekly_momentum_down: "📉",
  stream_below_baseline: "🐢", stream_outperformed_baseline: "⚡", import_completed: "📥",
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function EventRow({ event, quiet, onMarkSeen, onDismiss }) {
  const accent = PRIORITY_ACCENT[event.priority] || C.cyan
  const icon = ICON[event.event_type] || "💡"
  return (
    <div
      style={{
        padding: "10px 12px", borderRadius: 10, marginBottom: 6,
        background: quiet ? "transparent" : "rgba(16,185,129,0.05)",
        border: `1px solid ${quiet ? "transparent" : "rgba(16,185,129,0.18)"}`,
        opacity: quiet ? 0.72 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{event.title}</span>
            {event.status === "new" && (
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.45, marginBottom: 4 }}>{event.message}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{timeAgo(event.created_at)}</span>
            {event.status === "new" && (
              <button onClick={() => onMarkSeen(event.id)} style={linkBtn(accent)}>Mark seen</button>
            )}
            {event.status !== "dismissed" && (
              <button onClick={() => onDismiss(event.id)} style={linkBtn(C.muted)}>Dismiss</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const linkBtn = (color) => ({
  fontSize: 10, fontWeight: 700, color, background: "transparent", border: "none", cursor: "pointer", padding: 0,
})

function Section({ label, events, quiet, onMarkSeen, onDismiss, collapsedByDefault }) {
  if (!events.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: C.muted, textTransform: "uppercase", marginBottom: 6, padding: "0 2px" }}>
        {label} ({events.length})
      </div>
      {events.map(e => (
        <EventRow key={e.id} event={e} quiet={quiet} onMarkSeen={onMarkSeen} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default function NotificationPanel({ open, onClose, events = [], loading, onMarkSeen, onDismiss }) {
  if (!open) return null

  const newEvents = events.filter(e => e.status === "new")
  const recentEvents = events.filter(e => e.status === "seen")
  const historyEvents = events.filter(e => e.status === "dismissed")

  return (
    <>
      {/* Backdrop — closes the panel on outside click, matches the existing
          mobile-sidebar overlay pattern already used in Sidebar.js. */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 150, background: "transparent" }} />

      <div
        className="camcash-notif-panel"
        style={{
          position: "fixed", top: 64, zIndex: 151,
          width: "min(360px, calc(100vw - 32px))", maxHeight: "70vh", overflowY: "auto",
          borderRadius: 16, padding: 14,
          background: "rgba(10,14,26,0.98)", border: `1px solid ${C.border}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)", backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>Notifications</span>
          <button onClick={onClose} style={{ fontSize: 12, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        {loading && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: C.muted }}>Loading…</div>
        )}

        {!loading && events.length === 0 && (
          <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 12, color: C.muted }}>
            Nothing here yet — CamCash will let you know when something worth seeing happens.
          </div>
        )}

        {!loading && events.length > 0 && (
          <>
            <Section label="New" events={newEvents} quiet={false} onMarkSeen={onMarkSeen} onDismiss={onDismiss} />
            <Section label="Recent" events={recentEvents} quiet onMarkSeen={onMarkSeen} onDismiss={onDismiss} />
            <Section label="History" events={historyEvents} quiet onMarkSeen={onMarkSeen} onDismiss={onDismiss} />
          </>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .camcash-notif-panel { left: 16px !important; right: 16px; width: auto !important; }
        }
        @media (min-width: 769px) {
          .camcash-notif-panel { left: 250px; }
        }
      `}</style>
    </>
  )
}
