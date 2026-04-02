"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#05070f",
  card:"rgba(15,20,32,0.7)",
  border:"#1e2842",
  blue:"#3b82f6",
  purple:"#a855f7",
  teal:"#14b8a6",
  pink:"#ec4899",
  white:"#f8fafc",
  text:"#cbd5e1",
  muted:"#64748b",
}

export default function LandingPage(){
  const router=useRouter()
  const [scrolled,setScrolled]=useState(false)
  const [msgIndex,setMsgIndex]=useState(0)

  const messages = [
    "Hey 😘 I've been thinking about you... I'm going live tonight and I want YOU there ❤️",
    "Miss you 💕 come see me tonight... I’ve got something special for you 🔥",
    "It’s been a while… come make tonight worth it 😈"
  ]

  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>40)
    window.addEventListener("scroll",onScroll)

    const interval = setInterval(()=>{
      setMsgIndex((prev)=>(prev+1)%messages.length)
    },3000)

    return()=>{
      window.removeEventListener("scroll",onScroll)
      clearInterval(interval)
    }
  },[])

  const go=(path)=>router.push(path)

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Inter, sans-serif"}}>

      {/* NAV */}
      <nav style={{
        position:"sticky",top:0,zIndex:100,padding:"20px 40px",
        background:scrolled?"rgba(5,7,15,0.85)":"transparent",
        backdropFilter:"blur(12px)"
      }}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex"}}>
          <div style={{fontWeight:800,fontSize:22,color:C.white}}>CamCash</div>
          <div style={{marginLeft:"auto"}}>
            <button onClick={()=>go("/login")} style={{color:C.text}}>Login</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{textAlign:"center",padding:"100px 20px 60px"}}>
        <h1 style={{fontSize:48,color:C.white,fontWeight:900}}>
          You’re Already Making Money —<br/>Now Make More of It
        </h1>

        <p style={{maxWidth:600,margin:"20px auto",fontSize:18}}>
          Upload your stream data and instantly see:
          <br/>• Who spends the most
          <br/>• When you earn the most
          <br/>• How to increase your next stream income
        </p>

        <button onClick={()=>go("/login")} style={{
          marginTop:20,
          padding:"16px 40px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          Get Free Access
        </button>

        <p style={{marginTop:10,fontSize:13,color:C.muted}}>
          🔒 Free during early access — limited spots available
        </p>

        <p style={{marginTop:6,fontSize:13,color:"#ec4899"}}>
          37 / 100 early access spots taken
        </p>
      </section>

      {/* PAIN SECTION */}
      <section style={{maxWidth:900,margin:"40px auto",padding:"0 20px",textAlign:"center"}}>
        <h2 style={{color:C.white,fontSize:28,fontWeight:800,marginBottom:20}}>
          You’re Probably Leaving Money On The Table
        </h2>

        <div style={{color:C.muted,fontSize:16,lineHeight:1.8}}>
          <div>You don’t know who your biggest spenders are</div>
          <div>You miss high tippers when they enter</div>
          <div>You don’t know your most profitable times</div>
          <div>You’re guessing instead of optimizing</div>
        </div>
      </section>

      {/* 🔥 VIRAL MESSAGE GENERATOR */}
      <section style={{textAlign:"center",padding:"60px 20px"}}>
        <h2 style={{fontSize:32,fontWeight:800,color:C.white}}>
          Bring Back Your Biggest Spenders Instantly
        </h2>

        <p style={{color:C.muted,marginTop:10}}>
          Turn past tippers into tonight’s income
        </p>

        <div style={{
          margin:"40px auto",
          maxWidth:700,
          borderRadius:20,
          padding:20,
          background:"linear-gradient(135deg,#1e293b,#020617)",
          border:"1px solid rgba(255,255,255,0.1)",
          boxShadow:"0 0 40px rgba(236,72,153,0.25)"
        }}>

          <div style={{textAlign:"left",marginBottom:10,color:"#a855f7",fontWeight:600}}>
            ❤️ Message Generator
          </div>

          <div style={{textAlign:"left",fontSize:13,color:C.muted,marginBottom:15}}>
            user_ULTIMATEWHALE999999 • 842 days since last tip • $12,480 lifetime
          </div>

          <div style={{
            background:"rgba(255,255,255,0.05)",
            padding:20,
            borderRadius:12,
            minHeight:80
          }}>
            {messages[msgIndex]}
          </div>

          <div style={{display:"flex",gap:10,marginTop:20}}>
            <button style={{
              flex:1,
              padding:14,
              borderRadius:10,
              background:"#0f172a",
              color:"white"
            }}>
              Generate Another
            </button>

            <button style={{
              flex:1,
              padding:14,
              borderRadius:10,
              background:"linear-gradient(135deg,#3b82f6,#ec4899)",
              color:"white",
              fontWeight:700
            }}>
              Copy Message
            </button>
          </div>
        </div>

        <div style={{marginTop:10,color:"#ec4899",fontSize:14}}>
          🔥 127 creators used this today to bring back high spenders
        </div>
      </section>

      {/* DASHBOARD */}
      <section style={{textAlign:"center",padding:"40px 20px"}}>
        <img
          src="/dashboard-preview.png"
          alt="analytics dashboard"
          style={{
            width:"100%",
            maxWidth:900,
            borderRadius:16,
            border:"1px solid rgba(255,255,255,0.1)"
          }}
        />
        <p style={{marginTop:10,color:C.muted}}>
          See exactly where your money comes from — and how to increase it
        </p>
      </section>

      {/* CTA */}
      <section style={{textAlign:"center",padding:"80px 20px"}}>
        <h2 style={{fontSize:32,color:C.white,fontWeight:800}}>
          Stop Guessing. Start Earning Smarter.
        </h2>

        <button onClick={()=>go("/login")} style={{
          marginTop:20,
          padding:"16px 40px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          See My Earnings Insights
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop:"1px solid rgba(255,255,255,0.08)",
        padding:"40px 20px",
        maxWidth:1100,
        margin:"0 auto"
      }}>
        <div style={{fontSize:12,color:C.muted}}>
          © 2026 CamCash — Built to help you earn more
        </div>
      </footer>

    </div>
  )
}
