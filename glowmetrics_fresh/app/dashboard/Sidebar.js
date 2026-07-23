"use client"
import { useState } from "react"
import Button from "../../components/ui/Button"

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7"
}

const NAV = [
  {
    group: null,
    items: [{ id: "overview", icon: "⚡", label: "Command Center" }]
  },
  {
    group: "FANS",
    items: [{ id: "whales", icon: "👑", label: "Top Fans" }]
  },
  {
    group: "SESSIONS",
    items: [
      { id: "sessions", icon: "🎥", label: "Free Chat Sessions" },
      { id: "live",     icon: "🔴", label: "Live Mode Sessions" },
      { id: "private",  icon: "💎", label: "Private Sessions" },
    ]
  },
  {
    group: "ANALYTICS",
    items: [
      { id: "platforms", icon: "🎯", label: "Platforms" },
      { id: "monthly",   icon: "📈", label: "Monthly" },
    ]
  },
  {
    group: "TOOLS",
    items: [
      { id: "titles",    icon: "🎬", label: "Room Titles" },
      { id: "calc",      icon: "🪙", label: "Token Calc"  },
      { id: "data",      icon: "📝", label: "Edit Data" },
      { id: "analytics", icon: "📊", label: "Analytics" },
      { id: "planner",   icon: "🗓️", label: "Stream Planner" },
      { id: "moneymap",  icon: "🗺️", label: "Money Map" },
    ]
  },
  {
    group: "SUPPORT",
    items: [
      { id: "upload", icon: "📥", label: "Import CSV" },
      { id: "help",   icon: "❓", label: "CSV Help" },
    ]
  },
]

// Curated common IANA zones — a full Intl.supportedValuesOf('timeZone') list
// runs to 400+ entries, most of which are aliases nobody would pick; this
// covers the regions creators actually stream from. "Not set" always means
// "use my device's timezone", the existing default everywhere.
const TIMEZONE_OPTIONS = [
  { value: '', label: 'Auto-detect (device timezone)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris / Berlin / Madrid' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'Mumbai / Delhi' },
  { value: 'Asia/Bangkok', label: 'Bangkok / Jakarta' },
  { value: 'Asia/Manila', label: 'Manila / Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo / Seoul' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
]

export default function Sidebar({ activeTab, onTabChange, user, onSignOut, isPro = false, timezone = null, onTimezoneChange }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [savingTz, setSavingTz] = useState(false)

  const handleTimezoneChange = async (value) => {
    setSavingTz(true)
    try {
      const res = await fetch('/api/profile/timezone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: value || null }),
      })
      if (res.ok) onTimezoneChange?.(value || null)
    } catch (_) {
      // silent — the select just reverts to its bound value on next render
    } finally {
      setSavingTz(false)
    }
  }

  const renderItem = (id, icon, label) => {
    const isActive  = activeTab === id
    const isHovered = hoveredId === id
    return (
      <button key={id}
        onClick={() => { onTabChange(id); setMobileOpen(false) }}
        onMouseEnter={() => setHoveredId(id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
          background: isActive
            ? "linear-gradient(135deg,rgba(34,211,238,0.14),rgba(124,92,255,0.08))"
            : isHovered ? "rgba(255,255,255,0.05)" : "transparent",
          borderLeft: isActive ? "2px solid #22D3EE" : "2px solid transparent",
          transition: "all 0.15s", marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? C.white : C.text, letterSpacing: -0.2 }}>
          {label}
        </span>
        {isActive && (
          <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: C.cyan, boxShadow: "0 0 5px #22D3EE" }} />
        )}
      </button>
    )
  }

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "18px 12px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px", marginBottom: 22 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "white", boxShadow: "0 0 14px rgba(34,211,238,0.3)", flexShrink: 0 }}>$</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white, letterSpacing: -0.4 }}>
            Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
          </div>
          <div style={{ fontSize: 9, color: "#7d8aa3", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 1 }}>Creator Intelligence</div>
        </div>
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {NAV.map((group, gi) => (
          <div key={gi} style={{ marginBottom: group.group ? 12 : 5 }}>
            {group.group && (
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7488", letterSpacing: 1, textTransform: "uppercase", padding: "0 12px", marginBottom: 4 }}>
                {group.group}
              </div>
            )}
            {group.items.map(({ id, icon, label }) => renderItem(id, icon, label))}
          </div>
        ))}
      </div>

      {/* Upgrade CTA — always visible, but the Pro state stays low-key since it's a status, not a call to action */}
      {isPro ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 9, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", marginBottom: 8 }}>
          <span style={{ fontSize: 11 }}>✦</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.purple }}>Pro plan active</span>
        </div>
      ) : (
        <Button as="a" href="/pricing" style={{ width: "100%", marginBottom: 8, fontSize: 13, padding: "11px 12px", textAlign: "center" }}>
          ✦ Upgrade to Pro
        </Button>
      )}

      {/* User footer — timezone gets its own row above the compact email/sign-out row */}
      {user && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 4 }}>
          <div style={{ marginBottom: 8, padding: "0 4px" }}>
            <label style={{ fontSize: 9, color: "#7d8aa3", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
              Timezone {savingTz && "· saving…"}
            </label>
            <select
              value={timezone || ''}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 7, fontSize: 11,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: C.white, outline: "none", cursor: "pointer",
              }}
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div title={user.email} style={{ fontSize: 11, color: "#7d8aa3", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
              {user.email}
            </div>
            <button onClick={onSignOut}
              style={{ flexShrink: 0, padding: "5px 8px", borderRadius: 8, background: "transparent", border: "none", color: "#F87171", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span>→</span> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 240, background: "rgba(6,9,20,0.97)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", zIndex: 50 }}
        className="sidebar-desktop">
        {sidebarContent}
      </aside>

      <button onClick={() => setMobileOpen(o => !o)}
        className="sidebar-mobile-btn"
        style={{ position: "fixed", top: 14, left: 14, zIndex: 200, width: 36, height: 36, borderRadius: 10, background: "rgba(6,9,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: C.white, fontSize: 18, cursor: "pointer", display: "none", alignItems: "center", justifyContent: "center" }}>
        ☰
      </button>

      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div onClick={() => setMobileOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
          <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 240, background: "rgba(6,9,20,0.99)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
