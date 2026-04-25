export const metadata = {
  title: "Cam Model Tools & Analytics | Increase Tips & Earnings | CamCash",
  description:
    "Track your cam earnings, identify top spenders, and increase your tips with CamCash.",
};

"use client"
import { useState, useEffect, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const AuthPanel = memo(function AuthPanel(props) {
  const {
    isSignUp, setIsSignUp, email, setEmail, password, setPassword,
    authLoading, authError, authMsg, handleAuth
  } = props

  return (
    <div style={{ background:"#111", padding:20, borderRadius:12 }}>
      <div style={{ fontWeight:700, marginBottom:10 }}>CamCash</div>

      <div style={{ display:"flex", marginBottom:10 }}>
        <button onClick={()=>setIsSignUp(true)}>Sign Up</button>
        <button onClick={()=>setIsSignUp(false)}>Log In</button>
      </div>

      <form onSubmit={handleAuth}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />

        {authError && <div style={{ color:"red" }}>{authError}</div>}
        {authMsg && <div>{authMsg}</div>}

        <button type="submit">
          {isSignUp ? "Start Free →" : "Log In →"}
        </button>
      </form>
    </div>
  )
})

export default function LandingPage() {
  const router = useRouter()

  const [msgIndex, setMsgIndex] = useState(0)
  const [titleIndex, setTitleIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg] = useState("")
  const [authError, setAuthError] = useState("")

  const messages = [
    "Hey I've been thinking about you... I'm live tonight",
    "Miss you come make tonight fun",
    "It's been a while... come back",
  ]

  const titles = [
    "Come hang out with me tonight",
    "VIP show tonight don't miss it",
    "Feeling naughty come watch",
  ]

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard")
    })
  }, [router])

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError("")
    setAuthMsg("")

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else setAuthMsg("Check your email to confirm")
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
      else router.push("/dashboard")
    }

    setAuthLoading(false)
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div style={{ minHeight:"100vh", background:"#05070f", color:"white" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:40 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:40 }}>

          {/* LEFT */}
          <div>
            <h1 style={{ fontSize:48, fontWeight:900 }}>
              Turn Your Fans Into<br />
              <span style={{
                background:"linear-gradient(135deg,#3b82f6,#ec4899)",
                WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent"
              }}>
                More Money
              </span>{" "}
              — Automatically
            </h1>

            {/* GENERATORS ABOVE FOLD */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:30 }}>

              <div style={{ background:"#111", padding:16 }}>
                <div>Message Generator</div>
                <div>{messages[msgIndex]}</div>
                <button onClick={()=>setMsgIndex((msgIndex+1)%messages.length)}>Generate</button>
                <button onClick={()=>handleCopy(messages[msgIndex])}>{copied?"Copied":"Copy"}</button>
              </div>

              <div style={{ background:"#111", padding:16 }}>
                <div>Room Title Generator</div>
                <div>{titles[titleIndex]}</div>
                <button onClick={()=>setTitleIndex((titleIndex+1)%titles.length)}>Generate</button>
                <button onClick={()=>handleCopy(titles[titleIndex])}>Copy</button>
              </div>

            </div>

            {/* CTA */}
            <div style={{ marginTop:20 }}>
              <button className="pulse">Engage Now</button>
              <button className="pulse alt">Message Now</button>
            </div>

          </div>

          {/* RIGHT */}
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
      </div>

      <style jsx>{`
        .pulse {
          padding:10px;
          margin-right:10px;
          background:linear-gradient(135deg,#3b82f6,#ec4899);
          animation:pulse 2s infinite;
        }
        .alt { background:#1e293b; }

        @keyframes pulse {
          0%{transform:scale(1);}
          50%{transform:scale(1.05);}
          100%{transform:scale(1);}
        }

        @media (max-width:768px){
          div[style*="grid-template-columns:1fr 380px"]{
            grid-template-columns:1fr!important;
          }
          div[style*="grid-template-columns:1fr 1fr"]{
            grid-template-columns:1fr!important;
          }
        }
      `}</style>
    </div>
  )
}