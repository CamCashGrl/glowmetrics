"use client"
import React, { useState } from "react"

const NAV = [
  {
    section: "MAIN",
    items: [
      { id: "overview",  icon: "📊", label: "Overview" },
      { id: "platforms", icon: "🎯", label: "Platforms" },
      { id: "whales",    icon: "🐳", label: "Top Fans" },
    ]
  },
  {
    section: "ANALYTICS",
    items: [
      { id: "sessions", icon: "🎥", label: "Sessions" },
      { id: "monthly",  icon: "📈", label: "Monthly" },
    ]
  },
  {
    section: "TOOLS",
    items: [
      { id: "live",   icon: "🔴", label: "Live Mode" },
      { id: "titles", icon: "🎬", label: "Room Titles" },
      { id: "upload", icon: "📥", label: "Import CSV" },
      { id: "help",   icon: "❓", label: "CSV Help" },
      { id: "data",   icon: "📝", label: "Edit Data" },
    ]
  },
]

export default function Sidebar({ activeTab, onTabChange, user, onSignOut }) {
  const [hoveredId, setHoveredId] = useState(null)

  return (
    <div style={{
      position: "fixed",
      left: 0, top: 0, bottom: 0,
      width: 240,
      display: "flex",
      flexDirection: "column",
      zIndex: 50,
      background: "linear-gradient(180deg, rgba(10,13,28,0.98) 0%, rgba(8,10,22,0.99) 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "blur(24px)",
    }}>
      <style>{`
        .nav-item { transition: all 0.18s ease; }
        .nav-item:hover { transform: translateX(3px); }
        .nav-item:active { transform: scale(0.97); }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(124,92,255,0.3); border-radius: 3px; }
        @keyframes glow-pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
      `}</style>

      {/* LOGO */}
      <div style={{
        padding: "22px 20px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #22D3EE, #EC4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff",
            boxShadow: "0 0 16px rgba(34,211,238,0.4), 0 0 32px rgba(236,72,153,0.2)",
          }}>$</div>
          <span style={{ fontSize: 19, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.5 }}>
            Cam<span style={{
              background: "linear-gradient(90deg, #22D3EE, #EC4899)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>Cash</span>
          </span>
        </div>

        {user && (
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
        )}

        {/* Beta badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8,
          background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.1))",
          border: "1px solid rgba(245,158,11,0.3)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#F59E0B",
            boxShadow: "0 0 6px #F59E0B",
            animation: "glow-pulse 2s infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", letterSpacing: 0.8 }}>BETA · All features free</span>
        </div>
      </div>

      {/* NAV — scrollable */}
      <div className="sidebar-scroll" style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              color: "#334155", textTransform: "uppercase",
              padding: "6px 10px 4px",
            }}>
              {section}
            </div>
            {items.map(({ id, icon, label }) => {
              const isActive = activeTab === id
              const isHovered = hoveredId === id
              return (
                <button
                  key={id}
                  className="nav-item"
                  onClick={() => onTabChange(id)}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#F1F5F9" : isHovered ? "#CBD5E1" : "#64748B",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(236,72,153,0.14))"
                      : isHovered
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    boxShadow: isActive
                      ? "inset 0 0 0 1px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.1)"
                      : "none",
                    transition: "all 0.18s ease",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Active left accent bar */}
                  {isActive && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 3, borderRadius: 3,
                      background: "linear-gradient(180deg, #22D3EE, #EC4899)",
                      boxShadow: "0 0 8px rgba(34,211,238,0.6)",
                    }} />
                  )}
                  <span style={{
                    fontSize: 16,
                    filter: isActive ? "drop-shadow(0 0 4px rgba(34,211,238,0.4))" : "none",
                    transition: "filter 0.18s ease",
                  }}>
                    {icon}
                  </span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* BOTTOM — sign out */}
      <div style={{
        padding: "12px 10px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        {onSignOut && (
          <button
            onClick={onSignOut}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 9,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "#F87171", fontSize: 12, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6,
              transition: "all 0.18s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.18)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.45)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)" }}
          >
            <span>→</span> Sign Out
          </button>
        )}
      </div>
    </div>
  )
}