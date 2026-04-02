"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LandingPage(){
  const router = useRouter()

  const fullMessages = [
    "Hey 😘 I’ve been thinking about you... I’m live tonight ❤️",
    "Miss you 💕 come make tonight fun 🔥",
    "It’s been a while… come back 😈"
  ]

  const [displayed,setDisplayed] = useState("")
  const [msgIndex,setMsgIndex] = useState(0)
  const [copied,setCopied] = useState(false)

  const whales = [
    { name:"user_SUPREMEVIP888", spent:"$31,920", inactive:"380 days" },
    { name:"user_HIGHROLLERX", spent:"$22,410", inactive:"210 days" }
  ]

  const [whaleIndex,setWhaleIndex] = useState(0)

  // typing effect
  useEffect(()=>{
    let i = 0
    setDisplayed("")
    const text = fullMessages[msgIndex]

    const interval = setInterval(()=>{
      setDisplayed(text.slice(0,i))
      i++
      if(i > text.length) clearInterval(interval)
    },20)

    return ()=>clearInterval(interval)
  },[msgIndex])

  // rotate whale + message
  useEffect(()=>{
    const interval = setInterval(()=>{
      setMsgIndex(p=>(p+1)%fullMessages.length)
      setWhaleIndex(p=>(p+1)%whales.length)
    },5000)
    return ()=>clearInterval(interval)
  },[])

  const handleCopy = ()=>{
    navigator.clipboard.writeText(fullMessages[msgIndex])
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
      <div style={{textAlign:"center"}}>
        <h1 style={{fontSize:42,color:"white",fontWeight:900}}>
          Cam Model Analytics That Makes You More Money
        </h1>

        <p style={{marginTop:10}}>
          Find your biggest tippers. Bring them back. Earn more every stream.
        </p>

        <button onClick={()=>router.push("/login")} style={{
          marginTop:20,
          padding:"14px 36px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          Sign Up
        </button>

        <p style={{marginTop:8,color:"#ec4899"}}>
          63 / 100 spots left
        </p>
      </div>

      {/* MAIN GRID */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1.5fr 1fr",
        gap:20,
        maxWidth:900,
        margin:"40px auto"
      }}>

        {/* MESSAGE */}
        <div className="card">
          <div className="title">
            <span className="pulse">💌</span> Re-engage
          </div>

          <div className="box">
            {displayed}
            <span className="cursor">|</span>
          </div>

          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={()=>setMsgIndex(p=>(p+1)%fullMessages.length)} className="btn2">
              Generate
            </button>

            <button onClick={handleCopy} className="btn1">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* WHALE */}
        <div className="card">
          <div className="title">🐳 Whale Profile</div>

          <div style={{marginTop:10}}>
            <div>{whales[whaleIndex].name}</div>
            <div style={{color:"#ec4899",marginTop:6}}>
              {whales[whaleIndex].spent} spent
            </div>
            <div style={{color:"#64748b"}}>
              {whales[whaleIndex].inactive} inactive
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{textAlign:"center",marginTop:40}}>
        <button onClick={()=>router.push("/login")} className="btn1 big">
          Start Earning More
        </button>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .card {
          background: linear-gradient(135deg,#1e293b,#020617);
          padding:20px;
          border-radius:16px;
          border:1px solid rgba(255,255,255,0.08);
          transition:0.3s;
        }

        .card:hover {
          box-shadow:0 0 25px rgba(236,72,153,0.3);
          transform:translateY(-2px);
        }

        .title {
          color:#a855f7;
          font-weight:600;
          margin-bottom:10px;
        }

        .box {
          background:rgba(255,255,255,0.05);
          padding:15px;
          border-radius:10px;
          min-height:70px;
        }

        .cursor {
          animation:blink 1s infinite;
        }

        @keyframes blink {
          0%,100%{opacity:1}
          50%{opacity:0}
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
