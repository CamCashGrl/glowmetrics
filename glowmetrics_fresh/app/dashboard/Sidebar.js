"use client"
import React, { useState } from "react"

const NAV = [
  { id: "overview",  icon: "📊", label: "Overview" },
  { id: "platforms", icon: "🎯", label: "Platforms" },
  { id: "whales",    icon: "🐳", label: "Top Fans" },
  { id: "sessions",  icon: "🎥", label: "Sessions" },
  { id: "live",      icon: "🔴", label: "Live Mode" },
  { id: "data",      icon: "📝", label: "Edit Data" },
  { id: "titles",    icon: "🎬", label: "Room Titles" },
  { id: "help",      icon: "❓", label: "CSV Help" },
  { id: "upload",    icon: "📥", label: "Import" },
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
      background: "linear-gradient(180deg, #0a0d1a 0%, #07090f 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset -1px 0 0 rgba(124,92,255,0.08)",
    }}>
      <style>{`
        .nav-btn {
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
          position: relative;
          overflow: hidden;
        }
        .nav-btn:hover { transform: translateX(2px); }
        .nav-btn:active { transform: scale(0.97) !important; }
        .sidebar-nav::-webkit-scrollbar { width: 2px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(124,92,255,0.2);
          border-radius: 2px;
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        {/* Logo + sign out */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: "linear-gradient(135deg, #22D3EE, #EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 12px rgba(34,211,238,0.3)",
              flexShrink: 0,
            }}>$</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.3 }}>
              Cam
              <span style={{
                background: "linear-gradient(90deg, #22D3EE, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Cash</span>
            </span>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign Out"
              style={{
                padding: "3px 8px", borderRadius: 5,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.18)",
                color: "#F87171", fontSize: 9, fontWeight: 700,
                cursor: "pointer", letterSpacing: 0.3,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
            >OUT</button>
          )}
        </div>

        {/* Email */}
        {user && (
          <div style={{
            fontSize: 10, color: "#334155",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 8,
          }}>
            {user.email}
          </div>
        )}

        {/* Beta badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 7,
          background: "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(251,146,60,0.08))",
          border: "1px solid rgba(245,158,11,0.28)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#F59E0B",
            boxShadow: "0 0 5px #F59E0B",
            flexShrink: 0,
            animation: "none",
          }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", letterSpacing: 0.5 }}>FREE BETA</div>
            <div style={{ fontSize: 9, color: "#FB923C" }}>All features unlocked</div>
          </div>
        </div>
      </div>

      {/* ── NAV ── flat list, no section boxes */}
      <div
        className="sidebar-nav"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0,
        }}
      >
        {NAV.map(({ id, icon, label }) => {
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
                gap: 10,
                padding: "8px 11px",
                borderRadius: 9,
                border: isActive
                  ? "1px solid rgba(59,130,246,0.28)"
                  : "1px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                letterSpacing: 0.1,
                color: isActive
                  ? "#F1F5F9"
                  : isHovered
                  ? "#94A3B8"
                  : "#4B5E78",
                background: isActive
                  ? "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(236,72,153,0.12))"
                  : isHovered
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
                boxShadow: isActive
                  ? "0 0 14px rgba(59,130,246,0.12)"
                  : "none",
              }}
            >
              {/* Active left accent */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  left: 0, top: "18%", bottom: "18%",
                  width: 2.5, borderRadius: 2,
                  background: "linear-gradient(180deg, #22D3EE, #EC4899)",
                  boxShadow: "0 0 6px rgba(34,211,238,0.55)",
                }} />
              )}

              {/* Icon */}
              <span style={{
                fontSize: 15,
                lineHeight: 1,
                flexShrink: 0,
                filter: isActive
                  ? "drop-shadow(0 0 4px rgba(34,211,238,0.45))"
                  : isHovered
                  ? "brightness(1.3)"
                  : "brightness(0.85)",
                transition: "filter 0.15s",
              }}>
                {icon}
              </span>

              {/* Label */}
              <span style={{ lineHeight: 1 }}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}