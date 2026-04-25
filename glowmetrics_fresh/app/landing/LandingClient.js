"use client"
import { useState, useEffect, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ── Auth panel ──────────────────────────────────────────────────────────────
const AuthPanel = memo(function AuthPanel({
  isSignUp, setIsSignUp, email, setEmail, password, setPassword,
  authLoading, authError, authMsg, handleAuth, handleForgotPassword, id
}) {
  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 9,
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14, outline: "none", marginBottom: 10,
    boxSizing: "border-box", fontFamily: "Inter, sans-serif",
  }
  return (
    <div id={id} style={{
      background: "linear-gradient(135deg,#1e293b,#020617)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16, padding: "26px 24px",
      boxShadow: "0 0 40px rgba(236,72,153,0.12)", width: "100%",
    }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 40, borderRadius: 10,
          background: "linear-gradient(135deg,#22D3EE,#EC4899)",
          fontSize: 20, fontWeight: 900, color: "white", marginBottom: 8,
        }}>$</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>CamCash</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {isSignUp ? "Free during beta. No credit card." : "Welcome back"}
        </div>
      </div>
      <div style={{
        display: "flex", borderRadius: 9, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16,
      }}>
        {[["Sign Up", true], ["Log In", false]].map(([label, val]) => (
          <button key={label} type="button" onClick={() => setIsSignUp(val)} style={{
            flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600,
            background: isSignUp === val ? "rgba(34,211,238,0.15)" : "transparent",
            color: isSignUp === val ? "#22D3EE" : "rgba(255,255,255,0.35)",
            border: "none", cursor: "pointer", transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>
      <form onSubmit={handleAuth}>
        <input type="email" placeholder="Email address" required
          value={email} onChange={e => setEmail(e.target.value)} style={inputStyle}
          onFocus={e => e.target.style.borderColor = "#22D3EE"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          autoComplete="email"
        />
        <input type="password" placeholder="Password" required
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: isSignUp ? 4 : 0 }}
          onFocus={e => e.target.style.borderColor = "#22D3EE"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        {!isSignUp && (
          <div style={{ textAlign: "right", marginBottom: 10 }}>
            <button type="button" onClick={handleForgotPassword}
              style={{ fontSize: 12, color: "#22D3EE", background: "none", border: "none", cursor: "pointer" }}>
              Forgot password?
            </button>
          </div>
        )}
        {isSignUp && <div style={{ height: 12 }} />}
        {authError && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10, textAlign: "center" }}>{authError}</div>}
        {authMsg   && <div style={{ fontSize: 12, color: "#22D3EE", marginBottom: 10, textAlign: "center" }}>{authMsg}</div>}
        <button type="submit" disabled={authLoading} style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: authLoading ? "rgba(59,130,246,0.4)" : "linear-gradient(135deg,#3b82f6,#ec4899)",
          color: "white", fontWeight: 700, fontSize: 15, border: "none",
          cursor: authLoading ? "not-allowed" : "pointer",
          boxShadow: authLoading ? "none" : "0 4px 20px rgba(236,72,153,0.3)",
          transition: "all 0.2s",
        }}>
          {authLoading
            ? (isSignUp ? "Creating account..." : "Logging in...")
            : (isSignUp ? "Start Free" : "Log In")}
        </button>
      </form>
      {isSignUp && (
        <p style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
          No credit card · Free during beta · Cancel anytime
        </p>
      )}
    </div>
  )
})

// ── Room Title Generator ────────────────────────────────────────────────────
const TitleGenerator = memo(function TitleGenerator() {
  const [vibe, setVibe] = useState("")
  const [titles, setTitles] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(null)
  const vibeOptions = ["Playful", "Romantic", "Wild", "Cozy", "Teasing", "Exclusive"]

  const generate = useCallback(async () => {
    setLoading(true)
    setTitles([])
    try {
      const prompt = `Generate 4 short, high-converting cam room titles for a cam model. Vibe: ${vibe || "fun and flirty"}. Each title should be under 60 characters, attention-grabbing, and encourage tips. Return ONLY a JSON array of 4 strings, no explanation, no markdown.`
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map(b => b.text || "").join("") || "[]"
      const clean = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      setTitles(Array.isArray(parsed) ? parsed : [])
    } catch {
      setTitles(["Could not generate — try again!"])
    }
    setLoading(false)
  }, [vibe])

  const handleCopyTitle = (title, i) => {
    navigator.clipboard.writeText(title)
    setCopied(i)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {vibeOptions.map(v => (
          <button key={v} type="button" onClick={() => setVibe(v)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: vibe === v ? "linear-gradient(135deg,#3b82f6,#ec4899)" : "rgba(255,255,255,0.06)",
            color: vibe === v ? "white" : "#94a3b8",
            border: vibe === v ? "none" : "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer", transition: "all 0.2s",
          }}>{v}</button>
        ))}
      </div>
      <button type="button" onClick={generate} disabled={loading} style={{
        padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14,
        background: loading ? "rgba(59,130,246,0.4)" : "linear-gradient(135deg,#3b82f6,#ec4899)",
        color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer",
        boxShadow: loading ? "none" : "0 4px 16px rgba(236,72,153,0.25)",
        transition: "all 0.2s", marginBottom: 16,
      }}>
        {loading ? "Generating..." : "Generate Titles"}
      </button>
      {titles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {titles.map((title, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{ fontSize: 14, color: "#e2e8f0", flex: 1, marginRight: 12 }}>{title}</span>
              <button type="button" onClick={() => handleCopyTitle(title, i)} style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: copied === i ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.08)",
                color: copied === i ? "#22D3EE" : "#94a3b8",
                border: copied === i ? "1px solid #22D3EE" : "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              }}>
                {copied === i ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// ── Main Landing Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const [msgIndex, setMsgIndex]   = useState(0)
  const [copied, setCopied]       = useState(false)
  const [whaleIndex, setWhaleIndex] = useState(0)
  const [alertIndex, setAlertIndex] = useState(0)
  const [isSignUp, setIsSignUp]   = useState(true)
  const [email, setEmail]         = useState("")
  const [password, setPassword]   = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]     = useState("")
  const [authError, setAuthError] = useState("")

  const messages = [
    "Hey, I've been thinking about you... I'm live tonight",
    "Miss you, come make tonight fun",
    "It's been a while... come back",
  ]
  const whales = [
    { name: "user_ULTRAVIP999", spent: "$41,820", inactive: "520 days" },
    { name: "user_TOPSPENDERX", spent: "$33,140", inactive: "300 days" },
  ]
  const alerts = [
    "You have top spenders you're not tracking.",
    "You're missing your highest earning hours.",
    "You have inactive whales worth thousands.",
    "You could be earning more on a different platform.",
  ]

  useEffect(() => {
    const a = setInterval(() => {
      setMsgIndex(p => (p + 1) % messages.length)
      setWhaleIndex(p => (p + 1) % whales.length)
    }, 6000)
    const b = setInterval(() => setAlertIndex(p => (p + 1) % alerts.length), 5000)
    return () => { clearInterval(a); clearInterval(b) }
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

  const handleAuth = useCallback(async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError("")
    setAuthMsg("")
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false) }
      else {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) router.push("/dashboard")
        else {
          setAuthMsg("Account created! Check your email to confirm, then log in.")
          setIsSignUp(false)
          setAuthLoading(false)
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false) }
      else router.push("/dashboard")
    }
  }, [email, password, isSignUp, router])

  const handleForgotPassword = useCallback(async () => {
    if (!email) { setAuthError("Enter your email first."); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.camcashgrl.com/reset-password",
    })
    if (error) setAuthError(error.message)
    else setAuthMsg("Password reset email sent — check your inbox.")
  }, [email])

  const authProps = {
    isSignUp, setIsSignUp, email, setEmail, password, setPassword,
    authLoading, authError, authMsg, handleAuth, handleForgotPassword,
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05070f", color: "#cbd5e1", fontFamily: "Inter, sans-serif" }}>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 32px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 52, alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "clamp(34px,4.5vw,54px)", color: "white", fontWeight: 900, lineHeight: 1.1, marginBottom: 18 }}>
              Turn Your Fans Into<br />
              <span style={{ background: "linear-gradient(135deg,#3b82f6,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                More Money
              </span>{" "}Automatically
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: "#94a3b8", marginBottom: 28, maxWidth: 480 }}>
              See your biggest spenders, when you earn most, and exactly what to do next. Upload your CSV and get your personalized dashboard in minutes.
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
              {[["Ready in 2 minutes"], ["100% free in beta"], ["Your data stays private"]].map(([text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <button className="mobile-cta-btn"
              onClick={() => document.getElementById("auth-panel-mobile")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "none", padding: "14px 36px", borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#ec4899)", color: "white", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
              Start Free
            </button>
          </div>
          <div className="desktop-auth-wrap">
            <AuthPanel id="auth-panel-desktop" {...authProps} />
          </div>
        </div>
        <div id="auth-panel-mobile" className="mobile-auth-wrap" style={{ display: "none", marginTop: 36 }}>
          <AuthPanel id="auth-panel-mobile-inner" {...authProps} />
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ maxWidth: 900, margin: "0 auto 36px", padding: "0 24px" }}>
        <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
          <div className="card">
            <div className="title">Message a High Spender</div>
            <div className="box">{messages[msgIndex]}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => setMsgIndex(p => (p + 1) % messages.length)} className="btn2">Generate</button>
              <button onClick={handleCopy} className="btn1">{copied ? "Copied!" : "Copy"}</button>
            </div>
          </div>
          <div className="card">
            <div className="title">High Spender</div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600 }}>{whales[whaleIndex].name}</div>
              <div style={{ color: "#ec4899", marginTop: 6, fontSize: 18 }}>{whales[whaleIndex].spent}</div>
              <div style={{ color: "#64748b" }}>inactive {whales[whaleIndex].inactive}</div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ maxWidth: 900, margin: "0 auto 40px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>How It Works</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "white" }}>Up and earning in 3 steps</div>
        </div>
        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { n:"1", title:"Connect your platforms", body:"Upload your Chaturbate, BongaCams, or MFC CSV — takes under 2 minutes." },
            { n:"2", title:"Track earnings + fans",  body:"See your top tippers, best stream hours, and platform ROI — all in one place." },
            { n:"3", title:"Get told what to do next", body:"Your dashboard tells you exactly who to message and when to go live." },
          ].map(({ n, title, body }) => (
            <div key={n} className="card" style={{ textAlign: "center" }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#ec4899)", color:"white", fontWeight:800, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>{n}</div>
              <div className="title" style={{ marginBottom:6 }}>{title}</div>
              <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLATFORM EDGE */}
      <div style={{ maxWidth:900, margin:"0 auto 48px", padding:"0 24px" }}>
        <div className="platform-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          <div className="card">
            <div className="title">Platform Comparison</div>
            <div style={{ marginTop:10 }}>Chaturbate — $520 avg<br/>Stripchat — $340 avg<br/>CamSoda — $290 avg</div>
          </div>
          <div className="card">
            <div className="title">What This Means</div>
            <div style={{ marginTop:10 }}>You're making ~35% more on Chaturbate. Stream there more often.</div>
          </div>
        </div>
      </div>

      {/* SEO CONTENT */}
      <div style={{ maxWidth: 900, margin: "0 auto 40px", padding: "0 24px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 12 }}>
          Cam Model Analytics and Tools to Increase Your Earnings
        </h2>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>
          CamCash helps cam models track earnings, identify top spenders, and understand exactly when they make the most money.
          Instead of guessing what works, you get real data on your fans, tips, and performance across platforms like Chaturbate,
          BongaCams, and MyFreeCams.
        </p>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, marginTop: 12 }}>
          Upload your cam site data and instantly see your highest paying fans, inactive whales worth re-engaging, and the best
          times to go live. Whether you're trying to grow your income or optimize your streams, CamCash gives you the insights
          you need to earn more.
        </p>
      </div>

      {/* ROOM TITLE GENERATOR */}
      <div style={{ maxWidth: 900, margin: "0 auto 50px", padding: "0 24px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 10 }}>
          Free Cam Room Title Generator
        </h2>
        <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 16 }}>
          Generate high-converting room titles that attract viewers and increase tips instantly.
        </p>
        <div style={{
          background: "linear-gradient(135deg,#1e293b,#020617)",
          borderRadius: 14, padding: 20,
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <TitleGenerator />
        </div>
      </div>

      {/* AI ALERT */}
      <div style={{ maxWidth: 900, margin: "0 auto 36px", padding: "0 24px" }}>
        <div style={{
          padding: "14px 18px", borderRadius: 12,
          background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", fontSize: 14,
        }}>
          <strong>AI Insight:</strong> {alerts[alertIndex]}
        </div>
      </div>

      {/* BOTTOM CTA */}
      <div style={{ maxWidth:900, margin:"0 auto 60px", padding:"0 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:900, color:"white", marginBottom:8 }}>Ready to make more per stream?</div>
          <div style={{ fontSize:15, color:"#64748b" }}>Free during beta. No credit card. Takes 2 minutes.</div>
        </div>
        <div style={{ width:"100%", maxWidth:420 }}>
          <AuthPanel id="auth-panel-bottom" {...authProps} />
        </div>
      </div>

      {/* STYLES */}
      <style>{`
        .card { background: linear-gradient(135deg,#1e293b,#020617); padding: 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); transition: transform 0.2s, box-shadow 0.2s; }
        .card:hover { box-shadow: 0 0 20px rgba(236,72,153,0.2); transform: translateY(-2px); }
        .title { color: #a855f7; font-weight: 600; }
        .box { background: rgba(255,255,255,0.05); padding: 14px; border-radius: 10px; margin-top: 10px; min-height: 65px; font-size: 14px; line-height: 1.5; }
        .btn1 { flex:1; padding:10px; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#ec4899); color:white; font-weight:700; border:none; cursor:pointer; transition:opacity 0.15s; }
        .btn1:hover { opacity:0.88; }
        .btn2 { flex:1; padding:10px; border-radius:8px; background:#0f172a; color:white; border:none; cursor:pointer; transition:background 0.15s; }
        .btn2:hover { background:#1e293b; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .desktop-auth-wrap { display: none !important; }
          .mobile-cta-btn { display: inline-block !important; }
          .mobile-auth-wrap { display: block !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .platform-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}