"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

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
        setError("Check your email to verify your account")
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
    <div className="login-bg">
      <style>{`
        * {
          box-sizing: border-box;
        }

        /* ===== BACKGROUND ===== */
        .login-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: Inter, sans-serif;

          background:
            radial-gradient(circle at 15% 25%, rgba(14,165,233,0.08), transparent 40%),
            radial-gradient(circle at 85% 75%, rgba(37,99,235,0.08), transparent 40%),
            linear-gradient(135deg, #05070d, #0b1220);

          background-size: 200% 200%;
          animation: subtleWave 18s ease-in-out infinite;
        }

        @keyframes subtleWave {
          0% { background-position: 0% 50%, 100% 50%, 0% 0%; }
          50% { background-position: 10% 60%, 90% 40%, 0% 0%; }
          100% { background-position: 0% 50%, 100% 50%, 0% 0%; }
        }

        /* ===== CARD ===== */
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 44px 36px;
          border-radius: 22px;

          background: rgba(10, 15, 25, 0.78);
          backdrop-filter: blur(20px);

          border: 1px solid rgba(14,165,233,0.18);
          box-shadow: 
            0 10px 50px rgba(0,0,0,0.6),
            0 0 40px rgba(14,165,233,0.08);

          position: relative;
          overflow: hidden;

          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .login-card:hover {
          transform: translateY(-6px);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.7),
            0 0 60px rgba(37,99,235,0.15);
        }

        /* light sweep */
        .login-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: -120%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            transparent,
            rgba(14,165,233,0.12),
            transparent
          );
          animation: sweep 6s infinite;
        }

        @keyframes sweep {
          0% { left: -120%; }
          100% { left: 200%; }
        }

        /* ===== LOGO ===== */
        .logo {
          font-size: 30px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 4px;

          background: linear-gradient(90deg, #0ea5e9, #2563eb, #0ea5e9);
          background-size: 200%;

          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;

          animation: shimmer 8s linear infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200%; }
          100% { background-position: 200%; }
        }

        .subtitle {
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 32px;
        }

        /* ===== INPUTS ===== */
        .input {
          width: 100%;
          padding: 15px;
          margin-bottom: 16px;
          border-radius: 12px;

          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);

          color: white;
          font-size: 14px;

          transition: all 0.2s ease;
        }

        .input:focus {
          border-color: #0ea5e9;
          background: rgba(255,255,255,0.04);
          box-shadow: 0 0 0 2px rgba(14,165,233,0.08);
          outline: none;
        }

        /* ===== BUTTON ===== */
        .button {
          width: 100%;
          padding: 15px;
          margin-top: 4px;

          border-radius: 12px;
          border: none;

          font-weight: 600;
          font-size: 15px;

          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color: white;

          box-shadow: 0 6px 20px rgba(14,165,233,0.18);

          transition: all 0.2s ease;
        }

        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(37,99,235,0.25);
        }

        /* ===== ERROR ===== */
        .error {
          margin-bottom: 14px;
          font-size: 13px;
          color: #f87171;
          text-align: center;
        }

        /* ===== TOGGLE ===== */
        .toggle {
          margin-top: 20px;
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .toggle:hover {
          color: #0ea5e9;
        }
      `}</style>

      <div className="login-card">

        <div className="logo">CamCash</div>
        <div className="subtitle">Turn attention into income</div>

        <form onSubmit={handleAuth}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error">{error}</div>}

          <button className="button" disabled={loading}>
            {loading
              ? "Entering..."
              : mode === "signup"
              ? "Create Account"
              : "Log In"}
          </button>
        </form>

        <div
          className="toggle"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login")
            setError("")
          }}
        >
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Log in"}
        </div>

      </div>
    </div>
  )
}
