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

  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>40)
    window.addEventListener("scroll",onScroll)
    return()=>window.removeEventListener("scroll",onScroll)
  },[])

  const go=(path)=>router.push(path)

  return(
    <div style={{minHeight:"100vh",background:"#05070f",color:C.text,fontFamily:"Inter, sans-serif"}}>

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
          Cam Model Analytics That<br/>Actually Makes You More Money
        </h1>

        <p style={{maxWidth:600,margin:"20px auto",fontSize:18}}>
          Upload your CSV and instantly see your top tippers, best stream times, and exactly what to do next.
        </p>

        <button onClick={()=>go("/login")} style={{
          marginTop:20,
          padding:"16px 40px",
          borderRadius:12,
          background:"linear-gradient(135deg,#3b82f6,#ec4899)",
          color:"white",
          fontWeight:700
        }}>
          Start Free
        </button>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section style={{textAlign:"center",padding:"40px 20px"}}>
        <img
          src="/dashboard-preview.png"
          alt="Cam model analytics dashboard showing earnings, top tippers, and peak hours"
          style={{
            width:"100%",
            maxWidth:900,
            borderRadius:16,
            border:"1px solid rgba(255,255,255,0.1)"
          }}
        />
        <p style={{marginTop:10,color:C.muted}}>
          Real insights from your actual earnings data — not estimates
        </p>
      </section>

      {/* FEATURES */}
      <section style={{maxWidth:1000,margin:"60px auto",padding:"0 20px"}}>
        <h2 style={{color:C.white,fontSize:32,fontWeight:800,textAlign:"center",marginBottom:40}}>
          What You Get
        </h2>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20}}>
          {[
            ["🐳 Top Tippers","Know exactly who spends the most"],
            ["⚡ Best Hours","See when you make the most money"],
            ["💌 Re-engagement","Message fans before they disappear"],
            ["📈 Growth Insights","Understand what increases income"],
          ].map(([title,desc])=>(
            <div key={title} style={{
              background:C.card,
              padding:20,
              borderRadius:16,
              border:"1px solid rgba(255,255,255,0.05)"
            }}>
              <div style={{fontWeight:700,color:C.white}}>{title}</div>
              <div style={{fontSize:14,color:C.muted,marginTop:6}}>{desc}</div>
            </div>
          ))}
        </div>
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
          Upload Your CSV
        </button>
      </section>

      {/* 🔥 SEO FOOTER (VERY IMPORTANT) */}
      <footer style={{
        borderTop:"1px solid rgba(255,255,255,0.08)",
        padding:"40px 20px",
        maxWidth:1100,
        margin:"0 auto"
      }}>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:20}}>

          {/* BRAND */}
          <div>
            <div style={{fontWeight:800,color:C.white,marginBottom:10}}>CamCash</div>
            <p style={{fontSize:13,color:C.muted}}>
              Cam model analytics tool for tracking earnings, fans, and growth.
            </p>
          </div>

          {/* SEO LINKS */}
          <div>
            <div style={{color:C.white,fontWeight:600,marginBottom:10}}>Guides</div>
            <a href="/guides/best-time-guide-chaturbate">Best time to stream (Chaturbate)</a><br/>
            <a href="/guides/more-tips-guide-chaturbate">How to get more tips</a><br/>
            <a href="/guides/top-tippers-guide-camsoda">Top tippers strategy</a><br/>
            <a href="/guides/increase-income-guide-myfreecams">Increase cam income</a>
          </div>

          {/* KEYWORDS */}
          <div>
            <div style={{color:C.white,fontWeight:600,marginBottom:10}}>Platform Tools</div>
            <a href="/guides/best-time-guide-chaturbate">Chaturbate analytics</a><br/>
            <a href="/guides/best-time-guide-camsoda">CamSoda analytics</a><br/>
            <a href="/guides/best-time-guide-bongacams">BongaCams analytics</a><br/>
            <a href="/guides/best-time-guide-stripchat">Stripchat analytics</a>
          </div>

        </div>

        <div style={{marginTop:30,fontSize:12,color:C.muted}}>
          © 2026 CamCash — Built for cam models who want to grow
        </div>
      </footer>

    </div>
  )
}
