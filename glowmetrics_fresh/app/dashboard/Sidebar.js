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
        @keyframes glow-pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
      `}</style>

      {/* HEADER */}
      <div style={{
        padding: "10px 12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #22D3EE, #EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 10px rgba(34,211,238,0.35)",
              flexShrink: 0,
            }}>$</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.5 }}>
              Cam<span style={{
                background: "linear-gradient(90deg, #22D3EE, #EC4899)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>Cash</span>
            </span>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign Out"
              style={{
                padding: "4px 8px", borderRadius: 6,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "#F87171", fontSize: 10, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
            >
              → Out
            </button>
          )}
        </div>

        {user && (
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 7px", borderRadius: 5,
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.25)",
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#F59E0B", flexShrink: 0,
            animation: "glow-pulse 2s infinite",
          }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B", letterSpacing: 0.5 }}>BETA · All features free</span>
        </div>
      </div>

      {/* NAV */}
      <div style={{
        flex: 1,
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 2 }}>
            <div style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 1.4,
              color: "#2d3f55", textTransform: "uppercase",
              padding: "4px 8px 2px",
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
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#F1F5F9" : isHovered ? "#CBD5E1" : "#64748B",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(236,72,153,0.14))"
                      : isHovered ? "rgba(255,255,255,0.04)" : "transparent",
                    boxShadow: isActive ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
                    position: "relative",
                    overflow: "hidden",
                    marginBottom: 1,
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 2, borderRadius: 2,
                      background: "linear-gradient(180deg, #22D3EE, #EC4899)",
                      boxShadow: "0 0 5px rgba(34,211,238,0.5)",
                    }} />
                  )}
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}