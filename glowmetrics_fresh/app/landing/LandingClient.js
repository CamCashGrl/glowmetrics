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
  const [slide,setSlide]=useState(0)

  const messages = [
    "Hey 😘 I've been thinking about you... I'm live tonight ❤️",
    "Miss you 💕 come see me tonight 🔥",
    "It’s been a while… come make tonight worth it 😈"
  ]

  const slides = [
    {
      title:"Top Tipper Found",
      desc:"You made $3,240 from one user last week"
    },
    {
      title:"Best Time Identified",
      desc:"You earn 2.3x more at 11PM"
    },
    {
      title:"Lost Whale Detected",
      desc:"$18,940 spender hasn’t tipped in 600 days"
    }
  ]

  useEffect(()=>{
    const msgInterval = setInterval(()=>{
      setMsgIndex((prev)=>(prev+1)%messages.length)
    },3000)

    const slideInterval = setInterval(()=>{
      setSlide((prev)=>(prev+1)%slides.length)
    },4000)

    return ()=>{
      clearInterval(msgInterval)
      clearInterval(slideInterval)
    }
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
      <section style={{textAlign:"center",padding:"80px 20px 40px"}}>
        <h1 style={{fontSize:48,color:C.white,fontWeight:900}}>
          Cam Model Analytics That<br/>Actually Makes You More Money
        </h1>

        <p style={{maxWidth:600,margin:"20px auto",fontSize:18}}>
          Track your tips, find your biggest spenders, and increase your earnings every stream.
        </p>

        <button onClick={()=>go("/login")} style={{
          padding:"16px 40px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          Sign Up
        </button>

        <p style={{marginTop:10,color:"#ec4899",fontSize:13}}>
          63 / 100 spots left
        </p>
      </section>

      {/* 🔥 SLIDING DEMO */}
      <section style={{textAlign:"center",padding:"20px"}}>
        <div style={{
          maxWidth:700,
          margin:"0 auto",
          padding:20,
          borderRadius:16,
          background:C.card,
          border:"1px solid rgba(255,255,255,0.08)"
        }}>
          <h3 style={{color:C.white,fontSize:20}}>
            {slides[slide].title}
          </h3>

          <p style={{marginTop:10,color:C.muted}}>
            {slides[slide].desc}
          </p>
        </div>
      </section>

      {/* 🐳 MESSAGE GENERATOR */}
      <section style={{textAlign:"center",padding:"40px 20px"}}>
        <h2 style={{color:C.white,fontSize:28,fontWeight:800}}>
          Reconnect With Your Biggest Tippers
        </h2>

        <div style={{
          margin:"30px auto",
          maxWidth:600,
          padding:20,
          borderRadius:16,
          background:"linear-gradient(135deg,#1e293b,#020617)",
          cursor:"pointer"
        }}
        onClick={()=>setMsgIndex((prev)=>(prev+1)%messages.length)}
        >
          <div style={{fontSize:13,color:C.muted,marginBottom:10}}>
            user_BIGGESTWHALE999 • $18,940 lifetime
          </div>

          <div style={{
            background:"rgba(255,255,255,0.05)",
            padding:15,
            borderRadius:10
          }}>
            {messages[msgIndex]}
          </div>

          <p style={{marginTop:10,fontSize:12,color:"#ec4899"}}>
            Click to generate another
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{maxWidth:1000,margin:"40px auto",padding:"0 20px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20}}>
          {[
            ["🐳 Top Tippers","Know exactly who spends the most"],
            ["⚡ Best Hours","See when you make the most money"],
            ["💌 Re-engagement","Bring back old spenders"],
            ["📈 Growth Insights","Understand what increases income"],
          ].map(([title,desc])=>(
            <div key={title} style={{
              background:C.card,
              padding:20,
              borderRadius:16
            }}>
              <div style={{color:C.white,fontWeight:700}}>{title}</div>
              <div style={{fontSize:14,color:C.muted,marginTop:6}}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{textAlign:"center",padding:"60px 20px"}}>
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
