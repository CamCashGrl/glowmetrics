"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import SiteFooter from "../components/SiteFooter"

// ── AuthPanel defined OUTSIDE LandingPage so React doesn't re-create the
//    component type on every render (prevents input losing focus)
function AuthPanel({
  id, isSignUp, setIsSignUp,
  email, setEmail,
  password, setPassword,
  authLoading, authMsg, authError,
  setAuthError, setAuthMsg,
  handleAuth, handleForgotPassword,
}) {
  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 8,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "white", fontSize: 14, outline: "none", marginBottom: 10,
    boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.15s",
  }

  return (
    <div id={id} style={{
      background: "rgba(10,14,26,0.92)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18, padding: "28px 24px",
      backdropFilter: "blur(24px)",
      boxShadow: "0 0 0 1px rgba(34,211,238,0.06), 0 24px 60px rgba(0,0,0,0.6)",
      width: "100%",
    }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 38, height: 38, borderRadius: 10,
          background: "linear-gradient(135deg,#22D3EE,#EC4899)",
          fontSize: 18, fontWeight: 900, color: "white", marginBottom: 10,
          boxShadow: "0 0 20px rgba(34,211,238,0.3)",
        }}>$</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "white", letterSpacing: -0.3 }}>CamCash</div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
          {isSignUp ? "Free during beta · No credit card" : "Welcome back 💋"}
        </div>
      </div>

      <div style={{
        display: "flex", borderRadius: 8, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)", marginBottom: 18,
        background: "rgba(255,255,255,0.03)",
      }}>
        {[["Sign Up", true], ["Log In", false]].map(([label, val]) => (
          <button key={label} type="button"
            onClick={() => { setIsSignUp(val); setAuthError(""); setAuthMsg("") }}
            style={{
              flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600,
              background: isSignUp === val ? "rgba(34,211,238,0.12)" : "transparent",
              color: isSignUp === val ? "#22D3EE" : "rgba(255,255,255,0.3)",
              border: "none", cursor: "pointer", transition: "all 0.2s",
            }}>
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAuth}>
        <input type="email" placeholder="Email address" required
          value={email} onChange={e => setEmail(e.target.value)} style={inputStyle}
          onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
        />
        <input type="password" placeholder="Password" required
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: isSignUp ? 4 : 0 }}
          onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
        />

        {!isSignUp && (
          <div style={{ textAlign: "right", marginBottom: 12 }}>
            <button type="button" onClick={handleForgotPassword}
              style={{ fontSize: 12, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>
              Forgot password?
            </button>
          </div>
        )}
        {isSignUp && <div style={{ height: 14 }} />}

        {authError && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10, textAlign: "center" }}>{authError}</div>}
        {authMsg   && <div style={{ fontSize: 12, color: "#22D3EE",  marginBottom: 10, textAlign: "center" }}>{authMsg}</div>}

        <button type="submit" disabled={authLoading} style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: authLoading
            ? "rgba(34,211,238,0.2)"
            : "linear-gradient(135deg,#22D3EE,#EC4899)",
          color: "white", fontWeight: 700, fontSize: 15, border: "none",
          cursor: authLoading ? "not-allowed" : "pointer",
          boxShadow: authLoading ? "none" : "0 0 24px rgba(34,211,238,0.25)",
          transition: "all 0.2s", letterSpacing: 0.2,
        }}>
          {authLoading
            ? (isSignUp ? "Creating account…" : "Logging in…")
            : (isSignUp ? "Start Free →" : "Log In →")}
        </button>
      </form>

      {isSignUp && (
        <p style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 12, marginBottom: 0 }}>
          No credit card · Free during beta · Cancel anytime
        </p>
      )}
    </div>
  )
}

// ── LIVE DEMO PANEL — cycles through 3 states ──────────────────────────────
const DEMO_STATES = [
  {
    state: "before",
    label: "BEFORE STREAM",
    labelColor: "#22D3EE",
    headline: "Best Move Right Now",
    command: "Go live on Chaturbate in 42m",
    items: [
      { icon: "💰", text: "Expected earnings", value: "$90–$180", color: "#10B981" },
      { icon: "🐳", text: "Whales likely online", value: "2 VIPs", color: "#F59E0B" },
      { icon: "🎯", text: "Best platform tonight", value: "Chaturbate", color: "#22D3EE" },
      { icon: "⏰", text: "Your peak window", value: "1 AM UTC", color: "#A78BFA" },
    ],
  },
  {
    state: "during",
    label: "DURING STREAM",
    labelColor: "#10B981",
    headline: "Live Session Monitor",
    command: "Revenue velocity climbing",
    items: [
      { icon: "📈", text: "Revenue velocity", value: "+18%", color: "#10B981" },
      { icon: "🔁", text: "Returning tippers", value: "rising", color: "#22D3EE" },
      { icon: "⚠️", text: "Viewer conversion", value: "dropping", color: "#F59E0B" },
      { icon: "💡", text: "Try higher interaction", value: "prompts", color: "#A78BFA" },
    ],
  },
  {
    state: "after",
    label: "AFTER STREAM",
    labelColor: "#EC4899",
    headline: "Session Review Ready",
    command: "You beat your Tuesday avg by 21%",
    items: [
      { icon: "🏆", text: "vs your avg session", value: "+21%", color: "#10B981" },
      { icon: "⏱️", text: "Best hour discovered", value: "1 AM", color: "#22D3EE" },
      { icon: "🎯", text: "Highest ROI platform", value: "CB", color: "#F59E0B" },
      { icon: "💌", text: "Fans to re-engage", value: "3 fans", color: "#EC4899" },
    ],
  },
]

function LiveDemoPanel() {
  const [stateIdx, setStateIdx] = useState(0)
  const [tick, setTick] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setTransitioning(true)
      setTimeout(() => {
        setStateIdx(i => (i + 1) % DEMO_STATES.length)
        setTick(t => t + 1)
        setTransitioning(false)
      }, 300)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Fake mini bar chart data
  const bars = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88]
  const demo = DEMO_STATES[stateIdx]

  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div style={{
      borderRadius: 16,
      background: "rgba(8,10,20,0.95)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
      overflow: "hidden",
      boxShadow: "0 0 0 1px rgba(34,211,238,0.06), 0 32px 80px rgba(0,0,0,0.7)",
    }}>
      {/* Window chrome */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171", opacity: 0.7 }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", opacity: 0.7 }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", opacity: 0.7 }} />
        <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#334155", fontFamily: "monospace" }}>camcashgrl.com/dashboard</div>
        <div style={{ fontSize: 10, color: "#334155" }}>{timeStr}</div>
      </div>

      {/* State indicator tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {DEMO_STATES.map((s, i) => (
          <button key={i} onClick={() => { setTransitioning(true); setTimeout(() => { setStateIdx(i); setTransitioning(false) }, 200) }}
            style={{
              flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
              background: i === stateIdx ? `${s.labelColor}10` : "transparent",
              borderBottom: i === stateIdx ? `2px solid ${s.labelColor}` : "2px solid transparent",
              color: i === stateIdx ? s.labelColor : "#334155",
              border: "none", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase",
            }}>{s.label}</button>
        ))}
      </div>

      <div style={{ padding: "18px 18px 16px", opacity: transitioning ? 0 : 1, transition: "opacity 0.25s" }}>
        {/* Live badge + headline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: demo.labelColor, boxShadow: `0 0 6px ${demo.labelColor}`, animation: "lp-pulse 2s infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: demo.labelColor, textTransform: "uppercase", letterSpacing: 0.8 }}>AI Command</span>
          </div>
          <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>Updated {timeStr}</span>
        </div>

        {/* Main command */}
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: `${demo.labelColor}0d`, border: `1px solid ${demo.labelColor}20` }}>
          <div style={{ fontSize: 9, color: demo.labelColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{demo.headline}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "white", lineHeight: 1.3 }}>{demo.command}</div>
        </div>

        {/* Data rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {demo.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.025)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{item.text}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 9, color: "#334155", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Earnings by hour</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 32 }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: "2px 2px 0 0",
                height: `${h}%`,
                background: i === 10
                  ? "linear-gradient(180deg,#22D3EE,#22D3EE80)"
                  : "rgba(255,255,255,0.07)",
                transition: "height 0.4s ease",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8, color: "#1e3a52" }}>
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN LANDING PAGE ────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()

  // Auth state
  const [isSignUp, setIsSignUp]       = useState(true)
  const [email, setEmail]             = useState("")
  const [password, setPassword]       = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]         = useState("")
  const [authError, setAuthError]     = useState("")

  // Demo cycling state for feature cards
  const [msgIndex, setMsgIndex]       = useState(0)
  const [whaleIndex, setWhaleIndex]   = useState(0)
  const [copied, setCopied]           = useState(false)

  const messages = [
    "Hey, I was just thinking about you 💕 Going live tonight — come say hi?",
    "Miss you 😘 It's been a minute. I'm on tonight — would love to see you there 🔥",
    "Hey love 💕 I'm going live soon and always have more fun when you're around 💋",
  ]
  const whales = [
    { name: "user_ULTRAVIP999", spent: "$41,820", days: "520 days ago", pct: "23%" },
    { name: "user_TOPSPENDERX", spent: "$33,140", days: "300 days ago", pct: "18%" },
  ]

  useEffect(() => {
    const a = setInterval(() => {
      setMsgIndex(p => (p + 1) % messages.length)
      setWhaleIndex(p => (p + 1) % whales.length)
    }, 5000)
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
    setTimeout(() => setCopied(false), 1400)
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
    <div style={{ minHeight: "100vh", background: "#05070f", color: "#94A3B8", fontFamily: "'DM Sans', 'Inter', sans-serif", overflowX: "hidden" }}>

      {/* ── AMBIENT BACKGROUND ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 700, height: 700, top: "-15%", right: "-5%", background: "radial-gradient(circle,rgba(34,211,238,0.07),transparent 65%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle,rgba(236,72,153,0.07),transparent 65%)", filter: "blur(60px)" }} />
      </div>

      {/* ── NAV ── */}
      <nav style={{ position: "relative", zIndex: 10, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "white", boxShadow: "0 0 14px rgba(34,211,238,0.3)" }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: -0.4 }}>Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#334155", padding: "3px 10px", borderRadius: 20, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B", fontWeight: 600 }}>Free Beta</span>
          <button onClick={() => document.getElementById("lp-auth-bottom")?.scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "7px 18px", borderRadius: 8, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)", color: "#22D3EE", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "72px 32px 56px" }}>
        <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 60, alignItems: "center" }}>

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20, padding: "5px 12px", borderRadius: 20, background: "rgba(124,92,255,0.1)", border: "1px solid rgba(124,92,255,0.25)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 5px #10B981", animation: "lp-pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", letterSpacing: 0.5 }}>63 / 100 beta spots left</span>
            </div>

            <h1 style={{ fontSize: "clamp(36px,4vw,56px)", color: "white", fontWeight: 900, lineHeight: 1.08, marginBottom: 20, letterSpacing: -1.5 }}>
              The operating system<br />
              for cam model<br />
              <span style={{ background: "linear-gradient(135deg,#22D3EE 30%,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>revenue</span>
            </h1>

            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#64748B", marginBottom: 32, maxWidth: 440 }}>
              Upload your CSV. CamCash finds your peak hours, tracks high-value fans, and tells you exactly what to do to earn more — tonight.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
              {[
                ["⚡", "Your best stream time, calculated from your real data"],
                ["👑", "Top fan alerts — who to message and when"],
                ["📊", "Platform ROI — where your time is actually worth more"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569" }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Mobile CTA */}
            <button className="lp-mobile-cta"
              onClick={() => document.getElementById("lp-auth-mobile")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "none", padding: "14px 36px", borderRadius: 12, background: "linear-gradient(135deg,#22D3EE,#EC4899)", color: "white", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", boxShadow: "0 0 28px rgba(34,211,238,0.3)", letterSpacing: 0.2 }}>
              Start Free →
            </button>
          </div>

          {/* Right — Auth Panel (desktop) */}
          <div className="lp-desktop-auth">
            <AuthPanel id="lp-auth-desktop" {...authPanelProps} />
          </div>
        </div>

        {/* Mobile auth */}
        <div id="lp-auth-mobile" className="lp-mobile-auth" style={{ display: "none", marginTop: 40 }}>
          <AuthPanel id="lp-auth-mobile-inner" {...authPanelProps} />
        </div>
      </div>

      {/* ── LIVE DEMO ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 32px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Live Demo</div>
          <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Your dashboard, before you even sign up</div>
          <div style={{ fontSize: 14, color: "#475569", marginTop: 10 }}>Cycles through real states — before, during, and after a stream</div>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <LiveDemoPanel />
        </div>
      </div>

      {/* ── SOCIAL PROOF STRIP ── */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "28px 32px", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, textAlign: "center" }}>
          {[
            ["$2.4M+",  "Earnings tracked"],
            ["18,000+", "Sessions analyzed"],
            ["5,000+",  "Fan interactions"],
            ["3",       "Platforms supported"],
          ].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 900, color: "white", letterSpacing: -0.5, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 12, color: "#334155", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT MAKES YOU MORE MONEY ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "80px 32px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>How It Works</div>
          <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Three ways CamCash makes you more money</div>
        </div>

        <div className="lp-three-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {[
            {
              icon: "⏰",
              title: "Stream at your real peak hours",
              body: "Not generic advice — your peak hours, from your own tip history. Streaming off-peak can cut $/hr by 40%.",
              accent: "#22D3EE",
              visual: (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 36, marginTop: 14 }}>
                  {[30,50,45,80,60,95,70,85,55,90,40,75].map((h,i) => (
                    <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", height:`${h}%`, background: i===5 ? "#22D3EE" : "rgba(34,211,238,0.15)", transition:"height 0.3s" }} />
                  ))}
                </div>
              ),
            },
            {
              icon: "👑",
              title: "Identify and retain high-value fans",
              body: "Your top 10% of tippers generate 60–70% of revenue. CamCash shows you who they are and when to reach out.",
              accent: "#F59E0B",
              visual: (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                  {[["VIPfan99","$1,820","🔥 Hot"],["user8812","$940","⚠️ Cold"]].map(([n,v,s]) => (
                    <div key={n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px", borderRadius:6, background:"rgba(245,158,11,0.06)", fontSize:11 }}>
                      <span style={{ color:"#94A3B8" }}>{n}</span>
                      <span style={{ color:"#F59E0B", fontWeight:700 }}>{v}</span>
                      <span style={{ fontSize:10, color:"#64748B" }}>{s}</span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              icon: "🎯",
              title: "Optimize your platform split",
              body: "See $/hr by platform. Most models earn 2–3x more on one platform and don't know it.",
              accent: "#EC4899",
              visual: (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                  {[["Chaturbate","$28/hr",85],["BongaCams","$12/hr",36],["MFC","$19/hr",57]].map(([p,v,pct]) => (
                    <div key={p}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#64748B", marginBottom:2 }}>
                        <span>{p}</span><span style={{ color:"#EC4899", fontWeight:700 }}>{v}</span>
                      </div>
                      <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:"#EC4899", borderRadius:2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ].map(({ icon, title, body, accent, visual }) => (
            <div key={title} className="lp-card" style={{ padding: "22px 20px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor=`${accent}30` }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.06)" }}
            >
              <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 8, lineHeight: 1.4 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{body}</div>
              {visual}
            </div>
          ))}
        </div>
      </div>

      {/* ── MESSAGE GENERATOR PREVIEW ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "20px 32px 80px" }}>
        <div className="lp-msg-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Message generator */}
          <div style={{ padding: "22px 20px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>💌</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Fan Re-engagement</div>
                <div style={{ fontSize: 11, color: "#334155" }}>AI-generated, personalized per fan</div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8", lineHeight: 1.6, minHeight: 70, marginBottom: 14, fontStyle: "italic" }}>
              "{messages[msgIndex]}"
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMsgIndex(p => (p+1)%messages.length)}
                style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748B", fontSize:12, cursor:"pointer" }}>
                Regenerate
              </button>
              <button onClick={handleCopy}
                style={{ flex:1, padding:"9px", borderRadius:8, background: copied ? "rgba(16,185,129,0.15)" : "rgba(34,211,238,0.1)", border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(34,211,238,0.25)"}`, color: copied ? "#10B981" : "#22D3EE", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Whale card */}
          <div style={{ padding: "22px 20px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>🐳</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>High-Value Fan</div>
                <div style={{ fontSize: 11, color: "#334155" }}>Your real tippers, ranked</div>
              </div>
            </div>
            <div style={{ padding: "14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8, fontFamily: "monospace" }}>{whales[whaleIndex].name}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#F59E0B", marginBottom: 4 }}>{whales[whaleIndex].spent}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>lifetime · last tipped {whales[whaleIndex].days}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#475569" }}>
                <span style={{ color: "#F87171", fontWeight: 700 }}>{whales[whaleIndex].pct} of your revenue</span> — at risk of churning
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW TO START ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "0 32px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Getting Started</div>
        <div style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "white", marginBottom: 40, letterSpacing: -0.5 }}>Up and earning in 2 minutes</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { n:"01", title:"Upload your CSV", body:"Export from Chaturbate, BongaCams, or MFC. Paste into Google Sheets → Download as CSV → upload here." },
            { n:"02", title:"AI analyzes your sessions", body:"CamCash reads your peak hours, top fans, platform ROI, and session patterns automatically." },
            { n:"03", title:"Get your personalized playbook", body:"Your Command Center tells you when to stream, who to message, and where to focus — updated daily." },
          ].map(({ n, title, body }, i) => (
            <div key={n} style={{ display:"flex", gap:20, padding:"20px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", textAlign:"left" }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#1e3a52", fontFamily:"monospace", flexShrink:0, paddingTop:2 }}>{n}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"white", marginBottom:5 }}>{title}</div>
                <div style={{ fontSize:13, color:"#475569", lineHeight:1.65 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div id="lp-auth-bottom" style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "0 32px 100px", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 900, color: "white", marginBottom: 10, letterSpacing: -0.8 }}>
          Turn your analytics<br />into income.
        </div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 32 }}>Free during beta. No credit card. Takes 2 minutes.</div>
        <AuthPanel id="lp-auth-bottom-panel" {...authPanelProps} />
      </div>

      {/* ── FREE TOOLS SECTION ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "0 32px 64px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a855f7", marginBottom: 10 }}>Free Tools</div>
          <div style={{ fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 800, color: "white", marginBottom: 8 }}>Two free tools. No account needed.</div>
          <div style={{ fontSize: 14, color: "#475569" }}>Use them right now — completely free.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          <a href="/guides/chaturbate-room-title-generator" style={{ display: "block", background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 12, padding: "28px 24px", textDecoration: "none" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✏️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Room Title Generator</div>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.6 }}>Generate click-worthy Chaturbate room titles that get you more viewers. Free, instant, no login.</p>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#a855f7" }}>Try it free →</span>
          </a>
          <a href="/guides/chaturbate-token-calculator" style={{ display: "block", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12, padding: "28px 24px", textDecoration: "none" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>💰</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Token Calculator</div>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.6 }}>Instantly convert Chaturbate tokens to USD. See your real take-home for any tip amount.</p>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#22d3ee" }}>Try it free →</span>
          </a>
        </div>
      </div>

      {/* ── SITE FOOTER WITH BLOG / GUIDES LINKS ── */}
      <SiteFooter />

      {/* ── FOOTER ── */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#1e3a52" }}>© 2026 CamCash — Built for cam models who want to grow</div>
        <div style={{ fontSize: 12, color: "#1e3a52" }}>Your data is never shared · Encrypted · Private</div>
      </div>

      {/* ── GLOBAL STYLES ── */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }

        .lp-card { transition: all 0.2s ease; }

        @media (max-width: 768px) {
          .lp-hero-grid      { grid-template-columns: 1fr !important; }
          .lp-desktop-auth   { display: none !important; }
          .lp-mobile-cta     { display: inline-block !important; }
          .lp-mobile-auth    { display: block !important; }
          .lp-three-grid     { grid-template-columns: 1fr !important; }
          .lp-msg-grid       { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 600px) {
          .lp-social-proof   { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
