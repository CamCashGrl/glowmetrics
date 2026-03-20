"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#0a0e1a",
  card:"rgba(15,20,32,0.6)",
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
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Inter, sans-serif"}}>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        
        .btn-primary{
          background:linear-gradient(135deg,#3b82f6,#8b5cf6);
          border:none;
          border-radius:14px;
          padding:16px 40px;
          color:white;
          font-weight:700;
          transition:all .3s ease;
          box-shadow:0 10px 30px rgba(59,130,246,0.3);
        }
        .btn-primary:hover{
          transform:translateY(-3px) scale(1.02);
          box-shadow:0 20px 50px rgba(59,130,246,0.5);
        }

        .card{
          background:rgba(15,20,32,0.6);
          border:1px solid rgba(59,130,246,0.15);
          border-radius:20px;
          padding:28px;
          backdrop-filter:blur(12px);
          transition:all .3s ease;
        }
        .card:hover{
          transform:translateY(-6px);
          box-shadow:0 0 40px rgba(59,130,246,0.2);
          border-color:rgba(59,130,246,0.4);
        }

        .glow{
          position:absolute;
          width:500px;
          height:500px;
          border-radius:50%;
          filter:blur(80px);
          opacity:.25;
        }
      `}</style>

      {/* BACKGROUND GLOW */}
      <div style={{position:"fixed",inset:0,zIndex:0}}>
        <div className="glow" style={{background:"#3b82f6",top:"-10%",left:"10%"}}/>
        <div className="glow" style={{background:"#a855f7",top:"30%",right:"-10%"}}/>
        <div className="glow" style={{background:"#14b8a6",bottom:"0%",left:"-10%"}}/>
      </div>

      {/* NAV */}
      <nav style={{
        position:"sticky",
        top:0,
        zIndex:100,
        padding:"20px 40px",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        background: scrolled ? "rgba(10,14,26,0.8)" : "transparent"
      }}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center"}}>
          
          <div style={{fontWeight:800,fontSize:22,color:C.white,cursor:"pointer"}} onClick={()=>go("/")}>
            Cam<span style={{color:"#3b82f6"}}>Cash</span>
          </div>

          <div style={{marginLeft:"auto",display:"flex",gap:12}}>
            <button onClick={()=>go("/login")} style={{background:"transparent",color:C.text}}>Sign In</button>
            <button className="btn-primary" onClick={()=>go("/login")}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:"relative",zIndex:1,textAlign:"center",padding:"100px 20px"}}>
        
        <h1 style={{
          fontSize:"clamp(40px,6vw,72px)",
          fontWeight:900,
          color:C.white,
          marginBottom:20
        }}>
          Understand Your<br/>
          <span style={{
            background:"linear-gradient(135deg,#3b82f6,#ec4899)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent"
          }}>
            Cam Earnings
          </span>
        </h1>

        <p style={{maxWidth:600,margin:"0 auto 40px",fontSize:18}}>
          Upload your earnings and instantly see analytics, trends, and your biggest supporters.
        </p>

        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-primary" onClick={()=>go("/login")}>Get Started</button>
          <button style={{
            border:"1px solid rgba(59,130,246,0.3)",
            padding:"14px 32px",
            borderRadius:12,
            background:"transparent",
            color:C.text
          }}>
            View Demo
          </button>
        </div>
      </section>

      {/* CARDS */}
      <section style={{maxWidth:1100,margin:"0 auto",padding:"40px 20px"}}>
        
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
          
          <div className="card">
            <div style={{color:"#3b82f6",fontWeight:600}}>Earnings</div>
            <div style={{fontSize:32,fontWeight:800,color:C.white}}>$2,670</div>
            <div style={{color:C.muted}}>↑ 23% growth</div>
          </div>

          <div className="card">
            <div style={{color:"#a855f7",fontWeight:600}}>Top Platform</div>
            <div style={{fontSize:22,fontWeight:700,color:C.white}}>Chaturbate</div>
            <div style={{color:C.muted}}>$1,450 this month</div>
          </div>

          <div className="card">
            <div style={{color:"#ec4899",fontWeight:600}}>Fans</div>
            <div style={{fontSize:32,fontWeight:800,color:C.white}}>147</div>
            <div style={{color:C.muted}}>active tippers</div>
          </div>

        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{textAlign:"center",padding:"100px 20px"}}>
        <h2 style={{fontSize:36,fontWeight:800,color:C.white,marginBottom:20}}>
          Start Tracking Your Earnings Today
        </h2>

        <button className="btn-primary" onClick={()=>go("/login")}>
          Create Account
        </button>
      </section>

    </div>
  )
}
