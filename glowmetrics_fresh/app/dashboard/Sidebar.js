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
      width: 220,
      display: "flex",
      flexDirection: "column",
      zIndex: 50,
      background: "linear-gradient(180deg, rgba(8,11,22,0.99) 0%, rgba(5,7,15,1) 100%)",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
    }}>
      <style>{`
        @keyframes glow-pulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        .nav-btn {
          transition: background 0.15s ease, color 0.15s ease,
                      box-shadow 0.15s ease, transform 0.15s ease;
          position: relative;
          overflow: hidden;
        }
        .nav-btn:hover  { transform: translateX(2px); }
        .nav-btn:active { transform: scale(0.97) !important; }
        .sidebar-scroll { overflow-y: auto; overflow-x: hidden; }
        .sidebar-scroll::-webkit-scrollbar { width: 2px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(124,92,255,0.25);
          border-radius: 2px;
        }
      `}</style>

      {/* ── LOGO HEADER ── */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        {/* Logo row */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, #22D3EE, #EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 10px rgba(34,211,238,0.3)",
              flexShrink: 0,
            }}>$</div>
            <span style={{
              fontSize: 16, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.3,
            }}>
              Cam
              <span style={{
                background: "linear-gradient(90deg, #22D3EE, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Cash</span>
            </span>
          </div>

          {/* Sign out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign Out"
              style={{
                padding: "3px 7px", borderRadius: 5,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "#F87171", fontSize: 9, fontWeight: 700,
                cursor: "pointer", letterSpacing: 0.3,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
            >
              OUT
            </button>
          )}
        </div>

        {/* Email */}
        {user && (
          <div style={{
            fontSize: 9, color: "#2d3f55",
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", marginBottom: 6,
          }}>
            {user.email}
          </div>
        )}
      </div>

      {/* ── NAV SECTIONS ── */}
      <div
        className="sidebar-scroll"
        style={{
          flex: 1,
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minHeight: 0,
        }}
      >
        {NAV.map(({ section, items }) => (
          <div
            key={section}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 9,
              padding: "3px 3px 4px",
              flexShrink: 0,
            }}
          >
            {/* Section label */}
            <div style={{
              fontSize: 8, fontWeight: 700,
              letterSpacing: 1.4, color: "#1e3048",
              textTransform: "uppercase",
              padding: "3px 8px 2px",
            }}>
              {section}
            </div>

            {/* Items */}
            {items.map(({ id, icon, label }) => {
              const isActive  = activeTab === id
              const isHovered = hoveredId === id
              return (
                <button
                  key={id}
                  className="nav-btn"
                  onClick={() => onTabChange(id)}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 9px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive
                      ? "#F1F5F9"
                      : isHovered
                      ? "#94A3B8"
                      : "#475569",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(236,72,153,0.16))"
                      : isHovered
                      ? "rgba(255,255,255,0.05)"
                      : "transparent",
                    boxShadow: isActive
                      ? "inset 0 0 0 1px rgba(59,130,246,0.3), 0 2px 10px rgba(59,130,246,0.12)"
                      : "none",
                    marginBottom: 1,
                  }}
                >
                  {/* Active accent bar */}
                  {isActive && (
                    <div style={{
                      position: "absolute",
                      left: 0, top: "15%", bottom: "15%",
                      width: 2, borderRadius: 2,
                      background: "linear-gradient(180deg, #22D3EE, #EC4899)",
                      boxShadow: "0 0 5px rgba(34,211,238,0.6)",
                    }} />
                  )}

                  {/* Icon */}
                  <span style={{
                    fontSize: 13,
                    lineHeight: 1,
                    filter: isActive
                      ? "drop-shadow(0 0 4px rgba(34,211,238,0.5))"
                      : isHovered
                      ? "drop-shadow(0 0 2px rgba(148,163,184,0.3))"
                      : "none",
                    transition: "filter 0.15s",
                    flexShrink: 0,
                  }}>
                    {icon}
                  </span>

                  {/* Label */}
                  <span style={{ lineHeight: 1 }}>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}