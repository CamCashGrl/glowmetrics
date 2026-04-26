"use client"

import { useState, useEffect, memo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ── Small helpers ─────────────────────────────────────
const fadeIn = { transition: "all .4s ease" }

// ── Auth Panel (UNCHANGED CORE LOGIC) ─────────────────
const AuthPanel = memo(function AuthPanel({
  isSignUp, setIsSignUp, email, setEmail, password, setPassword,
  authLoading, authError, authMsg, handleAuth
}) {
  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 9,
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14, marginBottom: 10
  }

  return (
    <div style={{ background: "linear-gradient(135deg,#1e293b,#020617)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
      <h3 style={{ marginBottom: 12 }}>{isSignUp ? "Create Account" : "Welcome Back"}</h3>

      <input style={inputStyle} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

      <button onClick={handleAuth} disabled={authLoading} style={{ width: "100%", padding: 12, borderRadius: 10, background: "linear-gradient(135deg,#22D3EE,#EC4899)", border: "none", color: "white" }}>
        {authLoading ? "Loading..." : isSignUp ? "Sign Up" : "Log In"}
      </button>

      <div style={{ marginTop: 10, fontSize: 13, cursor: "pointer" }} onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? "Already have an account? Log in" : "Create account"}
      </div>

      {authError && <div style={{ color: "#f87171" }}>{authError}</div>}
      {authMsg && <div style={{ color: "#34d399" }}>{authMsg}</div>}
    </div>
  )
})

// ── Typing + Copy Message Generator ───────────────────
function MessageGenerator() {
  const messages = [
    "Hey baloo_13… I saved something for you tonight",
    "baloo_13 you were my top supporter last time",
    "Come back baloo_13… it gets better",
    "baloo_13 I’ve got a private show waiting"
  ]

  const [index, setIndex] = useState(0)
  const [display, setDisplay] = useState("")
  const [copied, setCopied] = useState(false)

  // typing effect
  useEffect(() => {
    let i = 0
    setDisplay("")
    const current = messages[index]

    const typing = setInterval(() => {
      i++
      setDisplay(current.slice(0, i))
      if (i >= current.length) clearInterval(typing)
    }, 25)

    const rotate = setTimeout(() => {
      setIndex((prev) => (prev + 1) % messages.length)
      setCopied(false)
    }, 3200)

    return () => {
      clearInterval(typing)
      clearTimeout(rotate)
    }
  }, [index])

  const copy = () => {
    navigator.clipboard.writeText(messages[index])
    setCopied(true)
  }

  return (
    <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", ...fadeIn }}>
      <div style={{ fontSize: 14, minHeight: 40 }}>{display}</div>

      <button onClick={copy} style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, border: "none", background: copied ? "#34d399" : "#22D3EE", color: "black", transform: copied ? "scale(1.05)" : "scale(1)", transition: "all .2s" }}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

// ── Insights Slider ───────────────────────────────────
function InsightsSlider() {
  const insights = [
    "Top 2% of fans generate 68% of revenue",
    "Your peak tipping hour: 11:40PM",
    "Returning fans spend 3.2x more",
    "Whales re-engage within 48 hours",
    "Private shows convert 4x higher"
  ]

  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % insights.length), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>Live Insight</div>
      <div style={{ fontSize: 15 }}>{insights[i]}</div>
    </div>
  )
}

// ── Platform Logos Strip ──────────────────────────────
function LogoStrip() {
  const logos = ["CB","SC","OF","MV","CS","BC"]
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 10, opacity: 0.6 }}>
      {logos.map((l, idx) => (
        <div key={idx} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}>
          {l}
        </div>
      ))}
    </div>
  )
}

// ── Feature Card ──────────────────────────────────────
function FeatureCard({ title, desc }) {
  return (
    <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 13, opacity: 0.8 }}>{desc}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function Page() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")
  const [authMsg, setAuthMsg] = useState("")

  const handleAuth = async () => {
    setAuthLoading(true)
    setAuthError("")

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) setAuthError(error.message)
    else router.push("/dashboard")

    setAuthLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "white", fontFamily: "Inter, sans-serif" }}>

      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontWeight: 700 }}>CamCash</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Features • Insights • Growth</div>
      </div>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: "30px auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 26, padding: "0 20px" }}>

        <div>
          <h1 style={{ fontSize: 34, marginBottom: 10 }}>
            Re-engage your top supporters
          </h1>

          <p style={{ opacity: 0.7, marginBottom: 14 }}>
            Unlock insights that could multiply your earnings
          </p>

          <MessageGenerator />

          <div style={{ marginTop: 14 }}>
            <InsightsSlider />
            <LogoStrip />
          </div>
        </div>

        <AuthPanel
          isSignUp={isSignUp}
          setIsSignUp={setIsSignUp}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          authLoading={authLoading}
          authError={authError}
          authMsg={authMsg}
          handleAuth={handleAuth}
        />

      </div>

      {/* FEATURES (HIGHER + COMPACT) */}
      <div style={{ maxWidth: 1100, margin: "10px auto 60px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, padding: "0 20px" }}>
        <FeatureCard title="Top Supporters" desc="Identify whales instantly" />
        <FeatureCard title="Peak Engagement" desc="Know exactly when fans spend" />
        <FeatureCard title="Revenue Insights" desc="Double down on what converts" />
      </div>

    </div>
  )
}
