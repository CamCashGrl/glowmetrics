"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#0F172A",bg1:"#131d35",bg2:"#172040",bg3:"#1e2a4a",
  border:"#2d3d6b",border2:"#3d52a0",
  indigo:"#6366F1",indigo2:"#818CF8",indigo3:"#A5B4FC",
  violet:"#7C3AED",cyan:"#22D3EE",teal:"#2DD4BF",
  gold:"#F59E0B",green:"#10B981",pink:"#EC4899",
  white:"#F8FAFC",text:"#CBD5E1",muted:"#64748B",dim:"#334155",
}

const DEMO_EARNINGS=[
  {month:"Sep",usd:312},{month:"Oct",usd:445},{month:"Nov",usd:389},
  {month:"Dec",usd:512},{month:"Jan",usd:478},{month:"Feb",usd:634},
]
const DEMO_FANS=[
  {rank:1,name:"StarGazer99",tokens:12450,usd:"$311.25",platform:"Chaturbate",badge:"🐳 WHALE"},
  {rank:2,name:"NightOwlX",tokens:8920,usd:"$223.00",platform:"BongaCams",badge:"🐳 WHALE"},
  {rank:3,name:"CryptoKing42",tokens:5670,usd:"$141.75",platform:"Chaturbate",badge:"🦈 SHARK"},
  {rank:4,name:"LoyalFan88",tokens:3240,usd:"$81.00",platform:"MyFreeCams",badge:"🦈 SHARK"},
  {rank:5,name:"TipMaster",tokens:2100,usd:"$52.50",platform:"Stripchat",badge:"🐟 REGULAR"},
]
const DEMO_SHOWS=[
  {type:"Wheel Show",avg:145,tips:34,color:C.indigo},
  {type:"Goal Stream",avg:112,tips:28,color:C.cyan},
  {type:"Tip Menu",avg:89,tips:22,color:C.teal},
  {type:"Interactive",avg:167,tips:41,color:C.violet},
  {type:"Private Heavy",avg:203,tips:18,color:C.pink},
]
const DEMO_HOURS=[
  {h:"6PM",usd:12},{h:"7PM",usd:28},{h:"8PM",usd:67},
  {h:"9PM",usd:145},{h:"10PM",usd:189},{h:"11PM",usd:167},
  {h:"12AM",usd:98},{h:"1AM",usd:54},{h:"2AM",usd:31},
]
const FEATURES=[
  {icon:"👑",title:"Fan Leaderboard",tag:"Your biggest supporters",desc:"See your top 15 fans ranked by total spending so you always know who shows up for you the most.",accent:C.pink},
  {icon:"📈",title:"Revenue Analytics",tag:"Know where money comes from",desc:"Understand which platforms, nights, and time slots generate the most income across your cam work.",accent:C.indigo},
  {icon:"🪄",title:"Multi-Platform Tracking",tag:"All your sites together",desc:"Combine earnings from multiple cam sites into one simple view instead of guessing from separate dashboards.",accent:C.teal},
  {icon:"📥",title:"CSV Upload",tag:"Fast to get started",desc:"Export a CSV from your cam platform, upload to CamCash, and see your trends and top fans in minutes.",accent:C.cyan},
]
const TESTIMONIALS=[
  {quote:"Finally I can see which nights are actually worth streaming. My Thursday 9PM slot earns 3x more than Sunday — I never would have known without this.",name:"Ashley M.",platform:"Chaturbate · 2 yrs"},
  {quote:"The fan CRM is everything. I used to forget which guys tipped big last month. Now I have notes on all my top 50 fans and they feel so special when I remember them.",name:"Luna K.",platform:"BongaCams · 3 yrs"},
  {quote:"I imported 18 months of data and in 10 minutes knew more about my business than I did in 18 months of guessing. Worth every penny.",name:"Jade R.",platform:"Multi-platform · 4 yrs"},
]
const FAQS=[
  {q:"Is my data private?",a:"100%. We use row-level security — only you can see your data. We never share, sell, or analyze your personal information."},
  {q:"Which platforms do you support?",a:"Chaturbate, BongaCams, MyFreeCams, Stripchat, CamSoda, Cherry.tv, Streamate, ImLive, Flirt4Free, and LiveJasmin."},
  {q:"How do I import my data?",a:"Download your CSV from your cam platform dashboard, then drag and drop it into CamCash. We auto-detect the platform and import everything instantly."},
  {q:"Who built this?",a:"CamCash was built by a cam model, for cam models. I originally built it to understand my own earnings across platforms."},
]

function SimpleBar({data,valueKey,labelKey,color,height=120}){
  const max=Math.max(...data.map(d=>d[valueKey]))
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height,padding:"0 4px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{fontSize:9,color:C.muted}}>${d[valueKey]}</div>
          <div style={{width:"100%",borderRadius:"4px 4px 0 0",height:`${(d[valueKey]/max)*100}%`,background:`linear-gradient(180deg,${color},${color}88)`,minHeight:4}}/>
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
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans','Inter',sans-serif",color:C.text,overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;font-family:inherit}
        a{text-decoration:none}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .btn-primary{background:linear-gradient(135deg,#6366F1,#7C3AED);border:none;borderRadius:12px;padding:14px 28px;color:#F8FAFC;font-weight:700;font-size:15px;transition:all 0.2s;box-shadow:0 4px 24px #6366F140}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px #6366F160}
        .btn-outline{background:transparent;border:1px solid #2d3d6b;border-radius:12px;padding:14px 28px;color:#CBD5E1;font-weight:600;font-size:15px;transition:all 0.2s}
        .btn-outline:hover{border-color:#6366F1;color:#F8FAFC}
      `}</style>

      {/* Orbs */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        <div style={{position:"absolute",top:"-10%",left:"15%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,#6366F122,transparent 70%)",animation:"float 30s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"40%",right:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,#7C3AED18,transparent 70%)",animation:"float 25s ease-in-out infinite reverse"}}/>
        <div style={{position:"absolute",bottom:"10%",left:"5%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#22D3EE14,transparent 70%)",animation:"float 35s ease-in-out infinite"}}/>
      </div>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:scrolled?"rgba(12,16,32,0.96)":"transparent",backdropFilter:scrolled?"blur(22px)":"none",borderBottom:scrolled?`1px solid ${C.border}`:"none",transition:"all 0.3s",padding:"0 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:68,gap:32}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("/landing")}>
            <div style={{position:"relative",width:38,height:38,borderRadius:12,background:"radial-gradient(circle at 20% 0%,#22D3EE,#6366F1 45%,#EC4899 80%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px #22D3EE55"}}>
              <div style={{width:22,height:16,borderRadius:5,border:"2px solid #0B1220",background:"rgba(15,23,42,0.9)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:11,color:"#22D3EE",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>$</span>
                <div style={{position:"absolute",top:-5,left:4,width:9,height:5,borderRadius:2,background:"#0B1220",border:"2px solid #0B1220"}}/>
              </div>
            </div>
            <span style={{fontSize:20,fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>
              Cam<span style={{background:"linear-gradient(90deg,#22D3EE,#A855F7,#F973AB)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cash</span>
            </span>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="btn-outline" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Sign in</button>
            <button className="btn-primary" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"96px 40px 72px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${C.indigo}20`,border:`1px solid ${C.indigo}50`,borderRadius:999,padding:"7px 16px",marginBottom:24,fontSize:12,color:C.indigo2,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:C.cyan,boxShadow:`0 0 12px ${C.cyan}`,display:"inline-block",animation:"pulse 2s infinite"}}/>
          Built by a cam model to understand earnings
        </div>
        <h1 style={{fontSize:"clamp(36px,5.5vw,64px)",fontWeight:800,color:C.white,lineHeight:1.05,letterSpacing:"-0.04em",marginBottom:18,fontFamily:"'Outfit',sans-serif"}}>
          Understand Your Cam Earnings
        </h1>
        <p style={{fontSize:"clamp(16px,2vw,20px)",color:C.text,maxWidth:640,margin:"0 auto 12px",lineHeight:1.7}}>
          I built CamCash to analyze my cam earnings across platforms and identify my top spending fans.
        </p>
        <p style={{fontSize:15,color:C.muted,maxWidth:520,margin:"0 auto 32px",lineHeight:1.6}}>
          Upload your platform earnings data and instantly see analytics, trends, and your biggest supporters in one simple, private dashboard.
        </p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
          <button
            className="btn-primary"
            style={{fontSize:16,padding:"16px 32px",boxShadow:"0 0 28px #22D3EE55,0 18px 45px #0B112040"}}
            onClick={()=>go("/login")}
          >
            Sign Up and Start Here
          </button>
          <button
            className="btn-outline"
            style={{fontSize:16,padding:"16px 32px",borderColor:"#38bdf8",color:C.white,background:"linear-gradient(135deg,rgba(56,189,248,0.04),rgba(236,72,153,0.04))"}}
            onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}
          >
            View Demo
          </button>
        </div>
      </section>

      {/* PRODUCT DEMO */}
      <section id="demo" style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"20px 40px 64px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:12,color:C.indigo2,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>
            Product demo
          </div>
          <h2 style={{fontSize:"clamp(26px,3.4vw,40px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:14}}>
            See Your Earnings Clearly
          </h2>
          <p style={{fontSize:16,color:C.text,maxWidth:560,margin:"0 auto",lineHeight:1.7}}>
            CamCash turns raw cam platform data into simple analytics so you can understand exactly where your money comes from.
          </p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(0,1fr)",gap:24,alignItems:"stretch",flexWrap:"wrap"}}>
          {/* Left: charts */}
          <div style={{background:"radial-gradient(circle at 0% 0%,#22D3EE11,transparent 55%)",borderRadius:24,padding:22,border:`1px solid ${C.border}`}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:18}}>
              <div style={{background:C.bg2,borderRadius:16,padding:16,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Earnings this month</div>
                <div style={{fontSize:24,color:C.cyan,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>$3,214</div>
                <div style={{fontSize:11,color:C.green,marginTop:6}}>+18% vs last month</div>
              </div>
              <div style={{background:C.bg2,borderRadius:16,padding:16,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Top fan this month</div>
                <div style={{fontSize:15,color:C.white,fontWeight:600}}>StarGazer99</div>
                <div style={{fontSize:11,color:C.pink,marginTop:6}}>Whale · $311.25</div>
              </div>
            </div>

            <div style={{background:C.bg2,borderRadius:18,padding:18,border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:12,color:C.muted}}>Monthly earnings</div>
                <div style={{display:"flex",gap:6,fontSize:11,color:C.dim}}>
                  <span style={{padding:"3px 8px",borderRadius:999,background:`${C.indigo}25`,color:C.indigo2}}>USD</span>
                  <span style={{padding:"3px 8px",borderRadius:999,background:`${C.bg3}`,border:`1px solid ${C.border}`}}>Tokens</span>
                </div>
              </div>
              <SimpleBar data={DEMO_EARNINGS} valueKey="usd" labelKey="month" color={C.cyan} height={130}/>
            </div>
          </div>

          {/* Right: cards list */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.bg2,borderRadius:18,padding:18,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.white,fontWeight:600,marginBottom:6}}>Earnings overview cards</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>
                Snapshot cards show lifetime earnings, average tip size, unique fans, and your strongest months at a glance.
              </div>
            </div>
            <div style={{background:C.bg2,borderRadius:18,padding:18,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.white,fontWeight:600,marginBottom:6}}>Revenue charts</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>
                See clean charts of how your income changes over time so you can spot trends without digging through CSVs.
              </div>
            </div>
            <div style={{background:C.bg2,borderRadius:18,padding:18,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.white,fontWeight:600,marginBottom:6}}>Top fans leaderboard</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>
                A simple leaderboard ranks your top supporters by total spend so you always know who to take extra care of.
              </div>
            </div>
            <div style={{background:C.bg2,borderRadius:18,padding:18,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.white,fontWeight:600,marginBottom:6}}>Platform comparisons</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>
                Compare how much you earn on each platform so you can decide where to focus your time.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"40px 40px 64px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <h2 style={{fontSize:"clamp(24px,3vw,34px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:10}}>
            Start Tracking in 3 Steps
          </h2>
          <p style={{fontSize:15,color:C.text,maxWidth:520,margin:"0 auto",lineHeight:1.7}}>
            No complicated setup, no tech skills needed — just export, upload, and see your analytics.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:18}}>
          {[
            {step:"Step 1",title:"Export your data",desc:"Export your earnings CSV from your cam platform dashboard."},
            {step:"Step 2",title:"Upload to CamCash",desc:"Drop the CSV into CamCash — we handle the parsing for you."},
            {step:"Step 3",title:"See your analytics",desc:"Instantly see your earnings, trends, and top fans in one place."},
          ].map((s,i)=>(
            <div key={s.step} style={{background:C.bg2,borderRadius:20,padding:20,border:`1px solid ${C.border}`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at ${i===0?"0% 0%":i===1?"50% 0%":"100% 0%"},${C.cyan}10,transparent 60%)`,pointerEvents:"none"}}/>
              <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>{s.step}</div>
              <div style={{fontSize:17,color:C.white,fontWeight:600,marginBottom:6}}>{s.title}</div>
              <div style={{fontSize:14,color:C.text,lineHeight:1.6}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"16px 40px 64px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <h2 style={{fontSize:"clamp(24px,3vw,34px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:10}}>
            Features made for cam models
          </h2>
          <p style={{fontSize:15,color:C.text,maxWidth:520,margin:"0 auto",lineHeight:1.7}}>
            CamCash focuses on the handful of analytics that actually help you make clearer decisions about your work.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:18}}>
          {FEATURES.map((f)=>(
            <div key={f.title} style={{background:C.bg2,borderRadius:20,padding:20,border:`1px solid ${C.border}`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 0 0,${f.accent}18,transparent 55%)`,pointerEvents:"none"}}/>
              <div style={{width:32,height:32,borderRadius:999,background:`${f.accent}26`,border:`1px solid ${f.accent}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:10,boxShadow:`0 0 16px ${f.accent}50`}}>
                {f.icon}
              </div>
              <div style={{fontSize:14,color:f.accent,fontWeight:600,marginBottom:4}}>{f.tag}</div>
              <div style={{fontSize:17,color:C.white,fontWeight:600,marginBottom:6}}>{f.title}</div>
              <div style={{fontSize:14,color:C.text,lineHeight:1.6}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"8px 40px 72px"}}>
        <div style={{background:"radial-gradient(circle at 0 0,#22D3EE1a,transparent 60%)",borderRadius:28,border:`1px solid ${C.border2||C.border}`,padding:"32px 22px",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 100% 0%,rgba(236,72,153,0.25),transparent 55%)",pointerEvents:"none"}}/>
          <div style={{maxWidth:640,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
            <h2 style={{fontSize:"clamp(24px,3vw,34px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:10}}>
              Try CamCash With Your Data
            </h2>
            <p style={{fontSize:15,color:C.text,maxWidth:520,margin:"0 auto 22px",lineHeight:1.7}}>
              Create an account, upload a CSV from your cam platform, and see your earnings laid out in a way that finally makes sense.
            </p>
            <button
              className="btn-primary"
              style={{fontSize:16,padding:"15px 30px",boxShadow:"0 0 28px #22D3EE66"}}
              onClick={()=>go("/login")}
            >
              Create Account
            </button>
          </div>
        </div>
      </section>
      
      {/* FOOTER */}
      <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${C.border}`,padding:"40px 40px 32px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{position:"relative",width:32,height:32,borderRadius:10,background:"radial-gradient(circle at 20% 0%,#22D3EE,#6366F1 45%,#EC4899 80%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px #22D3EE55"}}>
                <div style={{width:19,height:14,borderRadius:4,border:"2px solid #020617",background:"rgba(15,23,42,0.95)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"#22D3EE",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>$</span>
                  <div style={{position:"absolute",top:-4,left:4,width:8,height:4,borderRadius:2,background:"#020617",border:"2px solid #020617"}}/>
                </div>
              </div>
              <span style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif"}}>
                Cam<span style={{background:"linear-gradient(90deg,#22D3EE,#A855F7,#F973AB)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cash</span>
              </span>
            </div>
            <p style={{color:C.muted,fontSize:14,lineHeight:1.7,maxWidth:260}}>
              A simple earnings analytics tool built to help cam models understand their income and their biggest supporters.
            </p>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Product</div>
            {["Features","Demo","FAQ"].map(l=>(
              <div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Support</div>
            <a href="mailto:daphneoncam@gmail.com" style={{color:C.muted,fontSize:14,display:"block",marginBottom:10}}>daphneoncam@gmail.com</a>
            <div style={{color:C.muted,fontSize:14}}>Privacy Policy</div>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Account</div>
            {["Create account","Sign in","Dashboard"].map(l=>(
              <div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}} onClick={()=>go("/login")}>{l}</div>
            ))}
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"24px auto 0",paddingTop:18,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{fontSize:12,color:C.muted}}>© 2025 CamCash · Built for cam models, by a cam model</div>
          <div style={{fontSize:12,color:C.muted}}>Questions? <a href="mailto:daphneoncam@gmail.com" style={{color:C.indigo3}}>daphneoncam@gmail.com</a></div>
        </div>
      </footer>
    </div>
  )
}
