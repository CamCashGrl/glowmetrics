"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#05070f",
  card:"rgba(15,20,32,0.7)",
  border:"#1e2842",
  blue:"#3b82f6",
  purple:"#a855f7",
  pink:"#ec4899",
  white:"#f8fafc",
  text:"#cbd5e1",
  muted:"#64748b",
}

export default function LandingPage(){
  const router=useRouter()
  const [msgIndex,setMsgIndex]=useState(0)

  const messages = [
    "Hey 😘 I've been thinking about you... I'm live tonight and want YOU there ❤️",
    "Miss you 💕 come see me tonight... I’ve got something special 🔥",
    "It’s been a while… come make tonight worth it 😈"
  ]

  useEffect(()=>{
    const interval = setInterval(()=>{
      setMsgIndex((prev)=>(prev+1)%messages.length)
    },3000)
    return ()=>clearInterval(interval)
  },[])

  const go=(path)=>router.push(path)

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Inter, sans-serif"}}>

      {/* NAV */}
      <nav style={{padding:"20px 40px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex"}}>
          <div style={{fontWeight:800,fontSize:22,color:C.white}}>CamCash</div>
          <div style={{marginLeft:"auto"}}>
            <button onClick={()=>go("/login")} style={{color:C.text}}>Login</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{textAlign:"center",padding:"40px 20px"}}>
        <h1 style={{fontSize:42,color:C.white,fontWeight:900}}>
          Find Your Biggest Tippers.<br/>Make More Every Stream.
        </h1>

        <p style={{marginTop:10,color:C.muted}}>
          Cam model analytics + AI tools to increase tips, re-engage fans, and grow income
        </p>

        <button onClick={()=>go("/login")} style={{
          marginTop:20,
          padding:"14px 36px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          Sign Up
        </button>

        <p style={{marginTop:8,fontSize:12,color:"#ec4899"}}>
          Free early access • Limited spots
        </p>
      </section>

      {/* 🔥 FEATURE GRID */}
      <section style={{maxWidth:1100,margin:"0 auto",padding:"20px"}}>

        {/* TOP ROW */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"2fr 1fr",
          gap:20
        }}>

          {/* 🐳 MESSAGE GENERATOR (MAIN) */}
          <div style={{
            background:"linear-gradient(135deg,#1e293b,#020617)",
            padding:20,
            borderRadius:20,
            border:"1px solid rgba(255,255,255,0.1)"
          }}>
            <div style={{color:"#a855f7",fontWeight:600}}>💌 Re-engage a Whale</div>

            <div style={{fontSize:13,color:C.muted,margin:"10px 0"}}>
              user_BIGGESTWHALE999 • 600 days inactive • $18,940 lifetime
            </div>

            <div style={{
              background:"rgba(255,255,255,0.05)",
              padding:16,
              borderRadius:12,
              minHeight:70
            }}>
              {messages[msgIndex]}
            </div>

            <div style={{display:"flex",gap:10,marginTop:15}}>
              <button style={{
                flex:1,
                padding:12,
                borderRadius:10,
                background:"#0f172a",
                color:"white"
              }}>
                Generate
              </button>

              <button style={{
                flex:1,
                padding:12,
                borderRadius:10,
                background:"linear-gradient(135deg,#3b82f6,#ec4899)",
                color:"white",
                fontWeight:700
              }}>
                Copy
              </button>
            </div>
          </div>

          {/* 📊 PROFILE INSIGHTS */}
          <div style={{
            background:C.card,
            padding:20,
            borderRadius:20,
            border:"1px solid rgba(255,255,255,0.05)"
          }}>
            <div style={{color:C.white,fontWeight:700}}>📊 Profile Insights</div>

            <div style={{marginTop:10,fontSize:14,color:C.muted}}>
              Top tipper: $3,240<br/>
              Best hour: 11PM<br/>
              Avg session: $420<br/>
              Peak day: Friday
            </div>
          </div>
        </div>

        {/* 🔥 ROOM TITLE GENERATOR */}
        <div style={{
          marginTop:20,
          background:C.card,
          padding:20,
          borderRadius:20,
          border:"1px solid rgba(255,255,255,0.05)"
        }}>
          <div style={{color:C.white,fontWeight:700}}>
            🔥 Room Title Generator
          </div>

          <div style={{
            marginTop:10,
            background:"rgba(255,255,255,0.05)",
            padding:14,
            borderRadius:10
          }}>
            “Naughty late night show 😈 tip to control me”
          </div>

          <button style={{
            marginTop:12,
            padding:"10px 20px",
            borderRadius:10,
            background:"linear-gradient(135deg,#3b82f6,#ec4899)",
            color:"white"
          }}>
            Generate New Title
          </button>
        </div>

      </section>

      {/* CTA */}
      <section style={{textAlign:"center",padding:"40px 20px"}}>
        <button onClick={()=>go("/login")} style={{
          padding:"16px 40px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:800
        }}>
          Sign Up & Start Earning More
        </button>
      </section>

    </div>
  )
}
