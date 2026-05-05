"use client"
import React, { useState } from "react"

const SECTIONS = [
  {
    id: "main",
    label: null,
    items: [
      { id: "overview",  icon: "📊", label: "Overview" },
      { id: "platforms", icon: "🎯", label: "Platforms" },
      { id: "whales",    icon: "🐳", label: "Top Fans" },
    ]
  },
  {
    id: "analytics",
    label: "ANALYTICS",
    items: [
      { id: "sessions", icon: "🎥", label: "Sessions" },
      { id: "monthly",  icon: "📈", label: "Monthly" },
    ]
  },
  {
    id: "tools",
    label: "TOOLS",
    items: [
      { id: "live",       icon: "🔴", label: "Live Mode" },
      { id: "data",       icon: "📝", label: "Edit Data" },
      { id: "titles",     icon: "🎬", label: "Room Titles" },
      { id: "calculator", icon: "🧮", label: "Token Calc" },
    ]
  },
]

const BOTTOM_ITEMS = [
  { id: "help",   icon: "❓", label: "CSV Help" },
  { id: "upload", icon: "📥", label: "Import CSV" },
]

export default function Sidebar({ activeTab, onTabChange, user, onSignOut }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const renderItem = (id, icon, label) => {
    const isActive  = activeTab === id
    const isHovered = hoveredId === id
    return (
      <button
        key={id}
        onClick={() => { onTabChange(id); setMobileOpen(false) }}
        onMouseEnter={() => setHoveredId(id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 9,
          border: isActive ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          letterSpacing: 0.1,
          color: isActive ? "#F1F5F9" : isHovered ? "#94A3B8" : "#4B5E78",
          background: isActive
            ? "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(236,72,153,0.13))"
            : isHovered ? "rgba(255,255,255,0.04)" : "transparent",
          boxShadow: isActive ? "0 0 16px rgba(59,130,246,0.12)" : "none",
          position: "relative",
          overflow: "hidden",
          transition: "all 0.15s ease",
        }}
      >
        {isActive && (
          <div style={{
            position: "absolute", left: 0, top: "18%", bottom: "18%",
            width: 2.5, borderRadius: 2,
            background: "linear-gradient(180deg, #22D3EE, #EC4899)",
            boxShadow: "0 0 6px rgba(34,211,238,0.6)",
          }} />
        )}
        <span style={{
          fontSize: 15, lineHeight: 1, flexShrink: 0,
          filter: isActive
            ? "drop-shadow(0 0 4px rgba(34,211,238,0.45))"
            : isHovered ? "brightness(1.3)" : "brightness(0.8)",
          transition: "filter 0.15s",
        }}>{icon}</span>
        <span style={{ lineHeight: 1 }}>{label}</span>
      </button>
    )
  }

  const sidebarContent = (
    <>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 2px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(124,92,255,0.2); border-radius: 2px; }
      `}</style>

      {/* TOP */}
      <div style={{
        padding: "16px 16px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: "linear-gradient(135deg, #22D3EE, #EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 12px rgba(34,211,238,0.3)", flexShrink: 0,
            }}>$</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.3 }}>
              Cam<span style={{
                background: "linear-gradient(90deg, #22D3EE, #EC4899)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Cash</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {onSignOut && (
              <button onClick={onSignOut} style={{
                padding: "3px 8px", borderRadius: 5,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.18)",
                color: "#F87171", fontSize: 9, fontWeight: 700,
                cursor: "pointer", transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
              >OUT</button>
            )}
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                display: "none",
                padding: "3px 8px", borderRadius: 5,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: 14,
                cursor: "pointer",
              }}
            >✕</button>
          </div>
        </div>
        {user && (
          <div style={{
            fontSize: 10, color: "#2d3f55", marginBottom: 10,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{user.email}</div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 7,
          background: "linear-gradient(135deg, rgba(245,158,11,0.13), rgba(251,146,60,0.07))",
          border: "1px solid rgba(245,158,11,0.25)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#F59E0B", boxShadow: "0 0 5px #F59E0B", flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", letterSpacing: 0.5 }}>FREE BETA</div>
            <div style={{ fontSize: 9, color: "#FB923C" }}>All features unlocked</div>
          </div>
        </div>
      </div>

      {/* MIDDLE — scrollable */}
      <div className="sidebar-scroll" style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "10px 10px 6px",
        display: "flex", flexDirection: "column", gap: 2,
        minHeight: 0,
      }}>
        {SECTIONS.map((section, si) => (
          <div key={section.id} style={{ marginTop: si > 0 ? 14 : 0 }}>
            {section.label && (
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                color: "#1e3a52", textTransform: "uppercase",
                padding: "0 10px 5px",
              }}>
                {section.label}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {section.items.map(item => renderItem(item.id, item.icon, item.label))}
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM — pinned */}
      <div style={{
        padding: "8px 10px 14px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          color: "#1e3a52", textTransform: "uppercase",
          padding: "0 10px 5px",
        }}>SUPPORT</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {BOTTOM_ITEMS.map(item => renderItem(item.id, item.icon, item.label))}
        </div>
      </div>
    </>
  )

  const sidebarStyle = {
    width: 220,
    display: "flex",
    flexDirection: "column",
    zIndex: 50,
    background: "linear-gradient(180deg, #0a0d1a 0%, #070910 100%)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "inset -1px 0 0 rgba(124,92,255,0.07), 2px 0 20px rgba(0,0,0,0.4)",
  }

  return (
    <>
      {/* DESKTOP */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, ...sidebarStyle }}>
        {sidebarContent}
      </div>

      {/* MOBILE hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="mobile-menu-btn"
        style={{
          display: "none",
          position: "fixed", top: 16, left: 16, zIndex: 100,
          width: 40, height: 40, borderRadius: 10,
          background: "rgba(10,13,26,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#F1F5F9", fontSize: 18,
          alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >☰</button>

      {/* MOBILE overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 98,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* MOBILE sidebar */}
      <div
        style={{
          display: mobileOpen ? "flex" : "none",
          flexDirection: "column",
          position: "fixed", left: 0, top: 0, bottom: 0,
          zIndex: 99,
          ...sidebarStyle,
        }}
      >
        {sidebarContent}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
