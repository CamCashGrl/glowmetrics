"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LandingPage() {
  const router = useRouter()

  const [msgIndex, setMsgIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [whaleIndex, setWhaleIndex] = useState(0)
  const [alertIndex, setAlertIndex] = useState(0)

  const [authState, setAuthState] = useState("loading")

  // 🔥 NEW SIGNUP STATE
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const messages = [
    "Hey 😘 I've been thinking about you... I'm live tonight ❤️",
    "Miss you 💕 come make tonight fun 🔥",
    "It's been a while… come back 😈"
  ]

  const whales = [
    { name: "user_ULTRAVIP999", spent: "$41,820", inactive: "520 days" },
    { name: "user_TOPSPENDERX", spent: "$33,140", inactive: "300 days" }
  ]

  const alerts = [
    "You have top spenders you're not tracking.",
    "You're missing your highest earning hours.",
    "You have inactive whales worth thousands.",
    "You could be earning more on a different platform."
  ]

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthState("out"); return }

      const { data: profile } = await supabase
        .from("beta_users")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single()

      setAuthState(profile?.onboarding_complete ? "dashboard" : "onboarding")
    }
    checkAuth()
  }, [])

  const handleCTA = () => {
    if (authState === "dashboard") return router.push("/dashboard")
    if (authState === "onboarding") return router.push("/onboarding")
    router.push("/login")
  }

  const ctaLabel =
    authState === "dashboard"
      ? "Go to Dashboard"
      : authState === "onboarding"
      ? "Continue Setup"
      : "Sign Up"

  // 🔥 SIGNUP FUNCTION
  const handleSignup = async () => {
    if (!email || !password) {
      setError("Enter email and password")
      return
    }

    setLoading(true)
    setError("")

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // create user row
    if (data.user) {
      await supabase.from("beta_users").insert({
        user_id: data.user.id,
        onboarding_complete: false
      })
    }

    setLoading(false)
    router.push("/onboarding")
  }

  useEffect(() => {
    const a = setInterval(() => {
      setMsgIndex(p => (p + 1) % messages.length)
      setWhaleIndex(p => (p + 1) % whales.length)
    }, 5000)

    const b = setInterval(() => {
      setAlertIndex(p => (p + 1) % alerts.length)
    }, 4000)

    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(messages[msgIndex])
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#05070f",
      color: "#cbd5e1",
      fontFamily: "Inter, sans-serif",
      padding: "40px 20px"
    }}>

      {/* NAV */}
      <nav style={{ maxWidth: 900, margin: "0 auto 40px", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: "white" }}>CamCash</div>
      </nav>

      {/* HERO */}
      <div style={{ textAlign: "center", maxWidth: 780, margin: "0 auto" }}>
        <h1 style={{ fontSize: 52, color: "white", fontWeight: 900 }}>
          Turn Your Fans Into<br />More Money — Automatically
        </h1>

        <p style={{ marginTop: 16 }}>
          See your biggest spenders, when you earn most, and exactly what to do next.
        </p>

        {/* 🔥 SIGNUP FORM (ONLY WHEN LOGGED OUT) */}
        {authState === "out" && (
          <div style={{
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxWidth: 320,
            marginInline: "auto"
          }}>
            <input
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#020617",
                color: "white"
              }}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#020617",
                color: "white"
              }}
            />

            <button
              onClick={handleSignup}
              style={{
                padding: 14,
                borderRadius: 10,
                background: "linear-gradient(135deg,#3b82f6,#ec4899)",
                color: "white",
                fontWeight: 700,
                border: "none",
                cursor: "pointer"
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

            {error && (
              <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
            )}
          </div>
        )}

        {/* EXISTING CTA */}
        {authState !== "out" && (
          <button onClick={handleCTA} style={{
            marginTop: 24,
            padding: "16px 44px",
            borderRadius: 12,
            background: "linear-gradient(135deg,#3b82f6,#ec4899)",
            color: "white",
            fontWeight: 700,
            border: "none",
            cursor: "pointer"
          }}>
            {ctaLabel}
          </button>
        )}
      </div>

      {/* (rest of your page stays EXACTLY the same) */}

    </div>
  )
}
