"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const C = {
  bg: "#070B14",
  card: "rgba(20, 28, 45, 0.75)",
  border: "rgba(255,255,255,0.08)",
  blue: "#4F8CFF",
  purple: "#A855F7",
  accent: "linear-gradient(135deg, #4F8CFF, #A855F7)",
  white: "#E6EDF3",
  muted: "rgba(255,255,255,0.6)",
  red: "#F87171",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState("login")

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError("✅ Check your email to verify your account!")
        setTimeout(() => router.push("/onboarding"), 2000)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err.message || "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      padding: 20,
      position: "relative",
      overflow: "hidden",

      /* 🌌 MATCHED BACKGROUND */
      background: `
        radial-gradient(circle at 20% 20%, rgba(79,140,255,0.15), transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(168,85,247,0.12), transparent 40%),
        #070B14
      `
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* CARD WRAPPER */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 420
      }}>

        {/* ✨ SUBTLE GLOW BORDER */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          padding: 1,
          background: "linear-gradient(120deg, rgba(79,140,255,0.4), rgba(168,85,247,0.4), transparent)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          opacity: 0.5,
          pointerEvents: "none"
        }} />

        {/* MAIN CARD */}
        <div style={{
          position: "relative",
          zIndex: 10,
          padding: "42px 34px",
          borderRadius: 18,
          background: C.card,
          border: `1px solid ${C.border}`,
          backdropFilter: "blur(18px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
        }}>

          {/* HEADER */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              color: C.white,
              marginBottom: 6
            }}>
              Cam<span style={{
                background: C.accent,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>Cash</span>
            </h1>

            <p style={{
              fontSize: 14,
              color: C.muted
            }}>
              Stream smarter. Earn more.
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleAuth}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                fontSize: 13,
                color: C.muted,
                marginBottom: 6,
                display: "block"
              }}>
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  color: C.white,
                  fontSize: 14,
                  outline: "none",
                  transition: "all 0.2s ease"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = C.blue
                  e.target.style.background = "rgba(255,255,255,0.05)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = C.border
                  e.target.style.background = "rgba(255,255,255,0.03)"
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{
                fontSize: 13,
                color: C.muted,
                marginBottom: 6,
                display: "block"
              }}>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  color: C.white,
                  fontSize: 14,
                  outline: "none",
                  transition: "all 0.2s ease"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = C.blue
                  e.target.style.background = "rgba(255,255,255,0.05)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = C.border
                  e.target.style.background = "rgba(255,255,255,0.03)"
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: "12px 14px",
                background: error.includes("✅")
                  ? "rgba(79,140,255,0.1)"
                  : "rgba(248,113,113,0.1)",
                border: `1px solid ${
                  error.includes("✅")
                    ? "rgba(79,140,255,0.3)"
                    : "rgba(248,113,113,0.3)"
                }`,
                borderRadius: 10,
                color: error.includes("✅") ? C.blue : C.red,
                fontSize: 13,
                marginBottom: 16
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: C.accent,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(79,140,255,0.3)",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
            >
              {loading
                ? "Entering..."
                : mode === "signup"
                ? "Create Account"
                : "Log In"}
            </button>
          </form>

          {/* TOGGLE */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setError("")
              }}
              style={{
                background: "none",
                border: "none",
                color: C.muted,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
