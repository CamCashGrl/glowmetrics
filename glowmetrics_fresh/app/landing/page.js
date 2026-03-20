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
    <div style={{
      minHeight:"100vh",
      background:`
        radial-gradient(circle at 20% 30%, rgba(59,130,246,0.25), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(236,72,153,0.25), transparent 40%),
        radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15), transparent 60%),
        #05070f
      `,
      color:C.text,
      fontFamily:"Inter, sans-serif"
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        .btn-primary{
          background:linear-gradient(135deg,#3b82f6,#ec4899);
          border:none;
          border-radius:14px;
          padding:16px 40px;
          color:white;
          font-weight:700;
          font-size:16px;
          cursor:pointer;
          position:relative;
          overflow:hidden;
          box-shadow:
            0 0 20px rgba(59,130,246,0.5),
            0 0 40px rgba(236,72,153,0.4);
          transition:all 0.3s ease;
        }
        .btn-primary:hover{
          transform:translateY(-3px) scale(1.03);
          box-shadow:
            0 0 40px rgba(59,130,246,0.8),
            0 0 80px rgba(236,72,153,0.6);
        }

        .btn-secondary{
          border:1px solid rgba(59,130,246,0.3);
          padding:16px 40px;
          border-radius:14px;
          background:transparent;
          color:#cbd5e1;
          font-weight:600;
          font-size:16px;
          cursor:pointer;
          transition:all 0.3s ease;
        }
        .btn-secondary:hover{
          border-color:rgba(59,130,246,0.7);
          color:white;
          background:rgba(59,130,246,0.08);
        }

        .card{
          background:rgba(15,20,32,0.7);
          border-radius:20px;
          padding:28px;
          border:1px solid rgba(255,255,255,0.08);
          backdrop-filter:blur(20px);
          box-shadow:
            0 0 40px rgba(59,130,246,0.15),
            0 0 80px rgba(236,72,153,0.08);
          transition:all 0.3s ease;
        }
        .card:hover{
          transform:translateY(-6px) scale(1.02);
          box-shadow:
            0 0 60px rgba(59,130,246,0.35),
            0 0 120px rgba(236,72,153,0.2);
        }

        .glow-divider{
          height:1px;
          width:100%;
          margin:60px 0;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }

        .feature-card{
          background:rgba(15,20,32,0.7);
          border-radius:20px;
          padding:32px 28px;
          border:1px solid rgba(255,255,255,0.07);
          backdrop-filter:blur(20px);
          transition:all 0.3s ease;
        }
        .feature-card:hover{
          transform:translateY(-4px);
          border-color:rgba(59,130,246,0.3);
          box-shadow:0 0 40px rgba(59,130,246,0.15);
        }

        .nav-link{
          background:transparent;
          border:none;
          color:#94a3b8;
          font-size:15px;
          cursor:pointer;
          padding:8px 16px;
          border-radius:8px;
          transition:all 0.2s;
        }
        .nav-link:hover{color:white;}
      `}</style>

      {/* COSMIC GLOW LAYER */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        <div style={{
          position:"absolute",
          width:800,
          height:800,
          top:"-20%",
          left:"-10%",
          background:"radial-gradient(circle, rgba(59,130,246,0.35), transparent 60%)",
          filter:"blur(120px)"
        }}/>
        <div style={{
          position:"absolute",
          width:800,
          height:800,
          bottom:"-20%",
          right:"-10%",
          background:"radial-gradient(circle, rgba(236,72,153,0.35), transparent 60%)",
          filter:"blur(120px)"
        }}/>
      </div>

      {/* NAV */}
      <nav style={{
        position:"sticky",
        top:0,
        zIndex:100,
        padding:"20px 40px",
        backdropFilter:scrolled?"blur(16px)":"none",
        background:scrolled?"rgba(5,7,15,0.85)":"transparent",
        borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",
        transition:"all 0.3s ease"
      }}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center"}}>
          <div style={{fontWeight:800,fontSize:22,color:C.white,cursor:"pointer"}} onClick={()=>go("/")}>
            Cam<span style={{
              background:"linear-gradient(135deg,#60a5fa,#f472b6)",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent"
            }}>Cash</span>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
            <button className="nav-link" onClick={()=>go("/login")}>Sign In</button>
            <button className="btn-primary" style={{padding:"10px 24px",fontSize:14}} onClick={()=>go("/login")}>
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:"relative",zIndex:1,textAlign:"center",padding:"120px 20px 80px"}}>

        {/* BETA BADGE */}
        <div style={{
          display:"inline-flex",
          alignItems:"center",
          gap:8,
          padding:"6px 16px",
          borderRadius:100,
          background:"rgba(59,130,246,0.12)",
          border:"1px solid rgba(59,130,246,0.3)",
          marginBottom:32,
          fontSize:13,
          color:"#93c5fd",
          fontWeight:600
        }}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#3b82f6",display:"inline-block",boxShadow:"0 0 6px #3b82f6"}}/>
          🎉 Free for the first 100 models — 63 spots left
        </div>

        <h1 style={{
          fontSize:"clamp(42px,6vw,76px)",
          fontWeight:900,
          color:C.white,
          marginBottom:24,
          lineHeight:1.1,
          letterSpacing:"-1px"
        }}>
          Know Exactly Who<br/>
          <span style={{
            background:"linear-gradient(135deg,#60a5fa,#f472b6)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent",
          }}>
            Makes You Money
          </span>
        </h1>

        <p style={{maxWidth:580,margin:"0 auto 48px",fontSize:19,color:C.text,lineHeight:1.7}}>
          Upload your earnings CSV and instantly unlock fan intelligence, peak stream times, and personalized actions — built for cam models.
        </p>

        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-primary" onClick={()=>go("/login")}>
            Start Free — No Card Needed
          </button>
          <button className="btn-secondary" onClick={()=>go("/login")}>
            View Demo
          </button>
        </div>

        {/* SOCIAL PROOF */}
        <div style={{marginTop:48,display:"flex",gap:32,justifyContent:"center",flexWrap:"wrap"}}>
          {[
            {val:"$2.4M+", label:"Earnings tracked"},
            {val:"147+",   label:"Models using CamCash"},
            {val:"23%",    label:"Avg earnings increase"},
          ].map(({val,label})=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{
                fontSize:28,fontWeight:800,
                background:"linear-gradient(135deg,#60a5fa,#f472b6)",
                WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent"
              }}>{val}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GLOW DIVIDER */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px"}}>
        <div className="glow-divider"/>
      </div>

      {/* STATS PREVIEW CARDS */}
      <section style={{maxWidth:1100,margin:"0 auto",padding:"0 20px 80px",position:"relative",zIndex:1}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>

          <div className="card">
            <div style={{fontSize:12,fontWeight:700,color:"#60a5fa",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>💰 Total Earned</div>
            <div style={{fontSize:36,fontWeight:800,color:C.white,marginBottom:4}}>$2,670</div>
            <div style={{fontSize:13,color:"#22c55e",fontWeight:600}}>↑ 23% vs last month</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>Top 8% of models on this platform</div>
          </div>

          <div className="card">
            <div style={{fontSize:12,fontWeight:700,color:"#c084fc",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>🐳 Top Fan</div>
            <div style={{fontSize:24,fontWeight:800,color:C.white,marginBottom:4}}>babyboom17</div>
            <div style={{fontSize:13,color:C.muted}}>$840 total • hasn't tipped in 5 days</div>
            <div style={{marginTop:12}}>
              <button style={{padding:"6px 14px",borderRadius:8,background:"rgba(236,72,153,0.15)",border:"1px solid rgba(236,72,153,0.3)",color:"#f472b6",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                💌 Copy Re-engagement Message
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{fontSize:12,fontWeight:700,color:"#f472b6",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>⚡ Right Now</div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:8,lineHeight:1.4}}>Go live NOW — you earn 2.3x more at this hour</div>
            <div style={{fontSize:13,color:C.muted}}>Based on your last 90 days of data</div>
          </div>

        </div>
      </section>

      {/* GLOW DIVIDER */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px"}}>
        <div className="glow-divider"/>
      </div>

      {/* FEATURES */}
      <section style={{maxWidth:1100,margin:"0 auto",padding:"0 20px 100px",position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:60}}>
          <h2 style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:C.white,marginBottom:16}}>
            Not Just Analytics —{" "}
            <span style={{
              background:"linear-gradient(135deg,#60a5fa,#f472b6)",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent"
            }}>
              A Decision Engine
            </span>
          </h2>
          <p style={{fontSize:17,color:C.muted,maxWidth:500,margin:"0 auto"}}>
            Every feature is built to tell you exactly what to do next to make more money.
          </p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          {[
            {
              icon:"🐳",
              color:"#60a5fa",
              title:"Fan Intelligence",
              desc:"See every tipper ranked by total spend, tip frequency, and churn risk. Know who to message before they disappear."
            },
            {
              icon:"⚡",
              color:"#f472b6",
              title:"What To Do Right Now",
              desc:"Real-time panel that tells you: go live, message this fan, set this goal — all based on your actual data."
            },
            {
              icon:"📈",
              color:"#a78bfa",
              title:"Peak Time Detection",
              desc:"See exactly which hours and days earn you the most per hour. Stop guessing, start scheduling."
            },
            {
              icon:"💌",
              color:"#34d399",
              title:"Re-engagement Scripts",
              desc:"One click copies a personalized message for any fan who's gone quiet. Turn cold tippers back into active ones."
            },
            {
              icon:"🎯",
              color:"#fb923c",
              title:"Session Goals",
              desc:"CamCash sets smart goals based on your average session — so you always know if you're on track."
            },
            {
              icon:"📊",
              color:"#f59e0b",
              title:"Multi-Platform",
              desc:"Works with Chaturbate, BongaCams, MFC, CamSoda and more. Upload once, see everything in one place."
            },
          ].map(({icon,color,title,desc})=>(
            <div key={title} className="feature-card">
              <div style={{fontSize:32,marginBottom:16}}>{icon}</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>{title}</div>
              <div style={{fontSize:14,color:C.muted,lineHeight:1.7}}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GLOW DIVIDER */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px"}}>
        <div className="glow-divider"/>
      </div>

      {/* HOW IT WORKS */}
      <section style={{maxWidth:800,margin:"0 auto",padding:"0 20px 100px",position:"relative",zIndex:1,textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:800,color:C.white,marginBottom:16}}>
          Up and running in{" "}
          <span style={{
            background:"linear-gradient(135deg,#60a5fa,#f472b6)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent"
          }}>2 minutes</span>
        </h2>
        <p style={{fontSize:16,color:C.muted,marginBottom:60}}>No integrations, no tech setup. Just copy, paste, upload.</p>

        <div style={{display:"flex",flexDirection:"column",gap:16,textAlign:"left"}}>
          {[
            {num:"01",color:"#60a5fa", title:"Go to your cam platform",    desc:"Navigate to your earnings or tip history page on any platform."},
            {num:"02",color:"#a78bfa", title:"Copy & paste into Google Sheets", desc:"Select your data, copy it, paste into a new Google Sheet at sheets.new."},
            {num:"03",color:"#f472b6", title:"Download as CSV",             desc:'Click File → Download → "Comma Separated Values" to save the file.'},
            {num:"04",color:"#34d399", title:"Upload & get your insights",  desc:"Drop the CSV into CamCash and your full dashboard appears instantly."},
          ].map(({num,color,title,desc})=>(
            <div key={num} style={{
              display:"flex",gap:20,alignItems:"flex-start",
              padding:"20px 24px",
              background:"rgba(15,20,32,0.7)",
              border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:16,
              backdropFilter:"blur(20px)"
            }}>
              <div style={{fontSize:13,fontWeight:800,color,minWidth:28,paddingTop:2}}>{num}</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:4}}>{title}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GLOW DIVIDER */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px"}}>
        <div className="glow-divider"/>
      </div>

      {/* FINAL CTA */}
      <section style={{textAlign:"center",padding:"100px 20px 120px",position:"relative",zIndex:1}}>
        <div style={{
          display:"inline-block",
          padding:"6px 16px",
          borderRadius:100,
          background:"rgba(236,72,153,0.12)",
          border:"1px solid rgba(236,72,153,0.3)",
          fontSize:13,
          color:"#f9a8d4",
          fontWeight:600,
          marginBottom:28
        }}>
          🔥 63 of 100 free spots taken
        </div>

        <h2 style={{fontSize:"clamp(30px,5vw,56px)",fontWeight:900,color:C.white,marginBottom:20,lineHeight:1.15}}>
          Start Making Smarter<br/>
          <span style={{
            background:"linear-gradient(135deg,#60a5fa,#f472b6)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent"
          }}>
            Money Decisions
          </span>
        </h2>

        <p style={{fontSize:17,color:C.muted,marginBottom:40,maxWidth:480,margin:"0 auto 40px"}}>
          Free during beta. All features unlocked. No credit card required.
        </p>

        <button className="btn-primary" style={{fontSize:18,padding:"18px 52px"}} onClick={()=>go("/login")}>
          Create Free Account →
        </button>

        <div style={{marginTop:20,fontSize:13,color:C.muted}}>
          Takes 2 minutes • No setup required • Cancel anytime
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop:"1px solid rgba(255,255,255,0.06)",
        padding:"32px 40px",
        position:"relative",
        zIndex:1,
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center",
        flexWrap:"wrap",
        gap:16,
        maxWidth:1200,
        margin:"0 auto"
      }}>
        <div style={{fontWeight:700,fontSize:16,color:C.white}}>
          Cam<span style={{
            background:"linear-gradient(135deg,#60a5fa,#f472b6)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent"
          }}>Cash</span>
        </div>
        <div style={{fontSize:13,color:C.muted}}>© 2025 CamCash. Built for models, by someone who gets it.</div>
        <div style={{display:"flex",gap:20}}>
          <button className="nav-link" style={{fontSize:13}} onClick={()=>go("/login")}>Sign In</button>
          <button className="nav-link" style={{fontSize:13}} onClick={()=>go("/login")}>Sign Up</button>
        </div>
      </footer>

    </div>
  )
}
