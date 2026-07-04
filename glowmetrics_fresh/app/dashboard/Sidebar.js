"use client"
import { useState } from "react"
import Button from "../../components/ui/Button"

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7"
}

const PRO_BENEFITS = [
  "Track multiple platforms (Chaturbate, BongaCams, MyFreeCams & more)",
  "Save analytics history forever",
  "AI learns your patterns",
  "Performance trends & insights",
  "Multi-month tracking",
  "Fan behavior analysis",
  "Creator benchmarking",
  "Predictive coaching",
]

async function startCheckout(planType, setLoading) {
  setLoading(planType)
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_type: planType }),
    })
    if (res.status === 401) { window.location.href = `/login?plan=${planType}`; return }
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert('Something went wrong. Please try again.')
  } catch {
    alert('Something went wrong. Please try again.')
  } finally {
    setLoading(null)
  }
}

function UpgradeModal({ onClose }) {
  const [loading, setLoading] = useState(null)
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(15,20,32,0.98)", backdropFilter: "blur(24px)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 70px rgba(34,211,238,0.18), 0 0 130px rgba(236,72,153,0.12)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.pink})` }} />
        <div style={{ padding: 30 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: C.pink, marginBottom: 8 }}>Upgrade to Pro</div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: C.white, marginBottom: 6 }}>Unlock everything CamCash can do</h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Multi-platform tracking, unlimited history, and AI-driven insights.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
            {PRO_BENEFITS.map(b => (
              <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: "rgba(226,232,240,0.9)", lineHeight: 1.5 }}>
                <span style={{ color: C.cyan, fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 14, padding: 16, marginBottom: 10, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, right: 0, background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, borderRadius: "0 14px 0 10px", padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>BEST DEAL</div>
            <div style={{ fontSize: 11, color: C.pink, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Early Adopter — locked for life</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: C.white }}>$9.99</span>
              <span style={{ fontSize: 12, color: C.muted }}>/month</span>
            </div>
            <button
              onClick={() => startCheckout('early_adopter_monthly', setLoading)}
              disabled={loading !== null}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: loading ? "wait" : "pointer", background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 0 20px rgba(236,72,153,0.35)" }}>
              {loading === 'early_adopter_monthly' ? 'Redirecting…' : 'Subscribe — $9.99/mo →'}
            </button>
          </div>

          <button
            onClick={() => startCheckout('standard_monthly', setLoading)}
            disabled={loading !== null}
            style={{ width: "100%", padding: "11px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", cursor: loading ? "wait" : "pointer", background: "rgba(255,255,255,0.04)", color: "rgba(226,232,240,0.85)", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            {loading === 'standard_monthly' ? 'Redirecting…' : 'Standard — $19.99/mo →'}
          </button>

          <div style={{ textAlign: "center" }}>
            <a href="/pricing" style={{ fontSize: 12, color: C.cyan, textDecoration: "underline" }}>See full plan comparison</a>
            <span style={{ color: C.muted, margin: "0 8px" }}>·</span>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 12, color: C.muted, cursor: "pointer" }}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  )
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
  const [showUpgrade, setShowUpgrade] = useState(false)

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
        <Button onClick={() => setShowUpgrade(true)} style={{ width: "100%", marginBottom: 10, fontSize: 13, padding: "11px 12px" }}>
          ✦ Upgrade to Pro
        </Button>
      )}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

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
