"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#0a0e1a",bg1:"#0f1420",bg2:"#151b2e",bg3:"#1a2139",
  border:"#1e2842",border2:"#2a3654",
  blue:"#3b82f6",blue2:"#60a5fa",blue3:"#93c5fd",
  purple:"#a855f7",purple2:"#c084fc",purple3:"#e9d5ff",
  teal:"#14b8a6",teal2:"#2dd4bf",
  pink:"#ec4899",pink2:"#f472b6",
  white:"#f8fafc",text:"#cbd5e1",muted:"#64748b",
}

const DEMO_EARNINGS=[
  {month:"Sep",usd:312},{month:"Oct",usd:445},{month:"Nov",usd:389},
  {month:"Dec",usd:512},{month:"Jan",usd:478},{month:"Feb",usd:634},
]

const DEMO_FANS=[
  {rank:1,name:"StarGazer99",total:"$1,245"},
  {rank:2,name:"NightOwl",total:"$892"},
  {rank:3,name:"CryptoKing",total:"$651"},
  {rank:4,name:"LoyalFan88",total:"$524"},
  {rank:5,name:"TipMaster",total:"$387"},
]

function SimpleBar({data,valueKey,labelKey,color,height=120}){
  const max=Math.max(...data.map(d=>d[valueKey]))
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height,padding:"0 4px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{fontSize:9,color:C.muted}}>${d[valueKey]}</div>
          <div style={{width:"100%",borderRadius:"4px 4px 0 0",height:`${(d[valueKey]/max)*100}%`,background:`linear-gradient(180deg,${color},${color}88)`,minHeight:4,boxShadow:`0 0 12px ${color}40`}}/>
          <div style={{fontSize:9,color:C.muted,whiteSpace:"nowrap"}}>{d[labelKey]}</div>
        </div>
      ))}
    </div>
  )
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
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Plus Jakarta Sans',sans-serif",color:C.text,overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;font-family:inherit}
        a{text-decoration:none}
        .btn-primary{
          background:linear-gradient(135deg,#3b82f6,#8b5cf6);
          border:none;
          border-radius:12px;
          padding:14px 32px;
          color:#fff;
          font-weight:700;
          font-size:15px;
          transition:all 0.3s;
          box-shadow:0 0 20px rgba(59,130,246,0.3),0 4px 12px rgba(0,0,0,0.2);
          position:relative;
          overflow:hidden;
        }
        .btn-primary:hover{
          transform:translateY(-2px);
          box-shadow:0 0 30px rgba(59,130,246,0.5),0 8px 20px rgba(0,0,0,0.3);
        }
        .btn-primary::before{
          content:'';
          position:absolute;
          top:0;
          left:-100%;
          width:100%;
          height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);
          transition:left 0.5s;
        }
        .btn-primary:hover::before{
          left:100%;
        }
        .btn-outline{
          background:transparent;
          border:2px solid rgba(59,130,246,0.3);
          border-radius:12px;
          padding:12px 30px;
          color:#cbd5e1;
          font-weight:600;
          font-size:15px;
          transition:all 0.3s;
        }
        .btn-outline:hover{
          border-color:rgba(59,130,246,0.6);
          background:rgba(59,130,246,0.1);
          box-shadow:0 0 20px rgba(59,130,246,0.2);
        }
        .neon-border{
          border:1px solid rgba(59,130,246,0.2);
          box-shadow:0 0 15px rgba(59,130,246,0.1);
        }
        .neon-border:hover{
          border-color:rgba(59,130,246,0.4);
          box-shadow:0 0 25px rgba(59,130,246,0.2);
        }
      `}</style>

      {/* Ambient background glow */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        <div style={{position:"absolute",top:"-20%",left:"10%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.15),transparent 70%)",filter:"blur(60px)"}}/>
        <div style={{position:"absolute",top:"30%",right:"-10%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%)",filter:"blur(60px)"}}/>
        <div style={{position:"absolute",bottom:"10%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,0.1),transparent 70%)",filter:"blur(60px)"}}/>
      </div>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:scrolled?"rgba(10,14,26,0.95)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?`1px solid ${C.border}`:"none",transition:"all 0.3s",padding:"0 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:72,gap:32}}>
          <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>go("/")}>
            {/* Neon Camera Icon */}
            <svg width="40" height="40" viewBox="0 0 40 40" style={{filter:"drop-shadow(0 0 8px rgba(59,130,246,0.6))"}}>
              <defs>
                <linearGradient id="cameraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor:"#14b8a6"}}/>
                  <stop offset="50%" style={{stopColor:"#3b82f6"}}/>
                  <stop offset="100%" style={{stopColor:"#a855f7"}}/>
                </linearGradient>
              </defs>
              {/* Camera body */}
              <rect x="6" y="12" width="28" height="20" rx="3" fill="none" stroke="url(#cameraGrad)" strokeWidth="2.5"/>
              {/* Lens circle */}
              <circle cx="20" cy="22" r="6" fill="none" stroke="url(#cameraGrad)" strokeWidth="2.5"/>
              {/* Dollar sign */}
              <text x="20" y="26" fontSize="10" fontWeight="bold" fill="url(#cameraGrad)" textAnchor="middle">$</text>
              {/* Viewfinder */}
              <rect x="12" y="8" width="6" height="4" rx="1" fill="url(#cameraGrad)"/>
            </svg>
            <span style={{fontSize:24,fontWeight:800,letterSpacing:"-0.01em"}}>
              <span style={{background:"linear-gradient(135deg,#14b8a6,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cam</span>
              <span style={{background:"linear-gradient(135deg,#a855f7,#ec4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cash</span>
            </span>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <button className="btn-outline" style={{padding:"10px 24px",fontSize:14}} onClick={()=>go("/login")}>Sign In</button>
            <button className="btn-primary" style={{padding:"10px 24px",fontSize:14}} onClick={()=>go("/login")}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* 1. HERO */}
      <section style={{position:"relative",zIndex:1,maxWidth:1100,margin:"0 auto",padding:"80px 40px 60px",textAlign:"center"}}>
        <h1 style={{fontSize:"clamp(36px,5vw,64px)",fontWeight:800,color:C.white,lineHeight:1.15,letterSpacing:"-0.02em",marginBottom:24}}>
          Understand Your<br/>Cam Earnings
        </h1>
        <p style={{fontSize:"clamp(18px,2.5vw,22px)",color:C.blue2,maxWidth:700,margin:"0 auto 16px",lineHeight:1.6,fontWeight:500}}>
          I built CamCash to analyze my cam earnings across platforms and identify my top spending fans.
        </p>
        <p style={{fontSize:"clamp(15px,2vw,17px)",color:C.text,maxWidth:650,margin:"0 auto 40px",lineHeight:1.7}}>
          Upload your platform earnings data and instantly see analytics, trends, and your biggest supporters.
        </p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:16}}>
          <button className="btn-primary" style={{fontSize:16,padding:"16px 40px"}} onClick={()=>go("/login")}>Sign Up</button>
          <button className="btn-outline" style={{fontSize:16,padding:"14px 38px"}} onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}>View Demo</button>
        </div>
        <p style={{fontSize:13,color:C.muted}}>Free plan available after signup.</p>
      </section>

      {/* 2. PRODUCT DEMO */}
      <section id="demo" style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"60px 40px"}}>
        <div style={{textAlign:"center",marginBottom:50}}>
          <h2 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:800,color:C.white,letterSpacing:"-0.02em",marginBottom:16}}>See Your Earnings Clearly</h2>
          <p style={{fontSize:17,color:C.text,maxWidth:600,margin:"0 auto",lineHeight:1.7}}>CamCash turns raw cam platform data into clear analytics so you can understand exactly where your money comes from.</p>
        </div>

        {/* Demo cards grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20,marginBottom:40}}>
          {/* Earnings Overview */}
          <div className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,padding:28,transition:"all 0.3s"}}>
            <div style={{fontSize:13,color:C.blue2,fontWeight:600,marginBottom:16,textTransform:"uppercase",letterSpacing:"0.05em"}}>Earnings Overview</div>
            <div style={{fontSize:36,fontWeight:800,color:C.white,marginBottom:8}}>$2,670</div>
            <div style={{fontSize:14,color:C.teal2}}>↑ 23% from last month</div>
          </div>

          {/* Top Platform */}
          <div className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,padding:28,transition:"all 0.3s"}}>
            <div style={{fontSize:13,color:C.purple2,fontWeight:600,marginBottom:16,textTransform:"uppercase",letterSpacing:"0.05em"}}>Top Platform</div>
            <div style={{fontSize:24,fontWeight:700,color:C.white,marginBottom:8}}>Chaturbate</div>
            <div style={{fontSize:14,color:C.text}}>$1,450 this month</div>
          </div>

          {/* Total Fans */}
          <div className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,padding:28,transition:"all 0.3s"}}>
            <div style={{fontSize:13,color:C.pink2,fontWeight:600,marginBottom:16,textTransform:"uppercase",letterSpacing:"0.05em"}}>Active Fans</div>
            <div style={{fontSize:36,fontWeight:800,color:C.white,marginBottom:8}}>147</div>
            <div style={{fontSize:14,color:C.text}}>tipped this month</div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,padding:32,marginBottom:40}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:24}}>Monthly Revenue</div>
          <SimpleBar data={DEMO_EARNINGS} valueKey="usd" labelKey="month" color={C.blue} height={180}/>
        </div>

        {/* Top Fans Leaderboard */}
        <div className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,overflow:"hidden"}}>
          <div style={{padding:"20px 28px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.white}}>Top 5 Fans</div>
            <div style={{padding:"4px 12px",borderRadius:100,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",color:C.blue2,fontSize:11,fontWeight:600}}>LIVE DATA</div>
          </div>
          <div style={{padding:"0 28px"}}>
            {DEMO_FANS.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.muted,width:28}}>#{f.rank}</div>
                <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.white,boxShadow:`0 0 15px ${C.blue}40`}}>{f.name[0]}</div>
                <div style={{flex:1,fontSize:15,fontWeight:600,color:C.white}}>{f.name}</div>
                <div style={{fontSize:17,fontWeight:700,color:C.teal2,fontFamily:"monospace"}}>{f.total}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section style={{position:"relative",zIndex:1,maxWidth:1000,margin:"0 auto",padding:"60px 40px"}}>
        <div style={{textAlign:"center",marginBottom:50}}>
          <h2 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:800,color:C.white,letterSpacing:"-0.02em",marginBottom:16}}>Start Tracking in 3 Steps</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:28}}>
          {[
            {num:"1",title:"Export Your Data",desc:"Download your earnings CSV from your cam platform dashboard.",icon:"📥",color:C.blue},
            {num:"2",title:"Upload to CamCash",desc:"Drag and drop your CSV file. We'll auto-detect your platform.",icon:"⚡",color:C.purple},
            {num:"3",title:"See Analytics",desc:"Instantly view earnings trends, top fans, and platform comparisons.",icon:"📊",color:C.teal},
          ].map((s,i)=>(
            <div key={i} className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:20,padding:32,position:"relative",transition:"all 0.3s"}}>
              <div style={{position:"absolute",top:-18,left:28,width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${s.color},${s.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:C.white,boxShadow:`0 0 25px ${s.color}60`}}>{s.num}</div>
              <div style={{fontSize:40,marginBottom:16,marginTop:12}}>{s.icon}</div>
              <div style={{fontSize:19,fontWeight:700,color:C.white,marginBottom:10}}>{s.title}</div>
              <div style={{fontSize:14,color:C.text,lineHeight:1.6}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURES */}
      <section style={{position:"relative",zIndex:1,maxWidth:1100,margin:"0 auto",padding:"60px 40px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20}}>
          {[
            {icon:"👑",title:"Fan Leaderboard",desc:"See your top 15 fans ranked by spending.",color:C.pink},
            {icon:"💰",title:"Revenue Analytics",desc:"Understand which platforms generate the most income.",color:C.blue},
            {icon:"🔗",title:"Multi-Platform",desc:"Combine data from multiple cam sites.",color:C.purple},
            {icon:"📤",title:"CSV Upload",desc:"Quickly import earnings exports.",color:C.teal},
          ].map((f,i)=>(
            <div key={i} className="neon-border" style={{background:"rgba(15,20,32,0.6)",borderRadius:18,padding:26,transition:"all 0.3s"}}>
              <div style={{fontSize:36,marginBottom:14}}>{f.icon}</div>
              <div style={{fontSize:17,fontWeight:700,color:C.white,marginBottom:8}}>{f.title}</div>
              <div style={{fontSize:14,color:C.text,lineHeight:1.6}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FINAL CTA */}
      <section style={{position:"relative",zIndex:1,maxWidth:900,margin:"0 auto",padding:"60px 40px 80px"}}>
        <div style={{background:"rgba(15,20,32,0.8)",border:"2px solid rgba(59,130,246,0.3)",borderRadius:28,padding:"60px 40px",textAlign:"center",boxShadow:"0 0 40px rgba(59,130,246,0.2)"}}>
          <h2 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:800,color:C.white,marginBottom:20}}>Try CamCash With Your Data</h2>
          <p style={{fontSize:17,color:C.text,maxWidth:500,margin:"0 auto 32px",lineHeight:1.7}}>Upload your earnings and see insights in seconds. No credit card required.</p>
          <button className="btn-primary" style={{fontSize:17,padding:"16px 48px"}} onClick={()=>go("/login")}>Create Account</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${C.border}`,padding:"40px 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20}}>
            {/* Neon Camera Icon */}
            <svg width="36" height="36" viewBox="0 0 40 40" style={{filter:"drop-shadow(0 0 8px rgba(59,130,246,0.6))"}}>
              <defs>
                <linearGradient id="cameraGradFooter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor:"#14b8a6"}}/>
                  <stop offset="50%" style={{stopColor:"#3b82f6"}}/>
                  <stop offset="100%" style={{stopColor:"#a855f7"}}/>
                </linearGradient>
              </defs>
              <rect x="6" y="12" width="28" height="20" rx="3" fill="none" stroke="url(#cameraGradFooter)" strokeWidth="2.5"/>
              <circle cx="20" cy="22" r="6" fill="none" stroke="url(#cameraGradFooter)" strokeWidth="2.5"/>
              <text x="20" y="26" fontSize="10" fontWeight="bold" fill="url(#cameraGradFooter)" textAnchor="middle">$</text>
              <rect x="12" y="8" width="6" height="4" rx="1" fill="url(#cameraGradFooter)"/>
            </svg>
            <span style={{fontSize:20,fontWeight:800}}>
              <span style={{background:"linear-gradient(135deg,#14b8a6,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cam</span>
              <span style={{background:"linear-gradient(135deg,#a855f7,#ec4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cash</span>
            </span>
          </div>
          <p style={{color:C.muted,fontSize:14,marginBottom:16}}>Analytics for cam creators · Built by a creator</p>
          <div style={{fontSize:12,color:C.muted,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
            <a href="mailto:daphneoncam@gmail.com" style={{color:C.blue2}}>daphneoncam@gmail.com</a>
            <span style={{margin:"0 12px"}}>·</span>
            <span>© 2025 CamCash</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
