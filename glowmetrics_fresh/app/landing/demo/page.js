"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ── AuthPanel — defined OUTSIDE to prevent re-render on every keystroke ──────
function AuthPanel({
  id, isSignUp, setIsSignUp,
  email, setEmail, password, setPassword,
  authLoading, authMsg, authError,
  setAuthError, setAuthMsg,
  handleAuth, handleForgotPassword,
}) {
  const inp = {
    width: "100%", padding: "11px 14px", borderRadius: 8,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14, outline: "none", marginBottom: 10,
    boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s",
  }
  return (
    <div id={id} style={{
      background: "rgba(8,12,24,0.95)", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 18, padding: "28px 24px", backdropFilter: "blur(24px)",
      boxShadow: "0 0 0 1px rgba(34,211,238,0.07), 0 32px 64px rgba(0,0,0,0.6)",
      width: "100%",
    }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 40, borderRadius: 11,
          background: "linear-gradient(135deg,#22D3EE,#EC4899)",
          fontSize: 20, fontWeight: 900, color: "white", marginBottom: 10,
          boxShadow: "0 0 20px rgba(34,211,238,0.35)",
        }}>$</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>CamCash</div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
          {isSignUp ? "Free during beta · No credit card" : "Welcome back 💋"}
        </div>
      </div>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 18 }}>
        {[["Sign Up", true], ["Log In", false]].map(([label, val]) => (
          <button key={label} type="button"
            onClick={() => { setIsSignUp(val); setAuthError(""); setAuthMsg("") }}
            style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, background: isSignUp === val ? "rgba(34,211,238,0.12)" : "transparent", color: isSignUp === val ? "#22D3EE" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.2s" }}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={handleAuth}>
        <input type="email" placeholder="Email address" required value={email}
          onChange={e => setEmail(e.target.value)} style={inp}
          onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
        <input type="password" placeholder="Password" required value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ ...inp, marginBottom: isSignUp ? 4 : 0 }}
          onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
        {!isSignUp && (
          <div style={{ textAlign: "right", marginBottom: 12 }}>
            <button type="button" onClick={handleForgotPassword}
              style={{ fontSize: 12, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>
              Forgot password?
            </button>
          </div>
        )}
        {isSignUp && <div style={{ height: 12 }} />}
        {authError && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10, textAlign: "center" }}>{authError}</div>}
        {authMsg   && <div style={{ fontSize: 12, color: "#22D3EE",  marginBottom: 10, textAlign: "center" }}>{authMsg}</div>}
        <button type="submit" disabled={authLoading} style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: authLoading ? "rgba(34,211,238,0.2)" : "linear-gradient(135deg,#22D3EE,#EC4899)",
          color: "white", fontWeight: 700, fontSize: 15, border: "none",
          cursor: authLoading ? "not-allowed" : "pointer",
          boxShadow: authLoading ? "none" : "0 0 24px rgba(34,211,238,0.3)",
          transition: "all 0.2s",
        }}>
          {authLoading ? (isSignUp ? "Creating account…" : "Logging in…") : (isSignUp ? "Start Free →" : "Log In →")}
        </button>
      </form>
      {isSignUp && <p style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 12, marginBottom: 0 }}>No credit card · Free during beta · Cancel anytime</p>}
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [msgIndex, setMsgIndex]     = useState(0)
  const [copied, setCopied]         = useState(false)
  const [whaleIndex, setWhaleIndex] = useState(0)
  const [isSignUp, setIsSignUp]     = useState(true)
  const [email, setEmail]           = useState("")
  const [password, setPassword]     = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]       = useState("")
  const [authError, setAuthError]   = useState("")

  const messages = [
    "Hey 😘 I've been thinking about you... I'm live tonight ❤️",
    "Miss you 💕 come make tonight fun 🔥",
    "It's been a while… come back 😈",
  ]
  const whales = [
    { name: "user_ULTRAVIP999", spent: "$41,820", inactive: "520 days" },
    { name: "user_TOPSPENDERX", spent: "$33,140", inactive: "300 days" },
  ]

  useEffect(() => {
    const a = setInterval(() => {
      setMsgIndex(p => (p + 1) % messages.length)
      setWhaleIndex(p => (p + 1) % whales.length)
    }, 6000)
    return () => clearInterval(a)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard")
    })
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(messages[msgIndex])
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthLoading(true); setAuthError(""); setAuthMsg("")
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false) }
      else {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) router.push("/dashboard")
        else { setAuthMsg("Account created! Check your email to confirm, then log in."); setIsSignUp(false); setAuthLoading(false) }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false) }
      else router.push("/dashboard")
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setAuthError("Enter your email first."); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.camcashgrl.com/reset-password",
    })
    if (error) setAuthError(error.message)
    else setAuthMsg("Password reset email sent — check your inbox.")
  }

  const authPanelProps = {
    isSignUp, setIsSignUp, email, setEmail, password, setPassword,
    authLoading, authMsg, authError, setAuthError, setAuthMsg,
    handleAuth, handleForgotPassword,
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05070f", color: "#94A3B8", fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>

      {/* ── AMBIENT BG ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 800, height: 800, top: "-20%", right: "-10%", background: "radial-gradient(circle,rgba(34,211,238,0.06),transparent 65%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", width: 700, height: 700, bottom: "5%", left: "-15%", background: "radial-gradient(circle,rgba(236,72,153,0.06),transparent 65%)", filter: "blur(80px)" }} />
      </div>

      {/* ── NAV ── */}
      <nav style={{ position: "relative", zIndex: 10, padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "white", boxShadow: "0 0 16px rgba(34,211,238,0.35)" }}>$</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: -0.4 }}>
            Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/landing/demo" style={{ fontSize: 13, fontWeight: 600, color: "#22D3EE", textDecoration: "none", padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(34,211,238,0.25)", background: "rgba(34,211,238,0.05)", transition: "all 0.2s" }}>
            View Demo
          </a>
          <button onClick={() => document.getElementById("lp-auth-bottom")?.scrollIntoView({ behavior: "smooth" })}
            style={{ fontSize: 13, fontWeight: 600, color: "white", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", padding: "7px 18px", borderRadius: 8, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "72px 40px 60px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 64, alignItems: "center" }}>

          {/* Left */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22D3EE", textTransform: "uppercase", letterSpacing: 2, marginBottom: 18 }}>
              AI-powered creator operating system
            </div>

            <h1 style={{ fontSize: "clamp(38px,4.5vw,58px)", color: "white", fontWeight: 900, lineHeight: 1.05, marginBottom: 22, letterSpacing: -1.5 }}>
              Make More<br />
              Every Stream.
            </h1>

            <p style={{ fontSize: 18, lineHeight: 1.75, color: "#64748B", marginBottom: 36, maxWidth: 460 }}>
              CamCash tracks your top fans, finds your peak hours, compares your platform ROI, and tells you exactly what to do to earn more — from one place.
            </p>

            {/* HERO CTAs — both visible, demo is primary on left */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <a href="/landing/demo" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px", borderRadius: 12,
                background: "linear-gradient(135deg,#22D3EE,#EC4899)",
                color: "white", fontWeight: 800, fontSize: 15, textDecoration: "none",
                boxShadow: "0 0 32px rgba(34,211,238,0.35)", letterSpacing: 0.2,
              }}>
                👀 See Live Demo
              </a>
              <button className="lp-signup-btn"
                onClick={() => document.getElementById("lp-auth-bottom")?.scrollIntoView({ behavior: "smooth" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Start Free
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#334155" }}>No signup needed for the demo · Free account takes 2 minutes</div>

            {/* Trust bullets */}
            <div style={{ display: "flex", gap: 24, marginTop: 36, flexWrap: "wrap" }}>
              {[["⚡", "Ready in 2 minutes"], ["💸", "100% free in beta"], ["🔒", "Your data stays private"]].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — auth panel desktop */}
          <div className="lp-desktop-auth">
            <AuthPanel id="lp-auth-desktop" {...authPanelProps} />
          </div>
        </div>

        {/* Mobile auth */}
        <div id="lp-auth-mobile" className="lp-mobile-auth" style={{ display: "none", marginTop: 40 }}>
          <AuthPanel id="lp-auth-mobile-inner" {...authPanelProps} />
        </div>
      </div>

      {/* ── SOCIAL PROOF STRIP ── */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "28px 40px", background: "rgba(255,255,255,0.01)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, textAlign: "center" }}>
          {[
            ["$2.4M+", "Earnings tracked"],
            ["18,000+", "Sessions analyzed"],
            ["4", "Platforms supported"],
            ["Free", "During beta"],
          ].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 900, color: "white", letterSpacing: -0.5, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 12, color: "#334155", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DEMO SPOTLIGHT ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "72px 40px 56px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Live Demo</div>
          <div style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, color: "white", letterSpacing: -0.8, marginBottom: 14 }}>
            See exactly what you'd get — before signing up
          </div>
          <p style={{ fontSize: 16, color: "#475569", maxWidth: 520, margin: "0 auto" }}>
            We pre-loaded a full demo with a real multi-platform streamer's data. Click through every tab. No account needed.
          </p>
        </div>

        {/* Demo preview card */}
        <div style={{ borderRadius: 20, background: "rgba(8,12,24,0.9)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", boxShadow: "0 0 0 1px rgba(34,211,238,0.06), 0 40px 100px rgba(0,0,0,0.7)", marginBottom: 32 }}>
          {/* Window chrome */}
          <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F87171", opacity: 0.7 }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", opacity: 0.7 }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", opacity: 0.7 }} />
            <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#334155", fontFamily: "monospace" }}>camcashgrl.com/landing/demo</div>
          </div>
          {/* Mock dashboard preview */}
          <div style={{ padding: "20px 24px" }}>
            {/* Command card mock */}
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "linear-gradient(135deg,rgba(34,211,238,0.1),rgba(124,92,255,0.06))", border: "1px solid rgba(34,211,238,0.3)", marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "#22D3EE", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>⚡ BEST MOVE RIGHT NOW</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 6 }}>Go live on Chaturbate at 1 AM · in ~2h</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Historically <span style={{ color: "#F59E0B", fontWeight: 700 }}>$162/session</span></span>
                <span style={{ fontSize: 12, color: "#64748B" }}><span style={{ color: "#10B981", fontWeight: 700 }}>2 whales</span> likely online</span>
                <span style={{ fontSize: 12, color: "#64748B" }}>Expected <span style={{ color: "#10B981", fontWeight: 700 }}>$110–$220</span></span>
              </div>
            </div>
            {/* KPI strip mock */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
              {[["💰","This Month","$920"],["⏱️","Avg $/Hour","$116.20"],["🔁","Return Rate","62%"],["🎯","Tonight","$110–220"]].map(([icon,label,val]) => (
                <div key={label} style={{ padding: "12px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "white", marginBottom: 2 }}>{val}</div>
                  <div style={{ fontSize: 9, color: "#334155", textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Fan row mock */}
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#EC4899", marginBottom: 10 }}>👑 Fans to Focus On</div>
              {[
                { name:"kingwhale99",  badge:"Online now",     bc:"#10B981", sub:"likely online now · $1,000 lifetime" },
                { name:"vipmikey88",   badge:"Near milestone", bc:"#F59E0B", sub:"$75 from $400 milestone" },
                { name:"bonga_vip",    badge:"VIP",            bc:"#F59E0B", sub:"$275 lifetime · 3d ago" },
              ].map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", borderRadius:8, background:"rgba(255,255,255,0.02)", marginBottom:4 }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:`${f.bc}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:f.bc }}>{f.name[0].toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"white" }}>{f.name}</span>
                      <span style={{ fontSize:8, padding:"1px 6px", borderRadius:20, background:`${f.bc}15`, color:f.bc, fontWeight:700 }}>{f.badge}</span>
                    </div>
                    <div style={{ fontSize:10, color:"#475569" }}>{f.sub}</div>
                  </div>
                  <span style={{ fontSize:16, color:"#EC4899" }}>💌</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Demo CTA */}
        <div style={{ textAlign: "center" }}>
          <a href="/landing/demo" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "16px 40px", borderRadius: 14,
            background: "linear-gradient(135deg,#22D3EE,#EC4899)",
            color: "white", fontWeight: 800, fontSize: 17, textDecoration: "none",
            boxShadow: "0 0 40px rgba(34,211,238,0.4)", letterSpacing: 0.2,
          }}>
            👀 Open the Live Demo →
          </a>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 12 }}>No account needed · Explore all tabs · 30 seconds to see everything</div>
        </div>
      </div>

      {/* ── OPERATIONAL PILLARS ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "0 40px 72px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Everything in one place</div>
          <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 900, color: "white", letterSpacing: -0.8 }}>Run your creator business smarter</div>
        </div>
        <div className="pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {[
            {
              icon: "💰", color: "#10B981",
              title: "Revenue Intelligence",
              points: ["Earnings tracking across all platforms","$/hr by platform — see where you're worth more","Session performance vs your own average","Revenue trends and month-over-month growth"],
            },
            {
              icon: "👑", color: "#F59E0B",
              title: "Fan Relationship System",
              points: ["Top spender tracking and lifetime value","Churn risk alerts before fans go cold","Re-engagement messages — personalized, copy-ready","Milestone tracking — who's close to a new tier"],
            },
            {
              icon: "⏰", color: "#22D3EE",
              title: "Stream Optimization",
              points: ["Your personal peak hours from your own data","Best streaming day — by platform, not generic advice","Platform ROI comparison — Chaturbate vs BongaCams vs more","AI room title generator built from your tipping patterns"],
            },
            {
              icon: "⚡", color: "#EC4899",
              title: "Creator Command Center",
              points: ["Daily brief — what to do right now to earn more","Live mode coaching while you stream","Fan intelligence prioritized by revenue opportunity","One dashboard for everything — no more spreadsheets"],
            },
          ].map(({ icon, color, title, points }) => (
            <div key={title} style={{ padding: "28px 26px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = `${color}30` }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{title}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {points.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 6 }} />
                    <span style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── INTERACTIVE PREVIEW CARDS ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 40px 72px" }}>
        <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
          {/* Message generator */}
          <div style={{ padding: "24px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>💌</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Fan Re-engagement</div>
                <div style={{ fontSize: 11, color: "#334155" }}>Personalized messages — ready to copy</div>
              </div>
            </div>
            <div style={{ padding: "14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6, minHeight: 70, marginBottom: 14 }}>
              {messages[msgIndex]}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMsgIndex(p => (p + 1) % messages.length)}
                style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
                Regenerate
              </button>
              <button onClick={handleCopy}
                style={{ flex: 1, padding: "9px", borderRadius: 8, background: copied ? "rgba(16,185,129,0.15)" : "rgba(34,211,238,0.1)", border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(34,211,238,0.25)"}`, color: copied ? "#10B981" : "#22D3EE", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
          {/* Whale card */}
          <div style={{ padding: "24px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🐳</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>High-Value Fan</div>
                <div style={{ fontSize: 11, color: "#334155" }}>Your top spenders, ranked</div>
              </div>
            </div>
            <div style={{ padding: "14px", borderRadius: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 8, fontFamily: "monospace" }}>{whales[whaleIndex].name}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#F59E0B", marginBottom: 4 }}>{whales[whaleIndex].spent}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>inactive {whales[whaleIndex].inactive}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#475569" }}>
                <span style={{ color: "#F87171", fontWeight: 700 }}>At risk of churning</span> — a message could bring them back
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "0 40px 72px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Getting started</div>
        <div style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 900, color: "white", marginBottom: 44, letterSpacing: -0.5 }}>Up and earning in 2 minutes</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { n: "01", title: "Upload your CSV", body: "Export from Chaturbate, BongaCams, MFC, or Stripchat. Paste into Google Sheets → Download as CSV → upload here." },
            { n: "02", title: "AI analyzes your data", body: "CamCash reads your peak hours, top fans, platform ROI, and session patterns automatically. No setup required." },
            { n: "03", title: "Get your action plan", body: "Your Command Center tells you when to stream, who to message, and where to focus — updated with every import." },
          ].map(({ n, title, body }, i) => (
            <div key={n} style={{ display: "flex", gap: 20, padding: "22px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a52", fontFamily: "monospace", flexShrink: 0, paddingTop: 2 }}>{n}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div id="lp-auth-bottom" style={{ position: "relative", zIndex: 1, maxWidth: 500, margin: "0 auto", padding: "0 40px 100px", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, color: "white", marginBottom: 10, letterSpacing: -0.8 }}>
          Start running your creator business smarter.
        </div>
        <p style={{ fontSize: 15, color: "#475569", marginBottom: 32, lineHeight: 1.6 }}>
          Join creators using CamCash to optimize streams, understand fan behavior, and increase earnings. Free during beta.
        </p>
        <AuthPanel id="lp-auth-bottom-panel" {...authPanelProps} />
        <div style={{ marginTop: 20 }}>
          <a href="/landing/demo" style={{ fontSize: 13, color: "#475569", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 2 }}>
            Or explore the demo first →
          </a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#1e3a52" }}>© 2026 CamCash — Built for cam models who want to grow</div>
        <div style={{ fontSize: 12, color: "#1e3a52" }}>Your data is never shared · Encrypted · Private</div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .hero-grid       { grid-template-columns: 1fr !important; gap: 40px !important; }
          .lp-desktop-auth { display: none !important; }
          .lp-mobile-auth  { display: block !important; }
          .pillars-grid    { grid-template-columns: 1fr !important; }
          .feature-grid    { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
