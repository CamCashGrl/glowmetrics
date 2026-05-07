"use client"
import React, { useState, useCallback } from "react"

// Token rates (per token)
const PLATFORM_RATES = {
  "Chaturbate":  { tokens: 1, usd: 0.05 },
  "Stripchat":   { tokens: 1, usd: 0.05 },
  "MyFreeCams":  { tokens: 1, usd: 0.05 },
  "CamSoda":     { tokens: 1, usd: 0.05 },
  "BongaCams":   { tokens: 1, usd: 0.05 },
  "LiveJasmin":  { tokens: 1, usd: 0.05 },
}

// Chaturbate payout tiers
const CB_TIERS = [
  { min: 0,     max: 999,   rate: 0.05 },
  { min: 1000,  max: 4999,  rate: 0.053 },
  { min: 5000,  max: Infinity, rate: 0.055 },
]

function getCBRate(tokens) {
  return CB_TIERS.find(t => tokens >= t.min && tokens <= t.max)?.rate ?? 0.05
}

function TokenCalculatorPanel({ onClose }) {
  const [tokens, setTokens]       = useState("")
  const [platform, setPlatform]   = useState("Chaturbate")
  const [customRate, setCustomRate] = useState("")
  const [useCustom, setUseCustom] = useState(false)

  const numTokens = parseFloat(tokens) || 0
  const rate = useCustom && customRate !== ""
    ? parseFloat(customRate) || 0
    : platform === "Chaturbate"
      ? getCBRate(numTokens)
      : PLATFORM_RATES[platform]?.usd ?? 0.05

  const gross   = numTokens * rate
  const net30   = gross * 0.70
  const net35   = gross * 0.65
  const net40   = gross * 0.60
  const net50   = gross * 0.50

  const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#F1F5F9",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  }

  const labelStyle = {
    fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
    color: "#4B5E78", textTransform: "uppercase", marginBottom: 4,
    display: "block",
  }

  const rowStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    fontSize: 11,
  }

  return (
    <div style={{
      position: "fixed",
      left: 220,
      top: 0,
      bottom: 0,
      width: 260,
      background: "linear-gradient(180deg, #0c0f1e 0%, #08090f 100%)",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "4px 0 30px rgba(0,0,0,0.5)",
      zIndex: 49,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 16 }}>🧮</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>Token Calculator</span>
        </div>
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6, color: "#64748B",
          width: 24, height: 24, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px" }}>

        {/* Platform */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Platform</label>
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {Object.keys(PLATFORM_RATES).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Token count */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Token Count</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 5000"
            value={tokens}
            onChange={e => setTokens(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Custom rate toggle */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
              style={{ accentColor: "#22D3EE", width: 12, height: 12 }}
            />
            Custom Rate ($/token)
          </label>
          {useCustom && (
            <input
              type="number"
              min="0"
              step="0.001"
              placeholder="e.g. 0.053"
              value={customRate}
              onChange={e => setCustomRate(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        {/* Active rate display */}
        {platform === "Chaturbate" && !useCustom && numTokens > 0 && (
          <div style={{
            fontSize: 10, color: "#22D3EE", marginBottom: 12,
            padding: "5px 10px", borderRadius: 6,
            background: "rgba(34,211,238,0.07)",
            border: "1px solid rgba(34,211,238,0.15)",
          }}>
            Tier rate: ${rate.toFixed(3)}/token ({numTokens >= 5000 ? "5k+" : numTokens >= 1000 ? "1k–4.9k" : "0–999"})
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", margin: "4px 0 10px" }} />

        {/* Results */}
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: "#4B5E78", textTransform: "uppercase", marginBottom: 6 }}>
          Estimated Earnings
        </div>

        <div style={{ marginBottom: 14 }}>
          {/* Gross */}
          <div style={{ ...rowStyle, paddingBottom: 8, marginBottom: 4 }}>
            <span style={{ color: "#64748B" }}>Gross</span>
            <span style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 15 }}>{fmt(gross)}</span>
          </div>
          {[
            { label: "After 30% cut", pct: "70%", val: net30 },
            { label: "After 35% cut", pct: "65%", val: net35 },
            { label: "After 40% cut", pct: "60%", val: net40 },
            { label: "After 50% cut", pct: "50%", val: net50 },
          ].map(({ label, pct, val }) => (
            <div key={label} style={rowStyle}>
              <div>
                <span style={{ color: "#64748B" }}>{label}</span>
                <span style={{ color: "#1e3a52", marginLeft: 4, fontSize: 9 }}>({pct} payout)</span>
              </div>
              <span style={{
                color: val > 0 ? "#4ADE80" : "#64748B",
                fontWeight: 600,
              }}>{fmt(val)}</span>
            </div>
          ))}
        </div>

        {/* Per-token summary */}
        {numTokens > 0 && (
          <div style={{
            padding: "8px 10px", borderRadius: 8,
            background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(236,72,153,0.06))",
            border: "1px solid rgba(59,130,246,0.15)",
            fontSize: 10, color: "#94A3B8",
          }}>
            <span style={{ color: "#22D3EE", fontWeight: 700 }}>{numTokens.toLocaleString()} tokens</span>
            {" "}@ {fmt(rate)}/token = {fmt(gross)} gross
          </div>
        )}
      </div>
    </div>
  )
}

// Token rates (per token)
const PLATFORM_RATES = {
  "Chaturbate":  { tokens: 1, usd: 0.05 },
  "Stripchat":   { tokens: 1, usd: 0.05 },
  "MyFreeCams":  { tokens: 1, usd: 0.05 },
  "CamSoda":     { tokens: 1, usd: 0.05 },
  "BongaCams":   { tokens: 1, usd: 0.05 },
  "LiveJasmin":  { tokens: 1, usd: 0.05 },
}

const CB_TIERS = [
  { min: 0,     max: 999,   rate: 0.05 },
  { min: 1000,  max: 4999,  rate: 0.053 },
  { min: 5000,  max: Infinity, rate: 0.055 },
]

function getCBRate(tokens) {
  return CB_TIERS.find(t => tokens >= t.min && tokens <= t.max)?.rate ?? 0.05
}

function TokenCalculatorPanel({ onClose }) {
  const [tokens, setTokens]         = useState("")
  const [platform, setPlatform]     = useState("Chaturbate")
  const [customRate, setCustomRate] = useState("")
  const [useCustom, setUseCustom]   = useState(false)

  const numTokens = parseFloat(tokens) || 0
  const rate = useCustom && customRate !== ""
    ? parseFloat(customRate) || 0
    : platform === "Chaturbate"
      ? getCBRate(numTokens)
      : PLATFORM_RATES[platform]?.usd ?? 0.05

  const gross = numTokens * rate
  const fmt   = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

  const inp = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
    color: "#F1F5F9", fontSize: 13, outline: "none", boxSizing: "border-box",
  }
  const lbl = {
    fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: "#4B5E78",
    textTransform: "uppercase", marginBottom: 4, display: "block",
  }
  const row = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11,
  }

  return (
    <div style={{
      position: "fixed", left: 220, top: 0, bottom: 0, width: 260,
      background: "linear-gradient(180deg,#0c0f1e 0%,#08090f 100%)",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "4px 0 30px rgba(0,0,0,0.5)",
      zIndex: 49, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 16 }}>🧮</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>Token Calculator</span>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#64748B", width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px" }}>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            {Object.keys(PLATFORM_RATES).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Token Count</label>
          <input type="number" min="0" placeholder="e.g. 5000" value={tokens} onChange={e => setTokens(e.target.value)} style={inp} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} style={{ accentColor: "#22D3EE", width: 12, height: 12 }} />
            Custom Rate ($/token)
          </label>
          {useCustom && (
            <input type="number" min="0" step="0.001" placeholder="e.g. 0.053" value={customRate} onChange={e => setCustomRate(e.target.value)} style={inp} />
          )}
        </div>

        {platform === "Chaturbate" && !useCustom && numTokens > 0 && (
          <div style={{ fontSize: 10, color: "#22D3EE", marginBottom: 12, padding: "5px 10px", borderRadius: 6, background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.15)" }}>
            Tier rate: ${rate.toFixed(3)}/token ({numTokens >= 5000 ? "5k+" : numTokens >= 1000 ? "1k–4.9k" : "0–999"})
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", margin: "4px 0 10px" }} />
        <div style={{ ...lbl, marginBottom: 6 }}>Estimated Earnings</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ ...row, paddingBottom: 8, marginBottom: 4 }}>
            <span style={{ color: "#64748B" }}>Gross</span>
            <span style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 15 }}>{fmt(gross)}</span>
          </div>
          {[
            { label: "After 30% cut", pct: "70%", val: gross * 0.70 },
            { label: "After 35% cut", pct: "65%", val: gross * 0.65 },
            { label: "After 40% cut", pct: "60%", val: gross * 0.60 },
            { label: "After 50% cut", pct: "50%", val: gross * 0.50 },
          ].map(({ label, pct, val }) => (
            <div key={label} style={row}>
              <div>
                <span style={{ color: "#64748B" }}>{label}</span>
                <span style={{ color: "#1e3a52", marginLeft: 4, fontSize: 9 }}>({pct} payout)</span>
              </div>
              <span style={{ color: val > 0 ? "#4ADE80" : "#64748B", fontWeight: 600 }}>{fmt(val)}</span>
            </div>
          ))}
        </div>

        {numTokens > 0 && (
          <div style={{ padding: "8px 10px", borderRadius: 8, background: "linear-gradient(135deg,rgba(59,130,246,0.08),rgba(236,72,153,0.06))", border: "1px solid rgba(59,130,246,0.15)", fontSize: 10, color: "#94A3B8" }}>
            <span style={{ color: "#22D3EE", fontWeight: 700 }}>{numTokens.toLocaleString()} tokens</span>
            {" "}@ {fmt(rate)}/token = {fmt(gross)} gross
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NAV SECTIONS ────────────────────────────────────────────────────────────
// Restructured to match the new 4-layer dashboard philosophy:
// Command (Overview) → Fan CRM → Analytics → Tools
const SECTIONS = [
  {
    id: "main",
    label: null,
    items: [
      { id: "overview",  icon: "⚡", label: "Command Center" },
    ],
  },
  {
    id: "fans",
    label: "FAN CRM",
    items: [
      { id: "whales",    icon: "👑", label: "Top Fans" },
    ],
  },
  {
    id: "analytics",
    label: "ANALYTICS",
    items: [
      { id: "platforms", icon: "🎯", label: "Platforms" },
      { id: "sessions",  icon: "🎥", label: "Sessions" },
      { id: "monthly",   icon: "📈", label: "Monthly" },
    ],
  },
  {
    id: "tools",
    label: "TOOLS",
    items: [
      { id: "live",       icon: "🔴", label: "Live Mode" },
      { id: "titles",     icon: "🎬", label: "Room Titles" },
      { id: "calculator", icon: "🧮", label: "Token Calc" },
      { id: "data",       icon: "📝", label: "Edit Data" },
    ],
  },
]

const BOTTOM_ITEMS = [
  { id: "upload", icon: "📥", label: "Import CSV" },
  { id: "help",   icon: "❓", label: "CSV Help" },
]

export default function Sidebar({ activeTab, onTabChange, user, onSignOut }) {
  const [hoveredId, setHoveredId]   = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
<<<<<<< HEAD
  const [calcOpen, setCalcOpen]     = useState(false)
=======
  const [calcOpen, setCalcOpen] = useState(false)
>>>>>>> 0be548388b0183b299b361428457364cedbdd343

  const renderItem = (id, icon, label) => {
    const isActive  = activeTab === id
    const isHovered = hoveredId === id
    return (
      <button
        key={id}
        onClick={() => {
          if (id === "calculator") { setCalcOpen(o => !o); return }
<<<<<<< HEAD
          onTabChange(id)
          setMobileOpen(false)
=======
          onTabChange(id); setMobileOpen(false)
>>>>>>> 0be548388b0183b299b361428457364cedbdd343
        }}
        onMouseEnter={() => setHoveredId(id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 9,
          border: isActive ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
          cursor: "pointer", textAlign: "left",
          fontSize: 13, fontWeight: isActive ? 600 : 400, letterSpacing: 0.1,
          color: isActive ? "#F1F5F9" : isHovered ? "#94A3B8" : "#4B5E78",
          background: isActive
            ? "linear-gradient(135deg,rgba(59,130,246,0.18),rgba(236,72,153,0.13))"
            : isHovered ? "rgba(255,255,255,0.04)" : "transparent",
          boxShadow: isActive ? "0 0 16px rgba(59,130,246,0.12)" : "none",
          position: "relative", overflow: "hidden",
          transition: "all 0.15s ease",
        }}
      >
        {isActive && (
          <div style={{
            position: "absolute", left: 0, top: "18%", bottom: "18%",
            width: 2.5, borderRadius: 2,
            background: "linear-gradient(180deg,#22D3EE,#EC4899)",
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
        {/* Active indicator dot for Command Center when tab is overview */}
        {id === "overview" && isActive && (
          <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", animation: "pulse-sb 2s infinite" }} />
        )}
      </button>
    )
  }

  const sidebarContent = (
    <>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 2px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(124,92,255,0.2); border-radius: 2px; }
        @keyframes pulse-sb { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
      `}</style>

      {/* TOP — logo + user */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: "linear-gradient(135deg,#22D3EE,#EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 12px rgba(34,211,238,0.3)", flexShrink: 0,
            }}>$</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9", letterSpacing: -0.3 }}>
              Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
            </span>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} style={{
              padding: "3px 8px", borderRadius: 5,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)",
              color: "#F87171", fontSize: 9, fontWeight: 700, cursor: "pointer",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
            >OUT</button>
          )}
        </div>

        {user && (
          <div style={{ fontSize: 10, color: "#2d3f55", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "linear-gradient(135deg,rgba(245,158,11,0.13),rgba(251,146,60,0.07))", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", boxShadow: "0 0 5px #F59E0B", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", letterSpacing: 0.5 }}>FREE BETA</div>
            <div style={{ fontSize: 9, color: "#FB923C" }}>All features unlocked</div>
          </div>
        </div>
      </div>

      {/* MIDDLE — scrollable nav */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        {SECTIONS.map((section, si) => (
          <div key={section.id} style={{ marginTop: si > 0 ? 14 : 0 }}>
            {section.label && (
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#1e3a52", textTransform: "uppercase", padding: "0 10px 5px" }}>
                {section.label}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {section.items.map(item => renderItem(item.id, item.icon, item.label))}
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM — pinned support + import */}
      <div style={{ padding: "8px 10px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#1e3a52", textTransform: "uppercase", padding: "0 10px 5px" }}>SUPPORT</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {BOTTOM_ITEMS.map(item => renderItem(item.id, item.icon, item.label))}
        </div>
      </div>
    </>
  )

  const sidebarStyle = {
    width: 220, display: "flex", flexDirection: "column", zIndex: 50,
    background: "linear-gradient(180deg,#0a0d1a 0%,#070910 100%)",
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
      <button onClick={() => setMobileOpen(true)} className="mobile-menu-btn" style={{
        display: "none", position: "fixed", top: 16, left: 16, zIndex: 100,
        width: 40, height: 40, borderRadius: 10,
        background: "rgba(10,13,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
        color: "#F1F5F9", fontSize: 18, alignItems: "center", justifyContent: "center",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}>☰</button>

      {/* MOBILE overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 98, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      )}

      {/* MOBILE sidebar */}
      <div style={{ display: mobileOpen ? "flex" : "none", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 99, ...sidebarStyle }}>
        {sidebarContent}
      </div>

      <style>{`
        @media (max-width: 768px) { .mobile-menu-btn { display: flex !important; } }
      `}</style>

      {calcOpen && <TokenCalculatorPanel onClose={() => setCalcOpen(false)} />}
    </>
  )
}