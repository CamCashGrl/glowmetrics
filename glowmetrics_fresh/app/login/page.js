"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { Suspense } from "react"

const C = {
  bg:"#0F172A",bg1:"#131d35",bg2:"#172040",bg3:"#1e2a4a",
  border:"#2d3d6b",border2:"#3d52a0",
  indigo:"#6366F1",indigo2:"#818CF8",indigo3:"#A5B4FC",
  violet:"#7C3AED",green:"#10B981",red:"#f87171",
  white:"#F8FAFC",text:"#CBD5E1",muted:"#64748B",dim:"#334155",
}

const inp = {
  width:"100%",padding:"13px 16px",
  background:"rgba(23,32,64,0.8)",border:`1px solid ${C.border}`,
  borderRadius:10,color:C.white,fontSize:14,
  fontFamily:"'Plus Jakarta Sans',sans-serif",
  transition:"border-color 0.2s,box-shadow 0.2s",outline:"none",
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState(params.get("mode")==="signup"?"signup":"login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const isAdmin = mode==="admin"
  const isForgot = mode==="forgot"

  const submit = async () => {
    setError(""); setSuccess("")

    if (isForgot) {
      if (!email) { setError("Please enter your email."); return }
      setLoading(true)
      try {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=reset`,
        })
        if (e) { setError(e.message); return }
        setSuccess("Check your email! We sent you a password reset link.")
      } finally { setLoading(false) }
      return
    }

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
      if (mode==="signup") {
        if (password!==confirm) { setError("Passwords don't match."); return }
        if (password.length<8) { setError("Password must be at least 8 characters."); return }
        const { error: e } = await supabase.auth.signUp({
          email, password, options:{ data:{ display_name: name||email.split("@")[0] } }
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
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@700;800&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box}`}</style>

      {/* Left branding */}
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 72px",background:C.bg1,borderRight:`1px solid ${C.border}`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-15%",left:"-10%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,#6366F10a,transparent 65%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"5%",right:"-5%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#7C3AED08,transparent 65%)",pointerEvents:"none"}}/>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:60}}>
          <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 0 24px #6366F140"}}>📊</div>
          <span style={{fontSize:20,fontWeight:800,color:C.white,letterSpacing:"-0.02em",fontFamily:"'Outfit',sans-serif"}}>Cam<span style={{background:"linear-gradient(90deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>lytics</span></span>
        </div>

        <h1 style={{fontSize:"clamp(32px,3vw,46px)",fontWeight:800,color:C.white,lineHeight:1.15,marginBottom:20,letterSpacing:"-0.025em",fontFamily:"'Outfit',sans-serif"}}>
          Your earnings.<br/>
          <span style={{background:"linear-gradient(135deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Fully analyzed.</span>
        </h1>
        <p style={{fontSize:15,color:C.muted,lineHeight:1.7,maxWidth:360,marginBottom:48}}>
          Import your CSV once and get instant access to every metric — earnings, tippers, peak hours, trends, and your VIP fan CRM.
        </p>

        {[["🐳","Whale & tipper classification"],["⏰","Peak hour & day analysis"],["📈","Cumulative earnings curves"],["🔒","Database-level privacy"]].map(([icon,text])=>(
          <div key={text} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <span style={{fontSize:15}}>{icon}</span>
            <span style={{fontSize:14,color:C.muted}}>{text}</span>
          </div>
        ))}
      </div>

      {/* Right form */}
      <div style={{width:460,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 52px",background:C.bg}}>

        {!isAdmin && !isForgot && (
          <div style={{display:"flex",background:C.bg2,borderRadius:10,padding:4,marginBottom:36,border:`1px solid ${C.border}`}}>
            {[["login","Log In"],["signup","Sign Up"]].map(([m,label])=>(
              <button key={m} onClick={()=>{setMode(m);setError("")}}
                style={{flex:1,padding:"10px 0",borderRadius:7,border:"none",background:mode===m?"linear-gradient(135deg,#6366F1,#7C3AED)":"transparent",color:mode===m?C.white:C.muted,fontWeight:700,fontSize:14,transition:"all 0.2s",fontFamily:"inherit"}}>{label}</button>
            ))}
          </div>
        )}

        <h2 style={{fontSize:26,fontWeight:800,color:C.white,marginBottom:6,letterSpacing:"-0.02em",fontFamily:"'Outfit',sans-serif"}}>
          {isForgot?"Reset your password":mode==="login"?"Welcome back":mode==="signup"?"Create your account":"Admin access"}
        </h2>
        <p style={{fontSize:14,color:C.muted,marginBottom:28}}>
          {isForgot?"Enter your email and we'll send you a reset link":mode==="login"?"Sign in to your Camlytics dashboard":mode==="signup"?"Free forever to start":"Restricted access only"}
        </p>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {mode==="signup" && (
            <div>
              <label style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",display:"block",marginBottom:8,fontFamily:"'DM Mono',monospace"}}>Display Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Your cam name" style={inp}
                onFocus={e=>{e.target.style.borderColor=C.indigo;e.target.style.boxShadow=`0 0 0 3px ${C.indigo}20`}}
                onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none"}}/>
            </div>
          )}
          <div>
            <label style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",display:"block",marginBottom:8,fontFamily:"'DM Mono',monospace"}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="you@example.com" style={inp}
              onFocus={e=>{e.target.style.borderColor=C.indigo;e.target.style.boxShadow=`0 0 0 3px ${C.indigo}20`}}
              onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none"}}/>
          </div>
          {!isForgot && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <label style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'DM Mono',monospace"}}>Password</label>
                {mode==="login" && (
                  <button onClick={()=>{setMode("forgot");setError("");setSuccess("")}} style={{background:"none",border:"none",color:C.indigo3,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Forgot password?</button>
                )}
              </div>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={inp}
                onFocus={e=>{e.target.style.borderColor=C.indigo;e.target.style.boxShadow=`0 0 0 3px ${C.indigo}20`}}
                onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none"}}/>
            </div>
          )}
          {mode==="signup" && (
            <div>
              <label style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",display:"block",marginBottom:8,fontFamily:"'DM Mono',monospace"}}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" style={inp}
                onFocus={e=>{e.target.style.borderColor=C.indigo;e.target.style.boxShadow=`0 0 0 3px ${C.indigo}20`}}
                onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none"}}/>
            </div>
          )}
        </div>

        {error && <div style={{marginTop:18,padding:"12px 16px",borderRadius:8,background:`${C.red}15`,border:`1px solid ${C.red}40`,color:C.red,fontSize:13}}>{error}</div>}
        {success && <div style={{marginTop:18,padding:"12px 16px",borderRadius:8,background:`${C.green}15`,border:`1px solid ${C.green}40`,color:C.green,fontSize:13}}>{success}</div>}

        <button onClick={submit} disabled={loading}
          style={{marginTop:24,padding:"14px 0",borderRadius:10,border:"none",background:loading?C.border:"linear-gradient(135deg,#6366F1,#7C3AED)",color:loading?C.muted:C.white,fontWeight:700,fontSize:15,boxShadow:loading?"none":"0 6px 24px #6366F135",transition:"all 0.2s",fontFamily:"inherit"}}>
          {loading?"Please wait...":isForgot?"Send Reset Link →":mode==="login"?"Sign In →":mode==="signup"?"Create Account →":"Admin Sign In →"}
        </button>

        {isForgot && (
          <button onClick={()=>{setMode("login");setError("");setSuccess("")}} style={{marginTop:16,background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>← Back to login</button>
        )}

        <div style={{marginTop:28,textAlign:"center"}}>
          {!isAdmin && !isForgot
            ? <button onClick={()=>{setMode("admin");setError("")}} style={{background:"none",border:"none",color:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>Admin access →</button>
            : !isForgot && <button onClick={()=>{setMode("login");setError("")}} style={{background:"none",border:"none",color:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>← Back to login</button>
          }
        </div>

        <div style={{marginTop:20,textAlign:"center"}}>
          <button onClick={()=>router.push("/landing")} style={{background:"none",border:"none",color:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>← Back to home</button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
