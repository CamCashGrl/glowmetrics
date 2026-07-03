"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { T, captureAttribution } from '../../lib/tracking'
import { track } from '../../lib/track'

// Static data / style objects hoisted out of component bodies so they aren't
// recreated on every render.
const AUTH_INPUT_STYLE = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", fontSize: 13, outline: "none", marginBottom: 9,
  boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s",
}

// Button style shared with the onboarding flow (same gradient, shimmer sweep,
// and hover-lift as app/onboarding/page.js's OBBtn/OBSecBtn) so the CTA
// language is consistent from landing → onboarding. Keyframes + the shimmer
// pseudo-element live in globals.css (.lp-btn-primary) — a raw <style> tag
// here would cause an SSR/hydration text mismatch since quotes inside a
// <style> element aren't entity-decoded the same way client vs server.
const LP_GRAD = "linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)"

// Live password requirement checklist shown under the signup password field —
// keeps validation feedback readable instead of dumping Supabase's raw
// "Password should contain at least one character of each: abc...!@#..."
// error text on the page.
const PASSWORD_REQUIREMENTS = [
  { label: "8+ characters", test: pw => pw.length >= 8 },
  { label: "Uppercase letter", test: pw => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: pw => /[a-z]/.test(pw) },
  { label: "Number", test: pw => /[0-9]/.test(pw) },
  { label: "Symbol", test: pw => /[^A-Za-z0-9]/.test(pw) },
]

const PASSWORD_ERROR_PATTERN = /password should be at least|password should contain/i
const FRIENDLY_PASSWORD_ERROR = "Password must include 8+ characters, uppercase, lowercase, a number, and a symbol."

// Supabase's password policy error spells out the entire allowed character
// set inline — swap it for a short, human message. Every other auth error
// (bad credentials, rate limits, etc.) passes through unchanged.
function friendlyAuthError(message) {
  if (!message) return message
  return PASSWORD_ERROR_PATTERN.test(message) ? FRIENDLY_PASSWORD_ERROR : message
}

function PasswordChecklist({ password }) {
  const touched = password.length > 0
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", margin: "6px 0 10px", padding: "0 1px" }}>
      {PASSWORD_REQUIREMENTS.map(({ label, test }) => {
        const met = test(password)
        const color = met ? "#22D3EE" : touched ? "rgba(251,113,133,0.85)" : "#475569"
        return (
          <span key={label} style={{ fontSize: 11, lineHeight: 1.6, color, display: "inline-flex", alignItems: "center", gap: 5, transition: "color 0.2s ease" }}>
            <span style={{ fontSize: 8 }}>{met ? "●" : "○"}</span>
            {label}
          </span>
        )
      })}
    </div>
  )
}

function LPBtn({ as = "button", href, type, onClick, children, variant = "primary", disabled = false, style = {} }) {
  const Comp = as
  const isPrimary = variant === "primary"
  const baseStyle = isPrimary ? {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 28px", borderRadius: 12, border: "none",
    background: disabled ? "rgba(255,255,255,0.07)" : LP_GRAD,
    color: disabled ? "rgba(255,255,255,0.25)" : "white",
    fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em",
    textDecoration: "none", cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)",
    transition: "all 0.18s",
  } : {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 22px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: "rgba(203,213,225,0.85)",
    fontWeight: 700, fontSize: 14, textDecoration: "none", cursor: "pointer",
    transition: "all 0.18s",
  }
  const handlers = isPrimary ? {
    onMouseEnter: e => { if (!disabled) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 22px rgba(33,230,243,0.28),0 0 44px rgba(255,47,174,0.18),inset 0 1px 0 rgba(255,255,255,0.3)" } },
    onMouseLeave: e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = disabled ? "none" : "0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)" },
    onMouseDown: e => { if (!disabled) e.currentTarget.style.transform = "translateY(0)" },
  } : {
    onMouseEnter: e => { e.currentTarget.style.borderColor = "rgba(33,230,243,0.45)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(33,230,243,0.07)" },
    onMouseLeave: e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(203,213,225,0.85)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)" },
  }
  const extra = as === "a" ? { href } : { type: type || "button", disabled }
  return (
    <Comp className={isPrimary && !disabled ? "lp-btn-primary" : undefined} onClick={onClick} style={{ ...baseStyle, ...style }} {...handlers} {...extra}>
      {children}
    </Comp>
  )
}

const LIVE_PREVIEW_ALERTS = [
  { dot: "#10B981", text: "diamondkingx likely online — $9,750 lifetime" },
  { dot: "#F59E0B", text: "vaultmaster99 inactive 14d — re-engage now" },
  { dot: "#22D3EE", text: "Chaturbate outperforming MFC by 2.6x tonight" },
  { dot: "#EC4899", text: "Thursday peak window opens in 2h 14m" },
]

const MESSAGES = ["Hey 😘 I've been thinking about you... I'm live tonight ❤️","Miss you 💕 come make tonight fun 🔥","It's been a while… come back 😈"]
const WHALES = [
  { name: "diamondkingx",  spent: "$9,750", inactive: "2 days" },
  { name: "vaultmaster99", spent: "$4,400",  inactive: "2 days" },
  { name: "private_king",  spent: "$3,500",  inactive: "28 days" },
]

const FEATURE_PILLARS = [
  { icon:"💰", color:"#10B981", title:"Revenue Intelligence", desc:"Track earnings across every platform. See $/hr by platform, session performance vs your own baseline, and monthly revenue trends.", stats:[["$1,211/hr","Chaturbate peak"],["2.6x","CB vs MFC ratio"]] },
  { icon:"👑", color:"#F59E0B", title:"Fan Relationship System", desc:"Every high-value fan ranked by lifetime spend, churn risk, and tip probability. Know who's about to go cold before they disappear.", stats:[["72%","Revenue from top 3 fans"],["5.8x","Returning vs new spend"]] },
  { icon:"⏰", color:"#22D3EE", title:"Stream Timing Engine", desc:"Your peak hours calculated from your actual tip history — not industry averages. Know the exact hour and day to maximize every stream.", stats:[["1 AM UTC","Detected peak"],["+210%","Thursday vs avg"]] },
  { icon:"⚡", color:"#EC4899", title:"Creator Command Center", desc:"A daily brief that tells you exactly what to do: who to message, when to go live, which platform to prioritize, and which fans are at risk.", stats:[["Live Mode","Real-time coaching"],["AI Titles","Built from your data"]] },
]

const FREE_TOOLS = [
  { icon: "🪙", title: "Token Calculator", desc: "Convert tokens to USD instantly across all platforms", href: "/landing/demo#tools", color: "#22D3EE" },
  { icon: "🎬", title: "Room Title Generator", desc: "AI-powered titles using your peak hours and fan data", href: "/dashboard", color: "#EC4899", badge: "Requires account" },
  { icon: "#", title: "Hashtag Generator", desc: "Platform-specific hashtags for Chaturbate, MFC, Bonga", href: "/dashboard", color: "#7C5CFF", badge: "Requires account" },
  { icon: "📊", title: "Earnings Dashboard", desc: "Upload your CSV and see your full analytics in minutes", href: "/dashboard", color: "#10B981", badge: "Free beta" },
  { icon: "💌", title: "Fan Message Generator", desc: "Personalized re-engagement messages for your top fans", href: "/dashboard", color: "#F59E0B", badge: "Requires account" },
  { icon: "📈", title: "Platform ROI Tracker", desc: "See exactly which platform earns you more per hour", href: "/dashboard", color: "#60A5FA", badge: "Free beta" },
]

// Shared card shell for BLOG_LINK_CARDS — identical across every card in the
// original hand-duplicated markup, so it's hoisted once here.
const BLOG_CARD_STYLE = { padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 12 }

const BLOG_LINK_CARDS = [
  { href: "/blog/cam-model-earnings", icon: "💰", tag: "Earnings", color: "#10B981", title: "How Much Do Cam Models Actually Make?" },
  { href: "/blog/how-much-do-chaturbate-models-make", icon: "📊", tag: "Chaturbate", color: "#22D3EE", title: "How Much Do Chaturbate Models Make Per Hour?" },
  { href: "/blog/how-to-make-more-money-on-chaturbate", icon: "🔥", tag: "Strategy", color: "#EC4899", title: "How to Make More Money on Chaturbate" },
  { href: "/blog/how-to-re-engage-whales-and-top-tippers", icon: "🐳", tag: "Fan CRM", color: "#F59E0B", title: "How to Re-Engage Whales and Top Tippers" },
  { href: "/blog/how-to-build-loyal-fans", icon: "👑", tag: "Retention", color: "#7C5CFF", title: "How to Build a Loyal Fanbase" },
  { href: "/blog/why-cam-income-is-inconsistent", icon: "📈", tag: "Income", color: "#60A5FA", title: "Why Cam Income Is Inconsistent" },
  { href: "/blog/best-cam-model-tools", icon: "⚡", tag: "Tools", color: "#F59E0B", title: "Best Cam Model Tools" },
  { href: "/blog/cam-model-taxes", icon: "🧾", tag: "Business", color: "#64748B", title: "Cam Model Taxes Guide" },
  { href: "/blog/how-to-increase-cam-earnings", icon: "📈", tag: "Income", color: "#60A5FA", title: "How to Increase Cam Earnings" },
  { href: "/blog/why-cam-streams-arent-making-money", icon: "🚫", tag: "Earnings", color: "#10B981", title: "Why Your Streams Aren't Making Money" },
  { href: "/blog/how-to-get-veiws-on-chaturbate", icon: "👁", tag: "Growth", color: "#FB923C", title: "How to Get More Views on Chaturbate" },
  { href: "/blog/how-to-get-more-tips-on-myfreecams", icon: "💎", tag: "MFC", color: "#A78BFA", title: "How to Get More Tips on MyFreeCams" },
]

function AuthPanel({
  id, isSignUp, setIsSignUp,
  email, setEmail, password, setPassword,
  authLoading, authMsg, authError,
  setAuthError, setAuthMsg,
  handleAuth, handleForgotPassword,
}) {
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)

  const handleModeSelect = (val) => {
    setIsSignUp(val)
    setAuthError("")
    setAuthMsg("")
    setStep(2)
  }

  return (
    <div id={id} style={{
      background: "rgba(6,9,20,0.96)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "24px 22px", backdropFilter: "blur(24px)",
      boxShadow: "0 0 0 1px rgba(34,211,238,0.06), 0 24px 60px rgba(0,0,0,0.7)",
      width: "100%",
    }}>
      {/* Logo — always visible */}
      <div style={{ textAlign: "center", marginBottom: step === 1 ? 20 : 14 }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#22D3EE,#EC4899)", fontSize: 17, fontWeight: 900, color: "white", marginBottom: 8, boxShadow: "0 0 16px rgba(34,211,238,0.35)" }}>$</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>CamCash</div>
        {step === 1 && (
          <div style={{
            display: 'inline-block',
            background: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: '100px',
            padding: '4px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#a855f7',
            marginTop: '10px',
          }}>
            ✨ Free forever · No credit card needed
          </div>
        )}
        {step === 2 && (
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
            {isSignUp ? "No credit card required" : "Welcome back 💋"}
          </div>
        )}
      </div>

      {/* STEP 1 — choose mode */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <LPBtn onClick={() => handleModeSelect(true)} style={{ width: "100%", padding: "14px 0", borderRadius: 10 }}>
            Sign Up
          </LPBtn>
          <LPBtn variant="secondary" onClick={() => handleModeSelect(false)} style={{ width: "100%", padding: "14px 0", borderRadius: 10 }}>
            Log In
          </LPBtn>
        </div>
      )}

      {/* STEP 2 — form */}
      {step === 2 && (
        <>
          <button type="button" onClick={() => setStep(1)} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none", color: "#475569",
            fontSize: 12, cursor: "pointer", padding: "0 0 12px 0",
            fontFamily: "inherit",
          }}>
            ← Back
          </button>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email address" required value={email} onChange={e => setEmail(e.target.value)} style={AUTH_INPUT_STYLE}
              onFocus={e => { e.target.style.borderColor = "rgba(34,211,238,0.5)"; T.signupStarted(window?.location?.pathname) }}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} placeholder={isSignUp ? "Create a password" : "Password"} required value={password} onChange={e => setPassword(e.target.value)}
                style={{ ...AUTH_INPUT_STYLE, marginBottom: isSignUp ? 4 : 0, paddingRight: 38 }}
                onFocus={e => { e.target.style.borderColor = "rgba(34,211,238,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(34,211,238,0.12)" }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none" }} />
              <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 8, top: isSignUp ? 14 : 10, background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 13, padding: 4, lineHeight: 1, display: "flex", alignItems: "center" }}>
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            {isSignUp && <PasswordChecklist password={password} />}
            {!isSignUp && (
              <div style={{ textAlign: "right", marginBottom: 10 }}>
                <button type="button" onClick={handleForgotPassword} style={{ fontSize: 11, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>Forgot password?</button>
              </div>
            )}
            {authError && <div style={{ fontSize: 11.5, color: "rgba(251,113,133,0.9)", lineHeight: 1.5, marginTop: 2, marginBottom: 8, textAlign: "center" }}>{authError}</div>}
            {authMsg   && <div style={{ fontSize: 11.5, color: "#22D3EE", lineHeight: 1.5, marginTop: 2, marginBottom: 8, textAlign: "center" }}>{authMsg}</div>}
            <LPBtn type="submit" disabled={authLoading} onClick={() => T.signupCtaClicked(window?.location?.pathname)} style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14 }}>
              {authLoading ? (isSignUp ? "Creating account…" : "Logging in…") : (isSignUp ? "Start Free →" : "Log In →")}
            </LPBtn>
            {isSignUp && (
              <p style={{ fontSize: 10, color: "#334155", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
                By signing up you agree to our{" "}
                <a href="/terms" style={{ color: "#475569", textDecoration: "underline" }}>Terms</a>
                {" "}and{" "}
                <a href="/privacy" style={{ color: "#475569", textDecoration: "underline" }}>Privacy Policy</a>
              </p>
            )}
          </form>
        </>
      )}

      {/* Footer trust text — always visible */}
      <p style={{ fontSize: 10, color: "#334155", textAlign: "center", marginTop: 14, marginBottom: 0 }}>No credit card · Cancel anytime</p>
    </div>
  )
}

function LiveDashboardPreview() {
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 3200); return () => clearInterval(t) }, [])
  const a = LIVE_PREVIEW_ALERTS[tick % LIVE_PREVIEW_ALERTS.length]
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "rgba(6,9,20,0.95)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(34,211,238,0.05), 0 40px 100px rgba(0,0,0,0.8)" }}>
      <div style={{ padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.02)" }}>
        {["#F87171","#F59E0B","#10B981"].map((c,i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.7 }} />)}
        <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#1e3a52", fontFamily: "monospace" }}>camcashgrl.com/dashboard</div>
        <div style={{ fontSize: 10, color: "#10B981", fontWeight: 600 }}>● LIVE</div>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg,rgba(34,211,238,0.1),rgba(124,92,255,0.06))", border: "1px solid rgba(34,211,238,0.3)", marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#22D3EE", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>⚡ BEST MOVE RIGHT NOW</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "white", marginBottom: 6 }}>Go live on Chaturbate at 1 AM · in 2h 14m</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>Historically <span style={{ color: "#F59E0B", fontWeight: 700 }}>$1,450/session</span></span>
            <span style={{ fontSize: 11, color: "#64748B" }}><span style={{ color: "#10B981", fontWeight: 700 }}>2 whales</span> likely online</span>
            <span style={{ fontSize: 11, color: "#64748B" }}>Expected <span style={{ color: "#10B981", fontWeight: 700 }}>$1,100–$2,200</span></span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
          {[["This Month","$19,700","#60A5FA"],["Avg $/Hour","$965","#22D3EE"],["Return Rate","71%","#10B981"],["Tonight","$1.1–2.2K","#F59E0B"]].map(([l,v,c]) => (
            <div key={l} style={{ padding: "10px 8px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: c, marginBottom: 2 }}>{v}</div>
              <div style={{ fontSize: 8, color: "#334155", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Platform ROI</div>
          {[["CB","$1,211/hr",100,"#22D3EE"],["Bonga","$778/hr",64,"#EC4899"],["MFC","$473/hr",39,"#F59E0B"]].map(([n,v,p,c]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, fontSize: 9, color: "#64748B", textAlign: "right", flexShrink: 0 }}>{n}</div>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p}%`, background: c, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: c, width: 52, flexShrink: 0 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.dot, boxShadow: `0 0 6px ${a.dot}`, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "#94A3B8", flex: 1 }}>{a.text}</div>
          <div style={{ fontSize: 9, color: "#334155" }}>now</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Fan Intelligence</div>
          {[["diamondkingx","$9,750","Online now","#10B981"],["vaultmaster99","$4,400","Near $5K","#F59E0B"],["private_king","$3,500","At risk","#F87171"]].map(([u,v,b,c],i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, background: "rgba(255,255,255,0.02)", marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: c, flexShrink: 0 }}>{u[0].toUpperCase()}</div>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "white" }}>{u}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>{v}</div>
              <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 20, background: `${c}15`, color: c, fontWeight: 700 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color: "#1e3a52" }}>Updated 3 minutes ago</div>
        <div style={{ fontSize: 9, color: "#1e3a52" }}>3 platforms · 44 sessions</div>
      </div>
    </div>
  )
}


function TokenCalculator() {
  const [tokens, setTokens] = React.useState("")
  const rates = { Chaturbate: 0.05, BongaCams: 0.05, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05 }
  const t = parseFloat(tokens) || 0
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <input type="number" placeholder="Enter token amount" value={tokens} onChange={e => setTokens(e.target.value)}
          style={{ padding:"10px 14px", borderRadius:9, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(34,211,238,0.3)", color:"#F1F5F9", fontSize:14, outline:"none", width:200 }} />
        <span style={{ fontSize:13, color:"#475569" }}>tokens =</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:8 }}>
        {Object.entries(rates).map(([plat, rate]) => (
          <div key={plat} style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize:11, color:"#475569", marginBottom:3 }}>{plat}</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#22D3EE" }}>${(t * rate).toFixed(2)}</div>
            <div style={{ fontSize:10, color:"#334155" }}>${rate}/token</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [msgIndex, setMsgIndex] = useState(0)
  const [copied, setCopied]     = useState(false)
  const [whaleIdx, setWhaleIdx] = useState(0)
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]   = useState("")
  const [authError, setAuthError] = useState("")

  useEffect(() => {
    const a = setInterval(() => { setMsgIndex(p => (p+1)%MESSAGES.length); setWhaleIdx(p => (p+1)%WHALES.length) }, 5000)
    return () => clearInterval(a)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) router.replace("/dashboard") })
  }, [])

  useEffect(() => { captureAttribution() }, [])

  const handleCopy = () => { navigator.clipboard.writeText(MESSAGES[msgIndex]); setCopied(true); setTimeout(() => setCopied(false), 1200) }

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(""); setAuthMsg("")
    if (isSignUp) {
      track('signup_started')
      const captchaRes = await fetch('/api/auth/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const captchaData = await captchaRes.json()
      if (!captchaData.ok) { setAuthError(captchaData.error || 'Security check failed.'); setAuthLoading(false); return }
      let attribution = null
      try { attribution = JSON.parse(localStorage.getItem('camcash_attribution') || 'null') } catch {}
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthError(friendlyAuthError(error.message)); setAuthLoading(false) }
      else {
        if (typeof twq === 'function') twq('event', 'tw-rc0w2-rcj9h', {})
        fetch('/api/admin/notify-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source: 'landing' }) }).catch(() => {})
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          if (attribution) {
            supabase.from('profiles').update({
              utm_source: attribution.utm_source || null,
              utm_medium: attribution.utm_medium || null,
              utm_campaign: attribution.utm_campaign || null,
              utm_content: attribution.utm_content || null,
              utm_term: attribution.utm_term || null,
              referrer: attribution.referrer || null,
              attributed_landing_page: attribution.landing_page || null,
              attributed_at: new Date().toISOString(),
            }).eq('id', user.id).then(({ error: e }) => {
              if (e) console.warn('[UTM] profile update failed:', e.message)
              else try { localStorage.removeItem('camcash_attribution') } catch {}
            })
          }
          track('signup_success'); T.signupCompleted(window?.location?.pathname); router.push("/onboarding")
        }
        else { setAuthMsg("Account created! Check your email to confirm, then log in."); setIsSignUp(false); setAuthLoading(false) }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(friendlyAuthError(error.message)); setAuthLoading(false) }
      else {
        track('login_success')
        // Check if onboarding is complete
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase
          .from('beta_users')
          .select('onboarding_complete')
          .eq('user_id', user.id)
          .single()

        if (profile?.onboarding_complete) {
          router.push('/dashboard')
        } else {
          router.push('/onboarding')
        }
      }
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setAuthError("Enter your email first."); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://www.camcashgrl.com/reset-password" })
    if (error) setAuthError(friendlyAuthError(error.message))
    else setAuthMsg("Password reset email sent — check your inbox.")
  }

  const authPanelProps = { isSignUp, setIsSignUp, email, setEmail, password, setPassword, authLoading, authMsg, authError, setAuthError, setAuthMsg, handleAuth, handleForgotPassword }

  return (
    <div style={{ minHeight: "100vh", background: "#05070f", color: "#94A3B8", overflowX: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 900, height: 900, top: "-20%", right: "-15%", background: "radial-gradient(circle,rgba(34,211,238,0.055),transparent 60%)", filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: 700, height: 700, bottom: "0%", left: "-20%", background: "radial-gradient(circle,rgba(236,72,153,0.055),transparent 60%)", filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: 500, height: 500, top: "40%", left: "40%", background: "radial-gradient(circle,rgba(124,92,255,0.04),transparent 60%)", filter: "blur(80px)" }} />
      </div>

      {/* NAV */}
      <nav style={{ position: "relative", zIndex: 10, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "white", boxShadow: "0 0 14px rgba(34,211,238,0.3)" }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: -0.4 }}>Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span></span>
          <div style={{ marginLeft: 8, padding: "3px 8px", borderRadius: 20, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", fontSize: 10, color: "#22D3EE", fontWeight: 600 }}>Beta</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LPBtn as="a" href="/landing/demo" variant="secondary" style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>View Demo</LPBtn>
          <LPBtn variant="secondary" onClick={() => document.getElementById("lp-auth-bottom")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>Sign In</LPBtn>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto", padding: "64px 40px 48px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 56, alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20, padding: "4px 12px", borderRadius: 20, background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.18)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 5px #10B981", animation: "lp-pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>AI-powered creator intelligence platform</span>
            </div>
            <h1 style={{ fontSize: "clamp(34px,3.8vw,52px)", color: "white", fontWeight: 900, lineHeight: 1.06, marginBottom: 20, letterSpacing: -1.5 }}>
              Know Exactly When To<br />Stream, Who To<br />
              <span style={{ background: "linear-gradient(135deg,#22D3EE 20%,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Prioritize, And Where<br />You Earn Most.</span>
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "#64748B", marginBottom: 32, maxWidth: 480 }}>
              CamCash analyzes your streaming history to surface peak hours, track high-value fans, compare platform ROI, and tell you exactly what to do next — so you stop guessing and start earning more.
            </p>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <LPBtn as="a" href="/landing/demo" style={{ padding: "13px 28px", fontSize: 15 }}>
                👀 View Live Demo
              </LPBtn>
              <LPBtn variant="secondary" onClick={() => { T.signupCtaClicked(window?.location?.pathname); document.getElementById("lp-auth-bottom")?.scrollIntoView({ behavior: "smooth" }) }}
                style={{ padding: "13px 24px", fontSize: 15 }}>
                Start Free
              </LPBtn>
            </div>
            <div style={{ fontSize: 11, color: "#1e3a52" }}>No signup needed for the demo · Free account takes 2 minutes</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginTop: 32 }}>
              {[["⏰","Peak-hour detection from your own data"],["👑","Whale tracking & churn risk alerts"],["🎯","Platform ROI — $/hr by platform"],["💌","AI fan re-engagement messages"],["📊","Multi-platform session analytics"],["⚡","Daily action brief — what to do right now"]].map(([icon,text]) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-desktop-preview">
            <LiveDashboardPreview />
          </div>
        </div>
        <div id="lp-auth-mobile" className="lp-mobile-auth" style={{ display: "none", marginTop: 40 }}>
          <AuthPanel id="lp-auth-mobile-inner" {...authPanelProps} />
        </div>
      </div>

      {/* TRUST STRIP */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "22px 40px", background: "rgba(255,255,255,0.012)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, textAlign: "center" }}>
          {[["$2.4M+","Revenue analyzed"],["18,421","Sessions processed"],["1.2M+","Fan interactions"],["3","Platforms supported"],["Free","During beta"]].map(([v,l]) => (
            <div key={l}>
              <div style={{ fontSize: "clamp(18px,2vw,24px)", fontWeight: 900, color: "white", letterSpacing: -0.5, marginBottom: 3 }}>{v}</div>
              <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DEMO SPOTLIGHT */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "72px 40px 56px" }}>
        <div style={{ borderRadius: 20, background: "linear-gradient(135deg,rgba(34,211,238,0.07),rgba(124,92,255,0.07))", border: "1px solid rgba(34,211,238,0.2)", padding: "40px 48px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#22D3EE,#EC4899)" }} />
          <div className="demo-spotlight-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#22D3EE", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>✨ No signup required</div>
              <div style={{ fontSize: "clamp(22px,2.5vw,32px)", fontWeight: 900, color: "white", marginBottom: 12, letterSpacing: -0.5, lineHeight: 1.2 }}>See a real creator's<br />operational dashboard</div>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 24, maxWidth: 420 }}>Pre-loaded with a top-earning multi-platform creator's data — Chaturbate, BongaCams, and MyFreeCams. Every tab works. No account needed.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 28 }}>
                {[["👑","$9,750 top fan tracked with churn risk indicators"],["📊","Platform ROI: CB $1,211/hr vs MFC $473/hr"],["⏰","Peak hour heatmap built from real session data"],["💌","Fan re-engagement messages — personalized and copy-ready"]].map(([i,t]) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748B" }}><span>{i}</span><span>{t}</span></div>
                ))}
              </div>
              <LPBtn as="a" href="/landing/demo" style={{ padding: "14px 32px", fontSize: 16 }}>
                👀 Open Live Demo →
              </LPBtn>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 10 }}>No account needed · Explore every tab · 30 seconds</div>
            </div>
            {/* Mini heatmap preview */}
            <div className="demo-mini-preview" style={{ width: 220 }}>
              <div style={{ borderRadius: 12, background: "rgba(6,9,20,0.9)", border: "1px solid rgba(255,255,255,0.07)", padding: "14px" }}>
                <div style={{ fontSize: 9, color: "#22D3EE", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⏰ Earnings Heatmap</div>
                {/* Simple heatmap render */}
                {(() => {
                  const days=["M","T","W","T","F","S","S"]
                  const rows=[[0,.1,.05,0,0,0,.1,.4,.9],[0,.1,.05,0,0,0,.1,.3,.8],[0,.1,.05,0,0,0,.15,.4,1],[0,.05,.05,0,0,0,.1,.3,.7],[0,.1,.05,0,0,0,.2,.5,.95],[0,.15,.1,.05,0,0,.2,.45,.85],[0,.1,.05,0,0,0,.15,.4,.88]]
                  const hrs=["12a","3a","6a","9a","12p","3p","6p","9p"]
                  return (
                    <div>
                      <div style={{ display:"grid", gridTemplateColumns:"18px repeat(7,1fr)", gap:2, marginBottom:4 }}>
                        <div/>{days.map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:8, color:"#334155", fontWeight:700 }}>{d}</div>)}
                      </div>
                      {hrs.map((h,hi)=>(
                        <div key={h} style={{ display:"grid", gridTemplateColumns:"18px repeat(7,1fr)", gap:2, marginBottom:2 }}>
                          <div style={{ fontSize:7, color:"#334155", display:"flex", alignItems:"center" }}>{h}</div>
                          {rows.map((r,di)=>{
                            const v=r[hi]||0
                            const bg=v===0?"rgba(255,255,255,0.03)":v<0.3?"rgba(34,211,238,0.18)":v<0.6?"rgba(34,211,238,0.5)":v<0.85?"rgba(34,211,238,0.78)":"#22D3EE"
                            return <div key={di} style={{ height:9, borderRadius:2, background:bg }} />
                          })}
                        </div>
                      ))}
                      <div style={{ fontSize:8, color:"#1e3a52", marginTop:4 }}>darker = more earnings</div>
                    </div>
                  )
                })()}
                <div style={{ marginTop:10, padding:"8px 10px", borderRadius:8, background:"rgba(34,211,238,0.07)", border:"1px solid rgba(34,211,238,0.15)" }}>
                  <div style={{ fontSize:9, color:"#22D3EE", fontWeight:700, marginBottom:2 }}>Peak detected</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"white" }}>1 AM · Thursdays</div>
                  <div style={{ fontSize:10, color:"#64748B" }}>Avg $1,450/session</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE PILLARS */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "0 40px 72px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>The full system</div>
          <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 900, color: "white", letterSpacing: -0.8 }}>Everything a top creator needs to earn more</div>
        </div>
        <div className="pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {FEATURE_PILLARS.map(({ icon, color, title, desc, stats }) => (
            <div key={title} style={{ padding: "26px 24px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor=`${color}25` }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{title}</div>
              </div>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, marginBottom: 16 }}>{desc}</p>
              <div style={{ display: "flex", gap: 10 }}>
                {stats.map(([v,l]) => (
                  <div key={l} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: `${color}08`, border: `1px solid ${color}15` }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 2 }}>{v}</div>
                    <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: 0.3 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE CARDS */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "0 40px 72px" }}>
        <div className="cards-strip" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 16 }}>
          <div style={{ padding: "22px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>💌</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Fan Re-engagement</div><div style={{ fontSize: 10, color: "#334155" }}>AI-generated · personalized per fan</div></div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8", lineHeight: 1.6, minHeight: 65, marginBottom: 12 }}>{MESSAGES[msgIndex]}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMsgIndex(p => (p+1)%MESSAGES.length)} style={{ flex:1, padding:"8px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748B", fontSize:12, cursor:"pointer" }}>Regenerate</button>
              <button onClick={handleCopy} style={{ flex:1, padding:"8px", borderRadius:8, background:copied?"rgba(16,185,129,0.15)":"rgba(34,211,238,0.1)", border:`1px solid ${copied?"rgba(16,185,129,0.3)":"rgba(34,211,238,0.25)"}`, color:copied?"#10B981":"#22D3EE", fontSize:12, fontWeight:700, cursor:"pointer" }}>{copied?"✓ Copied":"Copy"}</button>
            </div>
          </div>
          <div style={{ padding: "22px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Platform ROI</div><div style={{ fontSize: 10, color: "#334155" }}>$/hour by platform</div></div>
            </div>
            {[["Chaturbate","$1,211/hr",100,"#22D3EE"],["BongaCams","$778/hr",64,"#EC4899"],["MyFreeCams","$473/hr",39,"#F59E0B"]].map(([p,v,pct,col]) => (
              <div key={p} style={{ marginBottom: 10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ fontSize:11, color:"#64748B" }}>{p}</span><span style={{ fontSize:11, fontWeight:700, color:col }}>{v}</span></div>
                <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}><div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:2 }} /></div>
              </div>
            ))}
            <div style={{ fontSize:10, color:"#334155", marginTop:8 }}>Chaturbate is 2.6x more efficient</div>
          </div>
          <div style={{ padding: "22px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>🐳</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Top Spender</div><div style={{ fontSize: 10, color: "#334155" }}>Ranked by lifetime value</div></div>
            </div>
            <div style={{ padding: "12px", borderRadius: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6, fontFamily: "monospace" }}>{WHALES[whaleIdx].name}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#F59E0B", marginBottom: 4 }}>{WHALES[whaleIdx].spent}</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>last active {WHALES[whaleIdx].inactive} ago</div>
              <div style={{ marginTop: 8, fontSize: 10, color: WHALES[whaleIdx].inactive==="28 days"?"#F87171":"#10B981", fontWeight: 700 }}>
                {WHALES[whaleIdx].inactive==="28 days"?"⚠️ At risk of churning":"✓ Active — high tip probability"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "0 40px 72px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Getting started</div>
        <div style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 900, color: "white", marginBottom: 44, letterSpacing: -0.5 }}>Up and earning in 2 minutes</div>
        {[
          {n:"01",title:"Upload your CSV",body:"Export from Chaturbate, BongaCams, or MFC. Paste into Google Sheets → Download as CSV → upload here."},
          {n:"02",title:"AI analyzes your data",body:"CamCash reads your peak hours, top fans, platform ROI, and session patterns — automatically, from your real history."},
          {n:"03",title:"Get your action plan",body:"Your Command Center tells you when to stream, who to message, and where to focus — updated every time you import."},
        ].map(({ n, title, body }, i) => (
          <div key={n} style={{ display: "flex", gap: 20, padding: "22px 0", borderBottom: i<2?"1px solid rgba(255,255,255,0.05)":"none", textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1e3a52", fontFamily: "monospace", flexShrink: 0, paddingTop: 2 }}>{n}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FINAL CTA */}
      <div id="lp-auth-bottom" style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "0 40px 100px", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 900, color: "white", marginBottom: 10, letterSpacing: -0.8, lineHeight: 1.15 }}>Start earning more<br />from every stream.</div>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 32, lineHeight: 1.6 }}>Free during beta. No credit card. Upload your first CSV and see your intelligence dashboard in minutes.</p>
        <AuthPanel id="lp-auth-bottom-panel" {...authPanelProps} />
        <div style={{ marginTop: 18 }}>
          <a href="/landing/demo" style={{ fontSize: 12, color: "#334155", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 2 }}>Or explore the demo first →</a>
        </div>
      </div>

      
      {/* ── FREE TOOLS SECTION ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 40px 0", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Free Tools</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#F1F5F9", marginBottom: 8, letterSpacing: -0.5 }}>
          Tools every cam model needs
        </div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 36 }}>No account required — free forever</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
          {FREE_TOOLS.map(({ icon, title, desc, href, color, badge }) => (
            <a key={title} href={href} style={{ textDecoration: "none", display: "block" }}>
              <div style={{ padding: "20px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "left", transition: "all 0.15s", height: "100%" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = color + "30" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: color + "15", border: "1px solid " + color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
                  {badge && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: color + "15", color, fontWeight: 700, border: "1px solid " + color + "25" }}>{badge}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
                <div style={{ marginTop: 10, fontSize: 11, color, fontWeight: 600 }}>Use free →</div>
              </div>
            </a>
          ))}
        </div>

        {/* Token calculator inline */}
        <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 16, padding: "24px 28px", marginBottom: 16, textAlign: "left" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F1F5F9", marginBottom: 4 }}>🪙 Token → USD Calculator</div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>Calculate your real earnings from tokens across platforms</div>
          <TokenCalculator />
        </div>
      </div>

      
      <div style={{ maxWidth:1000, margin:"0 auto", padding:"52px 32px 0" }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>Free Tools</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8",fontSize:13,fontWeight:600,textDecoration:"none"}}>🪙 Token Calculator</a>
              <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8",fontSize:13,fontWeight:600,textDecoration:"none"}}>🎬 Room Title Generator</a>
              <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8",fontSize:13,fontWeight:600,textDecoration:"none"}}>#️⃣ Hashtag Generator</a>
              <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8",fontSize:13,fontWeight:600,textDecoration:"none"}}>💌 Message Generator</a>
              <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8",fontSize:13,fontWeight:600,textDecoration:"none"}}>📊 Earnings Dashboard</a>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:2, marginBottom:6 }}>Resources</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#F1F5F9" }}>Learn how to earn more</div>
          </div>
          <a href="/blog" style={{ fontSize:12, color:"#22D3EE", textDecoration:"none", fontWeight:600 }}>View all →</a>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:8, marginBottom:8 }}>
          {BLOG_LINK_CARDS.map(({ href, icon, tag, color, title }) => (
            <a key={href} href={href} style={{ textDecoration:"none" }}>
              <div style={BLOG_CARD_STYLE}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.025)"}}>
                <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:color+"18",color,fontWeight:700,display:"inline-block",marginBottom:3}}>{tag}</span>
                  <div style={{fontSize:12,fontWeight:700,color:"#F1F5F9",lineHeight:1.4}}>{title}</div>
                </div>
                <span style={{fontSize:12,color,flexShrink:0}}>→</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      
      {/* ── LEGAL FOOTER ── */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:32, padding:"20px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ fontSize:11, color:"#1e3a52" }}>© 2026 CamCash — Built for cam models who want to grow</div>
        <div style={{ display:"flex", gap:16 }}>
          <a href="#" style={{ fontSize:11, color:"#1e3a52", textDecoration:"none" }}>Privacy Policy</a>
          <a href="#" style={{ fontSize:11, color:"#1e3a52", textDecoration:"none" }}>Terms</a>
        </div>
      </div>

    </div>
  )
}
