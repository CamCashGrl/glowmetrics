"use client"
import { useState, useEffect, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ── Auth Panel ──────────────────────────────────────────────────────────────
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
        {authMsg && <div style={{ fontSize: 12, color: "#22D3EE", marginBottom: 10, textAlign: "center" }}>{authMsg}</div>}
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
        transition: "all 0.2s", marginBottom: 16,
      }}>
        {loading ? "Generating..." : "Generate Titles"}
      </button>
      {titles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {titles.map((title, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, marginRight: 10 }}>{title}</span>
              <button type="button" onClick={() => handleCopyTitle(title, i)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: copied === i ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.08)",
                color: copied === i ? "#22D3EE" : "#94a3b8",
                border: copied === i ? "1px solid #22D3EE" : "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer", whiteSpace: "nowrap",
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

// ── Main Page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const [msgIndex, setMsgIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [whaleIndex, setWhaleIndex] = useState(0)
  const [alertIndex, setAlertIndex] = useState(0)
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg] = useState("")
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

      {/* ── HERO + AUTH ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 0" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 52, alignItems: "start" }}>

          {/* Left */}
          <div>
            <div style={{ display: "inline-block", marginBottom: 16, padding: "4px 12px", borderRadius: 20, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", fontSize: 12, fontWeight: 600, color: "#a855f7" }}>
              Free analytics for cam models
            </div>
            <h1 style={{ fontSize: "clamp(32px,4.2vw,52px)", color: "white", fontWeight: 900, lineHeight: 1.08, marginBottom: 16 }}>
              Turn Your Fans Into<br />
              <span style={{ background: "linear-gradient(135deg,#3b82f6,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                More Money
              </span>{" "}Automatically
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "#94a3b8", marginBottom: 24, maxWidth: 460 }}>
              See your biggest spenders, when you earn most, and exactly what to do next. Upload your CSV and get your personalized dashboard in minutes.
            </p>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              {[["Ready in 2 minutes"], ["100% free in beta"], ["Your data stays private"]].map(([text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
                  {text}
                </div>
              ))}
            </div>

            {/* Feature preview cards — visible above the fold */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
              {/* Message generator preview */}
              <div className="feature-card">
                <div className="feature-label">Re-engage High Spenders</div>
                <div className="feature-preview">{messages[msgIndex]}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={() => setMsgIndex(p => (p + 1) % messages.length)} className="btn-sm-ghost">Next</button>
                  <button onClick={handleCopy} className="btn-sm-primary">{copied ? "Copied!" : "Copy"}</button>
                </div>
              </div>
              {/* Whale tracker preview */}
              <div className="feature-card">
                <div className="feature-label">Top Spender Alert</div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "white" }}>{whales[whaleIndex].name}</div>
                  <div style={{ color: "#ec4899", fontSize: 20, fontWeight: 900, margin: "4px 0" }}>{whales[whaleIndex].spent}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>inactive {whales[whaleIndex].inactive}</div>
                </div>
              </div>
            </div>

            {/* AI alert */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>
              <strong style={{ color: "#a855f7" }}>AI Insight:</strong> {alerts[alertIndex]}
            </div>

            <button className="mobile-cta-btn"
              onClick={() => document.getElementById("auth-panel-mobile")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "none", marginTop: 16, padding: "14px 36px", borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#ec4899)", color: "white", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
              Start Free
            </button>
          </div>

          {/* Right: Auth */}
          <div className="desktop-auth-wrap" style={{ position: "sticky", top: 24 }}>
            <AuthPanel id="auth-panel-desktop" {...authProps} />
          </div>
        </div>

        {/* Mobile auth */}
        <div id="auth-panel-mobile" className="mobile-auth-wrap" style={{ display: "none", marginTop: 32 }}>
          <AuthPanel id="auth-panel-mobile-inner" {...authProps} />
        </div>
      </div>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "48px auto 0", padding: "0 24px" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)" }} />
      </div>

      {/* ── TOOLS SECTION ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Free Tools</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "white", marginBottom: 8 }}>Everything you need to earn more</h2>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 500, margin: "0 auto" }}>AI-powered tools built specifically for cam models. No guesswork, no generic advice.</p>
        </div>

        {/* Top row: Title generator + Platform comparison */}
        <div className="tools-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginBottom: 18 }}>

          {/* Title Generator */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>T</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Room Title Generator</div>
                <div style={{ fontSize: 11, color: "#475569" }}>AI-powered, high-converting titles</div>
              </div>
            </div>
            <TitleGenerator />
          </div>

          {/* Platform comparison + Peak hours */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="card">
              <div className="card-title">Platform Comparison</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {[["Chaturbate", "$520", 100], ["Stripchat", "$340", 65], ["CamSoda", "$290", 56]].map(([p, v, w]) => (
                  <div key={p}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{p}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>{v} avg</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, background: "linear-gradient(90deg,#3b82f6,#ec4899)", borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", padding: "8px 10px", background: "rgba(16,185,129,0.06)", borderRadius: 7, border: "1px solid rgba(16,185,129,0.15)" }}>
                You make ~35% more on Chaturbate. Stream there first.
              </div>
            </div>

            <div className="card">
              <div className="card-title">Peak Earning Hours</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {[["10pm","H"],["11pm","H"],["12am","M"],["1am","M"],["2am","L"],["3am","L"],["8pm","M"],["9pm","H"]].map(([t, level]) => (
                  <div key={t} style={{ textAlign: "center", padding: "6px 0", borderRadius: 6, background: level === "H" ? "rgba(16,185,129,0.15)" : level === "M" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${level === "H" ? "rgba(16,185,129,0.3)" : level === "M" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                    <div style={{ fontSize: 9, color: level === "H" ? "#10B981" : level === "M" ? "#F59E0B" : "#475569", fontWeight: 700 }}>{t}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Upload your CSV to see YOUR actual peak hours</div>
            </div>
          </div>
        </div>

        {/* Bottom row: How it works */}
        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 48 }}>
          {[
            { n:"1", title:"Upload your CSV", body:"Chaturbate, BongaCams, or MFC — takes under 2 minutes. No manual entry." },
            { n:"2", title:"See your real numbers", body:"Top tippers, peak hours, platform ROI, whale fans — all in one dashboard." },
            { n:"3", title:"Get told what to do", body:"Your dashboard shows exactly who to message and when to go live next." },
          ].map(({ n, title, body }) => (
            <div key={n} className="card" style={{ textAlign: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#ec4899)", color: "white", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>{n}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEO CONTENT ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto 40px", padding: "0 24px" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)", marginBottom: 40 }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 12 }}>
          Cam Model Analytics and Tools to Increase Your Earnings
        </h2>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7, marginBottom: 12 }}>
          CamCash helps cam models track earnings, identify top spenders, and understand exactly when they make the most money.
          Instead of guessing what works, you get real data on your fans, tips, and performance across platforms like Chaturbate,
          BongaCams, and MyFreeCams.
        </p>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7 }}>
          Upload your cam site data and instantly see your highest paying fans, inactive whales worth re-engaging, and the best
          times to go live. Whether you're trying to grow your income or optimize your streams, CamCash gives you the insights
          you need to earn more.
        </p>
      </div>

      {/* ── BOTTOM CTA ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto 64px", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "white", marginBottom: 8 }}>Ready to make more per stream?</div>
          <div style={{ fontSize: 15, color: "#64748b" }}>Free during beta. No credit card. Takes 2 minutes.</div>
        </div>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <AuthPanel id="auth-panel-bottom" {...authProps} />
        </div>
      </div>

      {/* ── STYLES ──────────────────────────────────────────────────── */}
      <style>{`
        .card { background: linear-gradient(135deg,#1e293b,#020617); padding: 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); transition: transform 0.2s, box-shadow 0.2s; }
        .card:hover { box-shadow: 0 0 20px rgba(236,72,153,0.15); transform: translateY(-2px); }
        .card-title { color: #a855f7; font-weight: 600; font-size: 13px; }
        .feature-card { background: linear-gradient(135deg,#1e293b,#020617); padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
        .feature-label { font-size: 10px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
        .feature-preview { font-size: 13px; color: "#cbd5e1"; line-height: 1.5; min-height: 40px; }
        .btn-sm-primary { padding: 5px 12px; border-radius: 6px; background: linear-gradient(135deg,#3b82f6,#ec4899); color: white; font-weight: 700; font-size: 11px; border: none; cursor: pointer; }
        .btn-sm-ghost { padding: 5px 12px; border-radius: 6px; background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
        .btn1 { flex:1; padding:10px; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#ec4899); color:white; font-weight:700; border:none; cursor:pointer; }
        .btn2 { flex:1; padding:10px; border-radius:8px; background:#0f172a; color:white; border:none; cursor:pointer; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .desktop-auth-wrap { display: none !important; }
          .mobile-cta-btn { display: inline-block !important; }
          .mobile-auth-wrap { display: block !important; }
          .tools-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}