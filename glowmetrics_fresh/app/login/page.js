"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { Suspense } from "react"

const G = {
  bg:"#05050f", bg1:"#090918", bg2:"#0e0e22", bg3:"#13132d",
  border:"#1a1a3e", border2:"#252550",
  glow:"#c084fc", glow2:"#e879f9", teal:"#2dd4bf",
  green:"#34d399", pink:"#f472b6", red:"#f87171",
  white:"#faf5ff", med:"#a78bca", dim:"#5b4d7a",
}

const inp = {
  width:"100%", padding:"13px 16px",
  background:G.bg2, border:`1px solid ${G.border}`,
  borderRadius:10, color:G.white, fontSize:14,
  fontFamily:"'Space Grotesk', sans-serif",
  transition:"border-color 0.2s, box-shadow 0.2s",
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const isAdmin = mode === "admin"

  const submit = async () => {
    setError(""); setSuccess("")
    if (!email || !password) { setError("Email and password are required."); return }
    setLoading(true)
    try {
      if (isAdmin) {
        const res = await fetch("/api/auth/admin", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ email, password }),
        })
        const d = await res.json()
        if (!res.ok) { setError(d.error || "Invalid credentials."); return }
        document.cookie = `gm_admin=${d.token}; path=/; max-age=86400; samesite=strict`
        router.replace("/admin")
        return
      }
      if (mode === "signup") {
        if (password !== confirm) { setError("Passwords don't match."); return }
        if (password.length < 8) { setError("Password must be at least 8 characters."); return }
        const { error: e } = await supabase.auth.signUp({
          email, password, options:{ data:{ display_name: name || email.split("@")[0] } }
        })
        if (e) { setError(e.message); return }
        setSuccess("Account created! Check your email to confirm, then log in.")
        setMode("login")
        return
      }
      const { error: e } = await supabase.auth.signInWithPassword({ email, password })
      if (e) { setError(e.message); return }
      router.replace("/dashboard")
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:"100vh", background:G.bg, display:"flex", fontFamily:"'Syne', sans-serif" }}>

      {/* Left — branding */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"60px 72px", background:G.bg1, borderRight:`1px solid ${G.border}`,
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:"-15%", left:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, #c084fc0a, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"5%", right:"-5%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, #e879f908, transparent 65%)", pointerEvents:"none" }} />

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:60 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg, #c084fc, #e879f9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 0 24px #c084fc40" }}>✦</div>
          <span style={{ fontSize:20, fontWeight:800, color:G.white, letterSpacing:"-0.02em" }}>Glow<span style={{color:G.glow}}>Metrics</span></span>
        </div>

        <h1 style={{ fontSize:"clamp(32px, 3vw, 46px)", fontWeight:800, color:G.white, lineHeight:1.15, marginBottom:20, letterSpacing:"-0.025em" }}>
          Your earnings.<br/>
          <span style={{ background:"linear-gradient(135deg, #c084fc, #e879f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Fully analyzed.</span>
        </h1>
        <p style={{ fontSize:15, color:G.med, lineHeight:1.7, maxWidth:360, marginBottom:48, fontFamily:"'Space Grotesk',sans-serif" }}>
          Import your CSV once and get instant access to every metric — earnings, tippers, peak hours, trends, and your VIP fan CRM.
        </p>

        {[
          ["🐳", "Whale & tipper classification"],
          ["⏰", "Peak hour & day analysis"],
          ["📈", "Cumulative earnings curves"],
          ["🔒", "Database-level privacy"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ fontSize:15 }}>{icon}</span>
            <span style={{ fontSize:14, color:G.med, fontFamily:"'Space Grotesk',sans-serif" }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Right — form */}
      <div style={{ width:460, display:"flex", flexDirection:"column", justifyContent:"center", padding:"60px 52px", background:G.bg }}>

        {/* Tab switcher */}
        {!isAdmin && (
          <div style={{ display:"flex", background:G.bg2, borderRadius:10, padding:4, marginBottom:36, border:`1px solid ${G.border}` }}>
            {[["login","Log In"],["signup","Sign Up"]].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError("") }}
                style={{
                  flex:1, padding:"10px 0", borderRadius:7, border:"none",
                  background: mode===m ? "linear-gradient(135deg, #c084fc, #e879f9)" : "transparent",
                  color: mode===m ? G.bg : G.dim,
                  fontWeight:700, fontSize:14, transition:"all 0.2s",
                  fontFamily:"'Syne',sans-serif",
                }}>{label}</button>
            ))}
          </div>
        )}

        <h2 style={{ fontSize:26, fontWeight:800, color:G.white, marginBottom:6, letterSpacing:"-0.02em" }}>
          {mode==="login" ? "Welcome back" : mode==="signup" ? "Create your account" : "Admin access"}
        </h2>
        <p style={{ fontSize:14, color:G.dim, marginBottom:28, fontFamily:"'Space Grotesk',sans-serif" }}>
          {mode==="login" ? "Sign in to your GlowMetrics dashboard" : mode==="signup" ? "Free forever to start" : "Restricted access only"}
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {mode==="signup" && (
            <div>
              <label style={{ fontSize:11, color:G.dim, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8, fontFamily:"'DM Mono',monospace" }}>Display Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Your cam name" style={inp}
                onFocus={e=>{e.target.style.borderColor=G.glow;e.target.style.boxShadow=`0 0 0 3px ${G.glow}15`}}
                onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}} />
            </div>
          )}
          <div>
            <label style={{ fontSize:11, color:G.dim, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8, fontFamily:"'DM Mono',monospace" }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="you@example.com" style={inp}
              onFocus={e=>{e.target.style.borderColor=G.glow;e.target.style.boxShadow=`0 0 0 3px ${G.glow}15`}}
              onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}} />
          </div>
          <div>
            <label style={{ fontSize:11, color:G.dim, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8, fontFamily:"'DM Mono',monospace" }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={inp}
              onFocus={e=>{e.target.style.borderColor=G.glow;e.target.style.boxShadow=`0 0 0 3px ${G.glow}15`}}
              onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}} />
          </div>
          {mode==="signup" && (
            <div>
              <label style={{ fontSize:11, color:G.dim, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8, fontFamily:"'DM Mono',monospace" }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={inp}
                onFocus={e=>{e.target.style.borderColor=G.glow;e.target.style.boxShadow=`0 0 0 3px ${G.glow}15`}}
                onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}} />
            </div>
          )}
        </div>

        {error && <div style={{ marginTop:18, padding:"12px 16px", borderRadius:8, background:`${G.red}15`, border:`1px solid ${G.red}40`, color:G.red, fontSize:13, fontFamily:"'Space Grotesk',sans-serif" }}>{error}</div>}
        {success && <div style={{ marginTop:18, padding:"12px 16px", borderRadius:8, background:`${G.green}15`, border:`1px solid ${G.green}40`, color:G.green, fontSize:13, fontFamily:"'Space Grotesk',sans-serif" }}>{success}</div>}

        <button onClick={submit} disabled={loading}
          style={{
            marginTop:24, padding:"14px 0", borderRadius:10, border:"none",
            background: loading ? G.border2 : "linear-gradient(135deg, #c084fc, #e879f9)",
            color: loading ? G.dim : G.bg, fontWeight:700, fontSize:15,
            boxShadow: loading ? "none" : "0 6px 24px #c084fc35",
            transition:"all 0.2s", fontFamily:"'Syne',sans-serif",
          }}>
          {loading ? "Please wait..." : mode==="login" ? "Sign In →" : mode==="signup" ? "Create Account →" : "Admin Sign In →"}
        </button>

        <div style={{ marginTop:28, textAlign:"center" }}>
          {!isAdmin
            ? <button onClick={()=>{setMode("admin");setError("")}} style={{ background:"none", border:"none", color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>Admin access →</button>
            : <button onClick={()=>{setMode("login");setError("")}} style={{ background:"none", border:"none", color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>← Back to login</button>
          }
        </div>

        <div style={{ marginTop:20, textAlign:"center" }}>
          <button onClick={()=>router.push("/landing")} style={{ background:"none", border:"none", color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>← Back to home</button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
