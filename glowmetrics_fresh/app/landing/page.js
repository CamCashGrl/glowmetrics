"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:"#0F172A",bg1:"#131d35",bg2:"#172040",bg3:"#1e2a4a",bg4:"#243055",
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
  {q:"How do I import my data?",a:"Download your CSV from your cam platform dashboard, then drag and drop it into Camlytics. We auto-detect the platform and import everything instantly."},
  {q:"What's the difference between Free and Pro?",a:"Free gives you 1 platform, last 90 days, and top 25 fans. Pro unlocks unlimited platforms, full history, complete fan CRM, and all analytics features."},
  {q:"Can I cancel anytime?",a:"Yes — cancel anytime from your account settings. No questions asked, no cancellation fees."},
  {q:"Who built this?",a:"Camlytics was built by a cam model, for cam models. We know the industry from the inside."},
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
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        .btn-primary{background:linear-gradient(135deg,#6366F1,#7C3AED);border:none;border-radius:12px;padding:14px 28px;color:#F8FAFC;font-weight:700;font-size:15px;transition:all 0.2s;box-shadow:0 4px 24px #6366F140}
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
            <span style={{fontSize:20,fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>Cam<span style={{background:"linear-gradient(90deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>lytics</span></span>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="btn-outline" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Sign in</button>
            <button className="btn-primary" style={{padding:"9px 20px",fontSize:14}} onClick={()=>go("/login")}>Start Free Trial</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"100px 40px 80px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${C.indigo}18`,border:`1px solid ${C.indigo}40`,borderRadius:100,padding:"8px 18px",marginBottom:32,fontSize:13,color:C.indigo3}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:C.indigo,display:"inline-block",animation:"pulse 2s infinite"}}/>
          Built by a cam model, for cam models
        </div>
        <h1 style={{fontSize:"clamp(36px,5.5vw,68px)",fontWeight:800,color:C.white,lineHeight:1.1,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"'Outfit',sans-serif"}}>
          The Analytics Dashboard<br/>
          <span style={{background:"linear-gradient(135deg,#6366F1,#A5B4FC,#22D3EE)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Cam Models Deserve</span>
        </h1>
        <p style={{fontSize:"clamp(16px,2vw,20px)",color:C.text,maxWidth:600,margin:"0 auto 40px",lineHeight:1.7}}>
          Track earnings, analyze performance, and manage VIP fans in one powerful creator dashboard. Turn your cam shows into a data-driven business.
        </p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
          <button className="btn-primary" style={{fontSize:16,padding:"16px 32px"}} onClick={()=>go("/login")}>Start Free Trial →</button>
          <button className="btn-outline" style={{fontSize:16,padding:"16px 32px"}} onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}>See Live Demo</button>
        </div>
        <p style={{fontSize:13,color:C.muted}}>14-day free Pro trial · No credit card required · Cancel anytime</p>
        <div style={{display:"flex",gap:0,justifyContent:"center",marginTop:60,flexWrap:"wrap"}}>
          {[["10+","Platforms Supported"],["275+","Avg Fans Tracked"],["$0","Setup Cost"],["14 days","Free Pro Trial"]].map(([val,label],i)=>(
            <div key={i} style={{padding:"20px 40px",borderLeft:i>0?`1px solid ${C.border}`:"none",textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif"}}>{val}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"80px 40px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:12,color:C.indigo,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Live Demo</div>
          <h2 style={{fontSize:"clamp(28px,4vw,44px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>Your Cam Business, Visualized</h2>
          <p style={{color:C.muted,marginTop:12,fontSize:16}}>Sample data — sign up to see your real numbers</p>
        </div>
        <div style={{background:"rgba(19,29,53,0.8)",backdropFilter:"blur(20px)",border:`1px solid ${C.border}`,borderRadius:24,overflow:"hidden",boxShadow:"0 32px 80px #00000060"}}>
          <div style={{background:"rgba(15,23,42,0.9)",borderBottom:`1px solid ${C.border}`,padding:"16px 24px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{display:"flex",gap:6}}>
              {["#f87171","#fbbf24","#34d399"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
            </div>
            <div style={{flex:1,display:"flex",gap:4,flexWrap:"wrap"}}>
              {[["earnings","📈 Earnings"],["fans","👑 Top Fans"],["shows","🎡 Show Types"],["hours","⏰ Peak Hours"]].map(([id,label])=>(
                <button key={id} onClick={()=>setDemoTab(id)} style={{background:demoTab===id?`${C.indigo}20`:"transparent",border:demoTab===id?`1px solid ${C.indigo}50`:"1px solid transparent",borderRadius:8,padding:"6px 14px",color:demoTab===id?C.indigo3:C.muted,fontSize:12,fontWeight:demoTab===id?700:400,transition:"all 0.2s"}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{padding:"4px 12px",borderRadius:100,background:`${C.green}15`,border:`1px solid ${C.green}40`,color:C.green,fontSize:11,fontFamily:"'DM Mono',monospace"}}>● DEMO</div>
          </div>
          <div style={{padding:28}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:28}}>
              {[{label:"Lifetime Earnings",value:"$2,770",color:C.green,icon:"💰"},{label:"Total Tokens",value:"110,800",color:C.indigo2,icon:"🎫"},{label:"Unique Fans",value:"342",color:C.cyan,icon:"👥"},{label:"Avg Tip",value:"$0.62",color:C.gold,icon:"⭐"}].map((k,i)=>(
                <div key={i} style={{background:"rgba(15,23,42,0.7)",border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 20px"}}>
                  <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{k.icon} {k.label}</div>
                  <div style={{fontSize:26,fontWeight:800,color:k.color,fontFamily:"'Outfit',sans-serif"}}>{k.value}</div>
                </div>
              ))}
            </div>
            {demoTab==="earnings"&&(
              <div style={{background:"rgba(15,23,42,0.7)",border:`1px solid ${C.border}`,borderRadius:16,padding:24}}>
                <div style={{fontSize:13,color:C.muted,marginBottom:16,fontWeight:600}}>Monthly Earnings — Last 6 Months</div>
                <SimpleBar data={DEMO_EARNINGS} valueKey="usd" labelKey="month" color={C.indigo} height={140}/>
              </div>
            )}
            {demoTab==="fans"&&(
              <div style={{background:"rgba(15,23,42,0.7)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.border}`}}>
                      {["Rank","Username","Tokens","USD","Platform","Status"].map(h=>(
                        <th key={h} style={{padding:"12px 16px",textAlign:"left",color:C.muted,fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_FANS.map((f,i)=>(
                      <tr key={i} style={{borderBottom:i<DEMO_FANS.length-1?`1px solid ${C.border}`:"none"}}>
                        <td style={{padding:"13px 16px",color:C.gold,fontWeight:800,fontFamily:"'DM Mono',monospace"}}>#{f.rank}</td>
                        <td style={{padding:"13px 16px",color:C.white,fontWeight:600}}>{f.name}</td>
                        <td style={{padding:"13px 16px",color:C.indigo2,fontFamily:"'DM Mono',monospace"}}>{f.tokens.toLocaleString()}</td>
                        <td style={{padding:"13px 16px",color:C.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{f.usd}</td>
                        <td style={{padding:"13px 16px",color:C.muted}}>{f.platform}</td>
                        <td style={{padding:"13px 16px"}}>
                          <span style={{padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:700,background:f.badge.includes("WHALE")?`${C.gold}15`:f.badge.includes("SHARK")?`${C.indigo}15`:`${C.muted}15`,color:f.badge.includes("WHALE")?C.gold:f.badge.includes("SHARK")?C.indigo2:C.muted,border:`1px solid ${f.badge.includes("WHALE")?C.gold+"40":f.badge.includes("SHARK")?C.indigo+"40":C.muted+"40"}`}}>{f.badge}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {demoTab==="shows"&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16}}>
                {DEMO_SHOWS.map((s,i)=>(
                  <div key={i} style={{background:"rgba(15,23,42,0.7)",border:`1px solid ${C.border}`,borderRadius:16,padding:20}}>
                    <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{s.type}</div>
                    <div style={{fontSize:28,fontWeight:800,color:s.color,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>${s.avg}</div>
                    <div style={{fontSize:11,color:C.muted}}>avg/stream · {s.tips} tips</div>
                    <div style={{marginTop:12,height:4,borderRadius:2,background:C.border,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${(s.avg/203)*100}%`,background:s.color,borderRadius:2}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {demoTab==="hours"&&(
              <div style={{background:"rgba(15,23,42,0.7)",border:`1px solid ${C.border}`,borderRadius:16,padding:24}}>
                <div style={{fontSize:13,color:C.muted,marginBottom:4,fontWeight:600}}>Peak Earning Hours</div>
                <div style={{fontSize:11,color:C.indigo3,marginBottom:16,fontFamily:"'DM Mono',monospace"}}>Best window: 9PM–11PM · Avg $167/hr</div>
                <SimpleBar data={DEMO_HOURS} valueKey="usd" labelKey="h" color={C.cyan} height={140}/>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"80px 40px"}}>
        <div style={{textAlign:"center",marginBottom:56}}>
          <div style={{fontSize:12,color:C.indigo,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Everything You Need</div>
          <h2 style={{fontSize:"clamp(28px,4vw,44px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>The Creator Intelligence Dashboard</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
          {FEATURES.map((f,i)=>(
            <div key={i} style={{background:"rgba(19,29,53,0.6)",backdropFilter:"blur(16px)",border:`1px solid ${C.border}`,borderRadius:20,padding:28,transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=f.accent+"60";e.currentTarget.style.transform="translateY(-4px)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)"}}>
              <div style={{fontSize:32,marginBottom:16}}>{f.icon}</div>
              <div style={{fontSize:11,color:f.accent,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{f.tag}</div>
              <h3 style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:10}}>{f.title}</h3>
              <p style={{fontSize:14,color:C.muted,lineHeight:1.7}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"80px 40px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:12,color:C.indigo,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Creators Love It</div>
          <h2 style={{fontSize:"clamp(28px,4vw,40px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>Built by a Creator, Trusted by Creators</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          {TESTIMONIALS.map((t,i)=>(
            <div key={i} style={{background:"rgba(19,29,53,0.6)",backdropFilter:"blur(16px)",border:`1px solid ${C.border}`,borderRadius:20,padding:28}}>
              <div style={{fontSize:28,color:C.indigo2,marginBottom:16}}>"</div>
              <p style={{color:C.text,fontSize:15,lineHeight:1.75,marginBottom:20}}>{t.quote}</p>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                <div style={{color:C.white,fontWeight:600,fontSize:14}}>{t.name}</div>
                <div style={{color:C.muted,fontSize:12,marginTop:2}}>{t.platform}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"80px 40px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:12,color:C.indigo,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Simple Pricing</div>
          <h2 style={{fontSize:"clamp(28px,4vw,44px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:16}}>Start Free, Upgrade When Ready</h2>
          <div style={{display:"inline-flex",background:C.bg2,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
            {["monthly","yearly"].map(b=>(
              <button key={b} onClick={()=>setBilling(b)} style={{background:billing===b?`linear-gradient(135deg,${C.indigo},${C.violet})`:"transparent",border:"none",borderRadius:9,padding:"8px 20px",color:billing===b?C.white:C.muted,fontWeight:600,fontSize:14,transition:"all 0.2s"}}>
                {b==="monthly"?"Monthly":"Yearly · Save 60%"}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24,maxWidth:800,margin:"0 auto"}}>
          <div style={{background:"rgba(19,29,53,0.6)",border:`1px solid ${C.border}`,borderRadius:24,padding:36}}>
            <div style={{fontSize:14,color:C.muted,fontWeight:600,marginBottom:8}}>Free Forever</div>
            <div style={{fontSize:48,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>$0</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:28}}>No credit card needed</div>
            <button className="btn-outline" style={{width:"100%",marginBottom:28}} onClick={()=>go("/login")}>Get Started Free</button>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {["1 platform","Last 90 days of data","Top 25 fans","Basic overview","CSV import","Peak hour chart"].map(f=>(
                <div key={f} style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:C.text}}>
                  <span style={{color:C.green,fontSize:16}}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.1))",border:`1px solid ${C.indigo}60`,borderRadius:24,padding:36,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:16,right:16,background:`linear-gradient(135deg,${C.indigo},${C.violet})`,borderRadius:100,padding:"4px 12px",fontSize:11,fontWeight:700,color:C.white}}>MOST POPULAR</div>
            <div style={{fontSize:14,color:C.indigo3,fontWeight:600,marginBottom:8}}>Pro</div>
            <div style={{fontSize:48,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>{billing==="monthly"?"$25.99":"$125"}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:28}}>{billing==="monthly"?"per month":"per year · save $186"}</div>
            <button className="btn-primary" style={{width:"100%",marginBottom:16}} onClick={()=>go("/login")}>Start 14-Day Free Trial</button>
            <div style={{fontSize:12,color:C.muted,textAlign:"center",marginBottom:28}}>No credit card for trial</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {["All 10 platforms","Full earnings history","Complete Fan CRM","Show type analytics","Peak hour intelligence","Monthly growth charts","Top fan leaderboard","Priority support","All future features"].map(f=>(
                <div key={f} style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:C.text}}>
                  <span style={{color:C.indigo2,fontSize:16}}>✦</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{position:"relative",zIndex:1,maxWidth:700,margin:"0 auto",padding:"60px 40px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <h2 style={{fontSize:"clamp(24px,3vw,36px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif"}}>Common Questions</h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {FAQS.map((f,i)=>(
            <div key={i} style={{background:"rgba(19,29,53,0.6)",border:`1px solid ${openFaq===i?C.indigo+"60":C.border}`,borderRadius:16,overflow:"hidden",transition:"border-color 0.2s"}}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{width:"100%",background:"transparent",border:"none",padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",color:C.white,fontSize:15,fontWeight:600,textAlign:"left",gap:16}}>
                {f.q}
                <span style={{color:C.indigo2,fontSize:18,flexShrink:0,transform:openFaq===i?"rotate(45deg)":"rotate(0)",transition:"transform 0.2s"}}>+</span>
              </button>
              {openFaq===i&&<div style={{padding:"0 22px 18px",color:C.muted,fontSize:14,lineHeight:1.7}}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"60px 40px 100px"}}>
        <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(34,211,238,0.08))",border:`1px solid ${C.indigo}30`,borderRadius:28,padding:"72px 40px",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",fontFamily:"'Outfit',sans-serif",marginBottom:16}}>Start Tracking Your Streaming Success</h2>
          <p style={{color:C.text,fontSize:18,marginBottom:36,maxWidth:500,margin:"0 auto 36px"}}>Stop guessing what works. Use data to build a smarter cam business.</p>
          <button className="btn-primary" style={{fontSize:17,padding:"18px 40px"}} onClick={()=>go("/login")}>Start My Free Trial →</button>
          <p style={{color:C.muted,fontSize:13,marginTop:16}}>14-day free Pro trial · No credit card required</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${C.border}`,padding:"48px 40px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
              <span style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:"'Outfit',sans-serif"}}>Cam<span style={{background:"linear-gradient(90deg,#6366F1,#A5B4FC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>lytics</span></span>
            </div>
            <p style={{color:C.muted,fontSize:14,lineHeight:1.7,maxWidth:260}}>The analytics and fan CRM dashboard built specifically for cam models.</p>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Product</div>
            {["Features","Pricing","Demo","FAQ"].map(l=><div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}}>{l}</div>)}
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Support</div>
            <div style={{color:C.muted,fontSize:14,marginBottom:10}}>Help Center</div>
            <a href="mailto:daphneoncam@gmail.com" style={{color:C.muted,fontSize:14,display:"block",marginBottom:10}}>daphneoncam@gmail.com</a>
            <div style={{color:C.muted,fontSize:14}}>Privacy Policy</div>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:14,marginBottom:16}}>Account</div>
            {["Sign Up","Sign In","Dashboard"].map(l=><div key={l} style={{color:C.muted,fontSize:14,marginBottom:10,cursor:"pointer"}} onClick={()=>go("/login")}>{l}</div>)}
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"32px auto 0",paddingTop:24,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{fontSize:12,color:C.muted}}>© 2025 Camlytics · Built for cam models · By someone who gets it</div>
          <div style={{fontSize:12,color:C.muted}}>Questions? <a href="mailto:daphneoncam@gmail.com" style={{color:C.indigo3}}>daphneoncam@gmail.com</a></div>
        </div>
      </footer>
    </div>
  )
}
