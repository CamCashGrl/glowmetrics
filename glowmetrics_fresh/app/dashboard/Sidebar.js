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
    group: "ANALYTICS",
    items: [
      { id: "platforms", icon: "🎯", label: "Platforms" },
      { id: "sessions",  icon: "🎥", label: "Sessions" },
      { id: "monthly",   icon: "📈", label: "Monthly" },
    ]
  },
  {
    group: "TOOLS",
    items: [
      { id: "live",      icon: "🔴", label: "Live Mode" },
      { id: "titles",    icon: "🎬", label: "Room Titles" },
      { id: "calc",      icon: "🪙", label: "Token Calc"  },
      { id: "data",      icon: "📝", label: "Edit Data" },
      { id: "analytics", icon: "📊", label: "Analytics" },
      { id: "planner",   icon: "🗓️", label: "Stream Planner" },
      { id: "moneymap",  icon: "🗺️", label: "Money Map" },
    ]
  },
  {
    group: "BRAND STUDIO",
    items: [
      { id: "brandstudio", icon: "🎨", label: "Brand Studio" },
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

export default function Sidebar({ activeTab, onTabChange, user, onSignOut, isPro = false }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px 12px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px", marginBottom: 28 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "white", boxShadow: "0 0 14px rgba(34,211,238,0.3)", flexShrink: 0 }}>$</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white, letterSpacing: -0.4 }}>
            Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
          </div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginTop: 1 }}>Creator Intelligence</div>
        </div>
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {NAV.map((group, gi) => (
          <div key={gi} style={{ marginBottom: group.group ? 16 : 8 }}>
            {group.group && (
              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", padding: "0 12px", marginBottom: 4 }}>
                {group.group}
              </div>
            )}
            {group.items.map(({ id, icon, label }) => renderItem(id, icon, label))}
          </div>
        ))}
      </div>

      {/* Upgrade CTA — always visible, prominent */}
      {isPro ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", marginBottom: 10 }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>Pro plan active</span>
        </div>
      ) : (
        <Button as="a" href="/pricing" style={{ width: "100%", marginBottom: 10, fontSize: 13, padding: "11px 12px", textAlign: "center" }}>
          ✦ Upgrade to Pro
        </Button>
      )}

      {/* User footer */}
      {user && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, padding: "0 4px", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
          <button onClick={onSignOut}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", color: "#F87171", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}>
            <span>→</span> Sign Out
          </button>
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
