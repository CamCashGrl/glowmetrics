"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const C = {
  bg: "#0B0F1A",
  card: "#121826",
  border: "#1e2d45",
  cyan: "#22D3EE",
  pink: "#EC4899",
  white: "#F1F5F9",
  muted: "#475569",
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
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      padding: 20,
      position: "relative",
      overflow: "hidden"
    }}>

      {/* 🔥 BACKGROUND GLOW */}
      <div style={{
        position: "absolute",
        width: 600,
        height: 600,
        background: C.cyan,
        opacity: 0.15,
        filter: "blur(120px)",
        top: -150,
        left: -150
      }} />
      <div style={{
        position: "absolute",
        width: 500,
        height: 500,
        background: C.pink,
        opacity: 0.15,
        filter: "blur(120px)",
        bottom: -150,
        right: -150
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* 🔥 OUTER WRAP FOR ANIMATED BORDER */}
      <div style={{
        position: "relative",
        padding: 1,
        borderRadius: 24,
        overflow: "hidden"
      }}>

        {/* ✨ ANIMATED BORDER */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(120deg, ${C.cyan}, ${C.pink}, ${C.cyan})`,
          backgroundSize: "300% 300%",
          animation: "gradientShift 6s ease infinite",
          filter: "blur(8px)",
          opacity: 0.6
        }} />

        {/* ORIGINAL CARD */}
        <div style={{
          position: "relative",
          zIndex: 10,
          background: "rgba(18, 24, 38, 0.85)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          padding: "52px 44px",
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 0 80px rgba(168,85,247,0.15)"
        }}>

          {/* LOGO */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              width: 70,
              height: 70,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${C.cyan}, ${C.pink}, ${C.cyan})`,
              backgroundSize: "200% 200%",
              animation: "gradientShift 5s ease infinite",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: C.white,
              margin: "0 auto 18px",
              boxShadow: `0 12px 30px ${C.cyan}40`,
              position: "relative",
              overflow: "hidden"
            }}>
              $

              {/* ✨ SHINE EFFECT */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "50%",
                height: "100%",
                background: "linear-gradient(120deg, transparent, rgba(255,255,255,0.6), transparent)",
                transform: "skewX(-20deg)",
                animation: "shine 3s infinite"
              }} />
            </div>

            <h1 style={{
              fontSize: 34,
              fontWeight: 800,
              color: C.white,
              marginBottom: 8
            }}>
              Cam<span style={{
                background: `linear-gradient(90deg, ${C.cyan}, ${C.pink}, ${C.cyan})`,
                backgroundSize: "200% 200%",
                animation: "gradientShift 6s ease infinite",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>Cash</span>
            </h1>

            <p style={{ fontSize: 15, color: C.muted }}>
              Know exactly when, how, and who to stream for 💰
            </p>

            <p style={{ fontSize: 12, color: "#22c55e", marginTop: 6 }}>
              🔥 Increase earnings with data-driven insights
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleAuth}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, color: C.white, marginBottom: 6, display: "block" }}>
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
                  background: "#020617",
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  color: C.white,
                  fontSize: 15,
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = C.pink}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 14, color: C.white, marginBottom: 6, display: "block" }}>
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
                  background: "#020617",
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  color: C.white,
                  fontSize: 15,
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = C.cyan}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>

            {error && (
              <div style={{
                padding: "12px 16px",
                background: error.includes("✅") ? `${C.cyan}15` : `${C.red}15`,
                border: `1px solid ${error.includes("✅") ? C.cyan + "30" : C.red + "30"}`,
                borderRadius: 10,
                color: error.includes("✅") ? C.cyan : C.red,
                fontSize: 14,
                marginBottom: 20
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "15px",
                background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`,
                border: "none",
                borderRadius: 12,
                color: C.white,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: `0 8px 25px ${C.pink}40`
              }}
            >
              {loading
                ? "Entering..."
                : mode === "signup"
                ? "Create Account"
                : "Enter Dashboard"}
            </button>
          </form>

          {/* TOGGLE */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setError("")
              }}
              style={{
                background: "none",
                border: "none",
                color: C.cyan,
                fontSize: 14,
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
