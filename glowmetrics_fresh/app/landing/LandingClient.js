"use client"

import { useState, useEffect, memo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ================= HERO MESSAGE ENGINE =================
function MessageEngine() {
  const messages = [
    "Hey baloo_13... I saved something just for you tonight",
    "baloo_13 you were my top supporter last stream",
    "Come back baloo_13... it gets better",
    "baloo_13 I have a private show waiting for you"
  ]

  const [index, setIndex] = useState(0)
  const [text, setText] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let i = 0
    const current = messages[index]
    setText("")

    const typing = setInterval(() => {
      i++
      setText(current.slice(0, i))
      if (i >= current.length) clearInterval(typing)
    }, 20)

    const rotate = setTimeout(() => {
      setIndex((prev) => (prev + 1) % messages.length)
      setCopied(false)
    }, 3000)

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
    <div style={{
      background: "linear-gradient(135deg,#0f172a,#020617)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: 20,
      boxShadow: "0 0 40px rgba(236,72,153,0.15)"
    }}>
      <div style={{ fontSize: 15, minHeight: 50 }}>{text}</div>

      <button onClick={copy} style={{
        marginTop: 12,
        padding: "8px 14px",
        borderRadius: 10,
        border: "none",
        background: copied ? "#22c55e" : "#22D3EE",
        color: "black",
        fontWeight: 600,
        transform: copied ? "scale(1.05)" : "scale(1)",
        transition: "all .2s"
      }}>
        {copied ? "Copied" : "Copy Message"}
      </button>
    </div>
  )
}

// ================= INSIGHTS =================
function InsightTicker() {
  const data = [
    "Top 2% of fans generate 70% of revenue",
    "Peak tipping window detected at 11:42PM",
    "Returning fans spend 3x more",
    "Whales re-engage within 48 hours",
    "Private shows convert 4x higher"
  ]

  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % data.length), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div style={{ fontSize: 12, opacity: 0.6 }}>LIVE INSIGHT</div>
      <div style={{ fontSize: 15 }}>{data[i]}</div>
    </div>
  )
}

// ================= AUTH =================
const AuthPanel = memo(function AuthPanel({
  isSignUp, setIsSignUp, email, setEmail, password, setPassword,
  authLoading, authError, handleAuth
}) {
  return (
    <div style={{
      background: "linear-gradient(135deg,#1e293b,#020617)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: 24
    }}>

      <h3>{isSignUp ? "Create Account" : "Welcome Back"}</h3>

      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8 }} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8 }} />

      <button onClick={handleAuth} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 10, background: "#ec4899", color: "white", border: "none" }}>
        {authLoading ? "Loading..." : isSignUp ? "Sign Up" : "Log In"}
      </button>

      <div onClick={() => setIsSignUp(!isSignUp)} style={{ marginTop: 10, cursor: "pointer", fontSize: 13 }}>
        {isSignUp ? "Already have an account? Log in" : "Create account"}
      </div>

      {authError && <div style={{ color: "red" }}>{authError}</div>}
    </div>
  )
})

// ================= MAIN =================
export default function Page() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")

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
    <div style={{ background: "#020617", color: "white", minHeight: "100vh", fontFamily: "Inter" }}>

      {/* NAV */}
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between" }}>
        <b>CamCash</b>
        <div style={{ fontSize: 13 }}>Insights • Growth • Revenue</div>
      </div>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: "40px auto", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 30, padding: "0 20px" }}>

        <div>
          <h1 style={{ fontSize: 40, marginBottom: 10 }}>
            Re-engage your top supporters
          </h1>

          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            Turn your best fans into consistent high spenders
          </p>

          <MessageEngine />
          <InsightTicker />
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
          handleAuth={handleAuth}
        />

      </div>

      {/* HOW IT WORKS + BLOG */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>

        <h3>How it works</h3>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Connect your data. Track fan behavior. Re-engage your highest spenders automatically.
        </p>

        <div style={{ marginTop: 20 }}>
          {["Growth","Whales","Retention","Revenue"].map((tag,i)=>(
            <a key={i} href={`/blog?tag=${tag}`} style={{ marginRight: 10 }}>#{tag}</a>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <a href="/blog/top-earning-cam-model-strategies">Top earning strategies</a><br/>
          <a href="/blog/how-to-retain-whales">How to retain whales</a>
        </div>

        <div style={{ marginTop: 20 }}>
          <a href="mailto:your@email.com">Submit feedback</a>
        </div>

      </div>

    </div>
  )
}
