"use client"

import { useState, useEffect, memo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

// ================= MESSAGE ENGINE =================
function MessageEngine() {
  const messages = [
    "Hey baloo_13... I saved something just for you tonight",
    "baloo_13 you were my top supporter last stream",
    "Come back baloo_13... it gets better",
    "baloo_13 I have a private show waiting"
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
    <div style={{ background: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 15, minHeight: 50 }}>{text}</div>
      <button onClick={copy} style={{ marginTop: 10, padding: "8px 14px", borderRadius: 10, background: copied ? "#22c55e" : "#22D3EE", border: "none", color: "black" }}>
        {copied ? "Copied" : "Copy Message"}
      </button>
    </div>
  )
}

// ================= RESULT SIM =================
function ResultSimulation() {
  const steps = [
    "Message sent to baloo_13",
    "baloo_13 is typing...",
    "baloo_13 joined your room",
    "Tip received: 120 tokens"
  ]

  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep((p) => (p + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
      {steps[step]}
    </div>
  )
}

// ================= LIVE FEED =================
function LiveFeed() {
  const events = [
    "baloo_13 tipped 120 tokens",
    "vipfan99 returned after 2 days",
    "private show unlocked",
    "whale re-engaged",
    "high spender triggered message"
  ]

  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % events.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
      {events[i]}
    </div>
  )
}

// ================= INSIGHTS =================
function InsightTicker() {
  const data = [
    "Top 2% of fans generate 70% of revenue",
    "Peak tipping time 11:42PM",
    "Returning fans spend 3x more",
    "Private shows convert 4x higher"
  ]

  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % data.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {data[i]}
    </div>
  )
}

// ================= AUTH =================
const AuthPanel = memo(function AuthPanel({ isSignUp, setIsSignUp, email, setEmail, password, setPassword, authLoading, authError, handleAuth }) {
  return (
    <div style={{ background: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
      <h3>{isSignUp ? "Create Account" : "Log In"}</h3>

      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", marginTop: 10, padding: 10 }} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", marginTop: 10, padding: 10 }} />

      <button onClick={handleAuth} style={{ width: "100%", marginTop: 12, padding: 12, background: "#ec4899", color: "white", border: "none" }}>
        {authLoading ? "Loading..." : isSignUp ? "Sign Up" : "Log In"}
      </button>

      <div onClick={() => setIsSignUp(!isSignUp)} style={{ marginTop: 10, cursor: "pointer" }}>
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

      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <b>CamCash</b>
        <div>Live Revenue Engine</div>
      </div>

      <div style={{ maxWidth: 1100, margin: "40px auto", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 30, padding: "0 20px" }}>

        <div>
          <h1 style={{ fontSize: 42 }}>
            Turn your top fans into daily revenue
          </h1>

          <p style={{ opacity: 0.7 }}>
            Watch how one message brings them back and makes you money
          </p>

          <MessageEngine />
          <ResultSimulation />
          <LiveFeed />
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <h3>How it works</h3>
        <p style={{ opacity: 0.7 }}>
          Track fans, trigger messages, bring them back, increase tips.
        </p>

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
