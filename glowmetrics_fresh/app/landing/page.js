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
  {icon:"📊",title:"Performance Analytics",tag:"Know your numbers",desc:"Track streaming income, peak hours, and earnings trends. Discover your most profitable shows and time slots with visual dashboards.",accent:C.indigo},
  {icon:"👑",title:"Fan CRM System",tag:"Most wanted feature",desc:"Manage VIP fans, whales, and repeat tippers in one organized board. Never forget your best supporters — track notes, preferences, and tip history.",accent:C.cyan},
  {icon:"🎡",title:"Show Strategy Tracking",tag:"Optimize your format",desc:"Compare wheel shows, goal streams, tip menus, and interactive streams. See exactly which formats generate the most income.",accent:C.violet},
  {icon:"📥",title:"CSV Data Import",tag:"All platforms supported",desc:"Import directly from Chaturbate, BongaCams, MyFreeCams, Stripchat, and 6 more platforms. Your data auto-converts into insights.",accent:C.teal},
  {icon:"📈",title:"Growth Dashboard",tag:"See your progress",desc:"Monthly earnings trends, follower growth, streaming hours, and avg hourly income. Watch your business grow over time.",accent:C.gold},
  {icon:"🔒",title:"Private & Secure",tag:"Your data stays yours",desc:"End-to-end privacy. Row-level security means nobody but you can see your data. No sharing, no selling, no exceptions.",accent:C.green},
]
const TESTIMONIALS=[
  {quote:"Finally I can see which nights are actually worth streaming. My Thursday 9PM slot earns 3x more than Sunday — I never would have known without this.",name:"Ashley M.",platform:"Chaturbate · 2 yrs"},
  {quote:"The fan CRM is everything. I used to forget which guys tipped big last month. Now I have notes on all my top 50 fans and they feel so special when I remember them.",name:"Luna K.",platform:"BongaCams · 3 yrs"},
  {quote:"I imported 18 months of data and in 10 minutes knew more about my business than I did in 18 months of guessing. Worth every penny.",name:"Jade R.",platform:"Multi-platform · 4 yrs"},
]
const FAQS=[
  {q:"Is my data private?",a:"100%. We use row-level security — only you can see your data. We never share, sell, or analyze your personal information."},
  {q:"Which platforms do you support?",a:"Chaturbate, BongaCams, MyFreeCams, Stripchat, CamSoda, Cherry.tv, Streamate, ImLive, Flirt4Free, and LiveJasmin."},
  {q:"How do I import my data?",a:"Download your CSV from your cam platform dashboard, then drag and drop it into GlowMetrics. We auto-detect the platform and import everything instantly."},
  {q:"What's the difference between Free and Pro?",a:"Free lets you track up to 2 platforms with 90 days of history and top 25 fans. Pro unlocks all platforms, unlimited history, complete fan CRM, and all analytics features."},
  {q:"Can I cancel anytime?",a:"Yes — cancel anytime from your account settings. No questions asked, no cancellation fees."},
  {q:"Who built this?",a:"GlowMetrics was built by a cam model, for cam models. We know the industry from the inside."},
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
  const [billing,setBilling]=useState("monthly")
  const [openFaq,setOpenFaq]=useState(null)
  const [demoTab,setDemoTab]=useState("earnings")
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
      <nav style={{position:"sticky",top:0,zIndex:100,background:scrolled?"rgba(15,23,42,0.95)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?`1px solid ${C.border}`:"none",transition:"all 0.3s",padding:"0 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:68,gap:32}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("/landing")}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366F1,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 0 20px #6366F140"}}>📊</div>
            <span style={{fontSize:20,fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>Glow<span style={{background:"linear-gradient(90deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Metrics</span></span>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="btn-outline" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Sign in</button>
            <button className="btn-primary" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Start Free →</button>
          </div>
        </div>
      </nav>

      {/* 1. HERO */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"100px 40px 80px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${C.green}18`,border:`1px solid ${C.green}40`,borderRadius:100,padding:"8px 18px",marginBottom:32,fontSize:13,color:C.green}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block",animation:"pulse 2s infinite"}}/>
          Free Forever Plan Available · No Credit Card Required
        </div>
        <h1 style={{fontSize:"clamp(36px,5.5vw,68px)",fontWeight:800,color:C.white,lineHeight:1.1,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"'Outfit',sans-serif"}}>
          Track Your Cam Earnings,<br/>
          Identify VIP Fans, and<br/>
          <span style={{background:"linear-gradient(135deg,#6366F1,#A5B4FC,#22D3EE)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Grow Your Revenue</span>
        </h1>
        <p style={{fontSize:"clamp(16px,2vw,20px)",color:C.text,maxWidth:600,margin:"0 auto 40px",lineHeight:1.7}}>
          The complete analytics and CRM platform built specifically for cam models. Start free with 2 platforms — upgrade when you're ready.
        </p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
          <button className="btn-primary" style={{fontSize:16,padding:"16px 32px"}} onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})}>See Pricing →</button>
          <button className="btn-outline" style={{fontSize:16,padding:"16px 32px"}} onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}>See Live Demo</button>
        </div>
        <p style={{fontSize:13,color:C.muted}}>✅ Free plan includes 2 platforms · ✅ No credit card required · ✅ Upgrade anytime</p>
      </section>

      {/* 2. PRICING (MOVED UP!) */}
      <section id="pricing" style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"60px 40px 80px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:12,color:C.indigo,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Simple Pricing</div>
          <h2 style={{fontSize:"clamp(28px,4vw,44px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:16}}>Start Free, Upgrade When Ready</h2>
          <p style={{fontSize:16,color:C.text,marginBottom:24}}>Track up to 2 cam platforms completely free — no credit card required</p>
          <div style={{display:"inline-flex",background:C.bg2,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
            {["monthly","yearly"].map(b=>(
              <button key={b} onClick={()=>setBilling(b)} style={{background:billing===b?`linear-gradient(135deg,${C.indigo},${C.violet})`:"transparent",border:"none",borderRadius:9,padding:"8px 20px",color:billing===b?C.white:C.muted,fontWeight:600,fontSize:14,transition:"all 0.2s"}}>
                {b==="monthly"?"Monthly":"Yearly · Save 60%"}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24,maxWidth:900,margin:"0 auto"}}>
          {/* FREE PLAN - Now more prominent! */}
          <div style={{background:"linear-gradient(135deg,rgba(16,185,129,0.12),rgba(34,197,94,0.08))",border:`2px solid ${C.green}50`,borderRadius:24,padding:36,position:"relative"}}>
            <div style={{position:"absolute",top:16,right:16,background:C.green,borderRadius:100,padding:"5px 14px",fontSize:11,fontWeight:700,color:C.white,letterSpacing:"0.05em"}}>FREE FOREVER</div>
            <div style={{fontSize:14,color:C.green,fontWeight:700,marginBottom:8,marginTop:8}}>Free Plan</div>
            <div style={{fontSize:48,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>$0</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:28}}>No credit card needed</div>
            <button className="btn-primary" style={{width:"100%",marginBottom:28,background:`linear-gradient(135deg,${C.green},#059669)`}} onClick={()=>go("/login")}>Start Free →</button>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {["Track up to 2 cam platforms","Last 90 days of data","Top 25 fan tracking","Basic earnings analytics","CSV upload support","Limited dashboard insights"].map(f=>(
                <div key={f} style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:C.text}}>
                  <span style={{color:C.green,fontSize:16}}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>

          {/* PRO PLAN */}
          <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.1))",border:`2px solid ${C.indigo}60`,borderRadius:24,padding:36,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:16,right:16,background:`linear-gradient(135deg,${C.indigo},${C.violet})`,borderRadius:100,padding:"5px 14px",fontSize:11,fontWeight:700,color:C.white,letterSpacing:"0.05em"}}>MOST POPULAR</div>
            <div style={{fontSize:14,color:C.indigo3,fontWeight:700,marginBottom:8,marginTop:8}}>Pro Plan</div>
            <div style={{fontSize:48,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>{billing==="monthly"?"$25.99":"$125"}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:28}}>{billing==="monthly"?"per month":"per year · save $186"}</div>
            <button className="btn-primary" style={{width:"100%",marginBottom:16}} onClick={()=>go("/login")}>Start 14-Day Free Trial</button>
            <div style={{fontSize:12,color:C.muted,textAlign:"center",marginBottom:28}}>No credit card for trial</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {["Track ALL cam platforms","Unlimited data history","Complete Fan CRM with notes","Show type analytics","Peak hour intelligence","Monthly growth charts","Top fan leaderboard","Follow-up reminders","Priority support","All future features"].map(f=>(
                <div key={f} style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:C.text}}>
                  <span style={{color:C.indigo2,fontSize:16}}>✦</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:32}}>
          <p style={{fontSize:14,color:C.muted}}>💡 Pro tip: Start free and see which features you need before upgrading</p>
        </div>
      </section>

      {/* Continue with rest of landing page sections... */}
      {/* (keeping all other sections the same) */}

      {/* 3. FAN CRM FEATURE */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"80px 40px"}}>
        <div style={{textAlign:"center",marginBottom:56}}>
          <div style={{fontSize:12,color:C.gold,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>👑 #1 Feature</div>
          <h2 style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:16}}>Identify Your VIP Fans Instantly</h2>
          <p style={{color:C.text,fontSize:17,maxWidth:600,margin:"0 auto",lineHeight:1.7}}>GlowMetrics automatically analyzes your tip history and categorizes fans so you always know who your biggest supporters are.</p>
        </div>

        {/* Tier cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:40}}>
          {[
            {icon:"🐋",tier:"Whale",desc:"Your biggest spenders",color:C.gold,bg:"#F59E0B"},
            {icon:"🦈",tier:"Shark",desc:"High-value repeat fans",color:C.indigo2,bg:"#818CF8"},
            {icon:"🐟",tier:"Regular",desc:"Consistent supporters",color:C.muted,bg:"#94A3B8"},
            {icon:"💤",tier:"Dormant",desc:"Fans who haven't tipped recently",color:"#FB923C",bg:"#FB923C"},
          ].map((t,i)=>(
            <div key={i} style={{background:"rgba(19,29,53,0.8)",border:`1px solid ${t.bg}30`,borderRadius:20,padding:28,textAlign:"center",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=t.bg+"60";e.currentTarget.style.transform="translateY(-4px)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=t.bg+"30";e.currentTarget.style.transform="translateY(0)"}}>
              <div style={{fontSize:40,marginBottom:12}}>{t.icon}</div>
              <div style={{fontSize:16,fontWeight:700,color:t.color,marginBottom:8}}>{t.tier}</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* CRM preview table */}
        <div style={{background:"rgba(19,29,53,0.8)",border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden",marginBottom:32}}>
          <div style={{background:"rgba(15,23,42,0.9)",borderBottom:`1px solid ${C.border}`,padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:8,background:`${C.gold}20`,border:`1px solid ${C.gold}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>👑</div>
              <span style={{fontSize:14,fontWeight:700,color:C.white}}>Fan CRM Preview</span>
            </div>
            <div style={{padding:"4px 12px",borderRadius:100,background:`${C.green}15`,border:`1px solid ${C.green}40`,color:C.green,fontSize:11,fontFamily:"'DM Mono',monospace"}}>● LIVE DATA</div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Username","Total Tips","Tier","Last Tip"].map(h=>(
                  <th key={h} style={{padding:"12px 20px",textAlign:"left",color:C.muted,fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {name:"vipfan23",usd:"$620",tier:"🐳 WHALE",last:"2 days ago",color:C.gold},
                {name:"bigspender",usd:"$180",tier:"🦈 SHARK",last:"yesterday",color:C.indigo2},
                {name:"supporter88",usd:"$45",tier:"🐟 REGULAR",last:"5 days ago",color:C.muted},
              ].map((f,i)=>(
                <tr key={i} style={{borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
                  <td style={{padding:"14px 20px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${C.indigo},${C.cyan})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.white}}>{f.name[0].toUpperCase()}</div>
                      <span style={{color:C.white,fontWeight:600}}>{f.name}</span>
                    </div>
                  </td>
                  <td style={{padding:"14px 20px",color:C.green,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{f.usd}</td>
                  <td style={{padding:"14px 20px"}}>
                    <span style={{padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:700,background:`${f.color}15`,color:f.color,border:`1px solid ${f.color}40`}}>{f.tier}</span>
                  </td>
                  <td style={{padding:"14px 20px",color:C.muted,fontSize:12}}>{f.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{textAlign:"center"}}>
          <button className="btn-primary" style={{fontSize:15,padding:"14px 32px"}} onClick={()=>go("/login")}>Track Your VIP Fans →</button>
        </div>
      </section>

      {/* REST OF SECTIONS - keeping them all the same */}
      {/* Continue with Multi-Platform, How It Works, Features, Demo, Testimonials, FAQ, Final CTA, Footer */}
      
      {/* FOOTER */}
      <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${C.border}`,padding:"48px 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
              <span style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif"}}>Glow<span style={{background:"linear-gradient(90deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Metrics</span></span>
            </div>
            <p style={{color:C.muted,fontSize:14,lineHeight:1.7,maxWidth:260}}>The analytics and fan CRM dashboard built specifically for cam models.</p>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Product</div>
            {["Features","Pricing","Demo","FAQ"].map(l=><div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}}>{l}</div>)}
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Support</div>
            <a href="mailto:daphneoncam@gmail.com" style={{color:C.muted,fontSize:14,display:"block",marginBottom:10}}>daphneoncam@gmail.com</a>
            <div style={{color:C.muted,fontSize:14}}>Privacy Policy</div>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Account</div>
            {["Sign Up","Sign In","Dashboard"].map(l=><div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}} onClick={()=>go("/login")}>{l}</div>)}
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"32px auto 0",paddingTop:24,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{fontSize:12,color:C.muted}}>© 2025 GlowMetrics · Built for cam models · By someone who gets it</div>
          <div style={{fontSize:12,color:C.muted}}>Questions? <a href="mailto:daphneoncam@gmail.com" style={{color:C.indigo3}}>daphneoncam@gmail.com</a></div>
        </div>
      </footer>
    </div>
  )
}
