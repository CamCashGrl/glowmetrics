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
  const [mode, setMode] = useState("login") // "login" or "signup"

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError("✅ Check your email to verify your account!")
        setTimeout(() => router.push("/dashboard"), 2000)
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
      padding: 20
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
      }}>
        
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 800,
            color: C.white,
            margin: "0 auto 16px",
            boxShadow: `0 8px 24px ${C.cyan}40`
          }}>
            $
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            color: C.white,
            marginBottom: 8
          }}>
            Cam<span style={{
              background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>Cash</span>
          </h1>
          <p style={{ fontSize: 15, color: C.muted }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: C.white, marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                color: C.white,
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = C.cyan}
              onBlur={(e) => e.target.style.borderColor = C.border}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: C.white, marginBottom: 8 }}>
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
                padding: "12px 16px",
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                color: C.white,
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s"
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
              padding: "14px",
              background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`,
              border: "none",
              borderRadius: 10,
              color: C.white,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s"
            }}
          >
            {loading ? "Loading..." : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle Mode */}
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
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}
