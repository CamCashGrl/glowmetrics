"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LandingPage(){
  const router = useRouter()

  const [msgIndex,setMsgIndex] = useState(0)
  const [copied,setCopied] = useState(false)
  const [whaleIndex,setWhaleIndex] = useState(0)
  const [alertIndex,setAlertIndex] = useState(0)

  const messages = [
    "Hey 😘 I’ve been thinking about you... I’m live tonight ❤️",
    "Miss you 💕 come make tonight fun 🔥",
    "It’s been a while… come back 😈"
  ]

  const whales = [
    { name:"user_ULTRAVIP999", spent:"$41,820", inactive:"520 days" },
    { name:"user_TOPSPENDERX", spent:"$33,140", inactive:"300 days" }
  ]

  const alerts = [
    "You have top spenders you’re not tracking.",
    "You’re missing your highest earning hours.",
    "You have inactive whales worth thousands.",
    "You could be earning more on a different platform."
  ]

  // rotate data
  useEffect(()=>{
    const a = setInterval(()=>{
      setMsgIndex(p=>(p+1)%messages.length)
      setWhaleIndex(p=>(p+1)%whales.length)
    },5000)

    const b = setInterval(()=>{
      setAlertIndex(p=>(p+1)%alerts.length)
    },4000)

    return ()=>{clearInterval(a);clearInterval(b)}
  },[])

  const handleCopy = ()=>{
    navigator.clipboard.writeText(messages[msgIndex])
    setCopied(true)
    setTimeout(()=>setCopied(false),1200)
  }

  return(
    <div style={{
      minHeight:"100vh",
      background:"#05070f",
      color:"#cbd5e1",
      fontFamily:"Inter, sans-serif",
      padding:"40px 20px"
    }}>

      {/* HERO */}
      <div style={{textAlign:"center",maxWidth:780,margin:"0 auto"}}>
        <h1 style={{
          fontSize:52,
          color:"white",
          fontWeight:900,
          lineHeight:1.1
        }}>
          Turn Your Fans Into<br/>More Money — Automatically
        </h1>

        <p style={{marginTop:16,fontSize:18}}>
          See your biggest spenders, when you earn most, and exactly what to do next.
        </p>

        <button onClick={()=>router.push("/login")} style={{
          marginTop:24,
          padding:"16px 44px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700,
          fontSize:16
        }}>
          Sign Up
        </button>

        <p style={{marginTop:10,color:"#ec4899",fontWeight:600}}>
          63 / 100 spots left
        </p>
      </div>

      {/* AI ALERT */}
      <div style={{
        maxWidth:780,
        margin:"28px auto",
        padding:"14px 18px",
        borderRadius:12,
        background:"rgba(168,85,247,0.08)",
        border:"1px solid rgba(168,85,247,0.25)",
        fontSize:14
      }}>
        🤖 <strong>AI Insight:</strong> {alerts[alertIndex]}
      </div>

      {/* MAIN FEATURE */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1.4fr 1fr",
        gap:18,
        maxWidth:900,
        margin:"40px auto"
      }}>

        {/* GENERATOR */}
        <div className="card">
          <div className="title">
            <span className="pulse">💌</span> Message a High Spender
          </div>

          <div className="box">
            {messages[msgIndex]}
          </div>

          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={()=>setMsgIndex(p=>(p+1)%messages.length)} className="btn2">
              Generate
            </button>

            <button onClick={handleCopy} className="btn1">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* WHALE */}
        <div className="card">
          <div className="title">🐳 High Spender</div>

          <div style={{marginTop:10}}>
            <div style={{fontWeight:600}}>
              {whales[whaleIndex].name}
            </div>

            <div style={{color:"#ec4899",marginTop:6,fontSize:18}}>
              {whales[whaleIndex].spent}
            </div>

            <div style={{color:"#64748b"}}>
              inactive {whales[whaleIndex].inactive}
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD */}
      <div style={{textAlign:"center"}}>
        <img
          src="/dashboard-preview.png"
          style={{
            width:"100%",
            maxWidth:900,
            borderRadius:14,
            border:"1px solid rgba(255,255,255,0.08)"
          }}
        />
        <p style={{marginTop:10,color:"#64748b"}}>
          Instant breakdown of your earnings, fans, and peak times
        </p>
      </div>

      {/* PLATFORM EDGE */}
      <div style={{
        maxWidth:900,
        margin:"40px auto",
        display:"grid",
        gridTemplateColumns:"1fr 1fr",
        gap:18
      }}>
        <div className="card">
          <div className="title">📊 Platform Comparison</div>
          <div style={{marginTop:10}}>
            Chaturbate — $520 avg<br/>
            Stripchat — $340 avg<br/>
            CamSoda — $290 avg
          </div>
        </div>

        <div className="card">
          <div className="title">💡 What This Means</div>
          <div style={{marginTop:10}}>
            You’re making ~35% more on Chaturbate.  
            Stream there more often.
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{textAlign:"center",marginTop:30}}>
        <button onClick={()=>router.push("/login")} className="btn1 big">
          Start Making More Per Stream
        </button>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .card {
          background: linear-gradient(135deg,#1e293b,#020617);
          padding:20px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.06);
          transition:0.25s;
        }

        .card:hover {
          box-shadow:0 0 20px rgba(236,72,153,0.25);
          transform:translateY(-2px);
        }

        .title {
          color:#a855f7;
          font-weight:600;
        }

        .box {
          background:rgba(255,255,255,0.05);
          padding:14px;
          border-radius:10px;
          margin-top:10px;
          min-height:65px;
        }

        .pulse {
          animation:pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%{transform:scale(1)}
          50%{transform:scale(1.2)}
          100%{transform:scale(1)}
        }

        .btn1 {
          flex:1;
          padding:10px;
          border-radius:8px;
          background:linear-gradient(135deg,#3b82f6,#ec4899);
          color:white;
          font-weight:700;
        }

        .btn2 {
          flex:1;
          padding:10px;
          border-radius:8px;
          background:#0f172a;
          color:white;
        }

        .big {
          padding:16px 40px;
          font-size:16px;
        }
      `}</style>

    </div>
  )
}
