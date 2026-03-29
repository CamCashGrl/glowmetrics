"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:'#05070f', card:'rgba(15,20,35,0.8)', border:'rgba(255,255,255,0.07)',
  cyan:'#22D3EE', pink:'#EC4899', purple:'#7C5CFF', green:'#10B981',
  gold:'#F59E0B', orange:'#FB923C', red:'#F87171', white:'#F1F5F9',
  text:'#94A3B8', muted:'#475569',
}

function Counter({ end, prefix='', suffix='', duration=2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const startTime = Date.now()
        const timer = setInterval(() => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(end * eased))
          if (progress >= 1) clearInterval(timer)
        }, 16)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

function DashboardMockup() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 2500)
    return () => clearInterval(t)
  }, [])
  const alerts = [
    { icon: '🔥', text: 'Peak hour NOW — go live', color: C.green },
    { icon: '🐳', text: 'jkl123 due to tip soon', color: C.cyan },
    { icon: '⚠️', text: '62% revenue from 1 fan', color: C.orange },
  ]
  const sessions = [
    { day: 'Sat', h: 88 }, { day: 'Sun', h: 42 }, { day: 'Mon', h: 65 },
    { day: 'Tue', h: 110 }, { day: 'Wed', h: 34 }, { day: 'Thu', h: 78 }, { day: 'Fri', h: 95 },
  ]
  return (
    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden', fontFamily:'Inter,sans-serif', boxShadow:`0 0 80px rgba(34,211,238,0.08),0 40px 80px rgba(0,0,0,0.6)`, width:'100%', maxWidth:540 }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', gap:5 }}>
          {['#F87171','#FBBF24','#34D399'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', margin:'0 8px' }} />
        <div style={{ fontSize:10, color:C.muted, fontWeight:600 }}>CamCash Dashboard</div>
      </div>
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:4 }}>
        {['📊 Overview','🎯 Platforms','🐳 Top Fans','🎥 Sessions'].map((tab, i) => (
          <div key={tab} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, background:i===0?'rgba(34,211,238,0.12)':'transparent', color:i===0?C.cyan:C.muted, border:i===0?`1px solid rgba(34,211,238,0.2)`:'1px solid transparent' }}>{tab}</div>
        ))}
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
          {[
            { label:'Revenue', value:'$3,973', color:C.green },
            { label:'Tips', value:'12,680', color:C.cyan },
            { label:'Avg $/hr', value:'$22', color:C.gold },
            { label:'Top Fan', value:'$304', color:C.pink },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:16, fontWeight:800, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, marginBottom:12 }}>
          <div style={{ fontSize:10, color:C.white, fontWeight:700, marginBottom:10 }}>📊 Session Revenue — Last 7 Days</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:56 }}>
            {sessions.map(({ day, h }, i) => (
              <div key={day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ width:'100%', height:h*0.5, borderRadius:4, background:i===3?`linear-gradient(180deg,${C.cyan},${C.purple})`:'rgba(34,211,238,0.25)', transition:'height 0.5s ease' }} />
                <div style={{ fontSize:8, color:C.muted }}>{day}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.15)' }}>
          <div style={{ fontSize:10, color:C.cyan, fontWeight:700, marginBottom:8 }}>⚡ Live Intelligence</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {alerts.map(({ icon, text, color }, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:7, background:`${color}0D`, border:`1px solid ${color}25` }}>
                <span style={{ fontSize:12 }}>{icon}</span>
                <span style={{ fontSize:11, color, fontWeight:600 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FanTableMockup() {
  const fans = [
    { name:'jkl123456', tier:'🐳 WHALE', usd:'$304', tips:290, risk:'Low', rColor:C.green, bar:85 },
    { name:'l1ttlesubb', tier:'🦈 SHARK', usd:'$150', tips:2, risk:'Medium', rColor:C.gold, bar:55 },
    { name:'xXbigspend', tier:'🐟 REGULAR', usd:'$87', tips:44, risk:'High', rColor:C.red, bar:30 },
    { name:'fanboy999', tier:'💤 DORMANT', usd:'$62', tips:18, risk:'Critical', rColor:C.red, bar:10 },
  ]
  return (
    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', fontFamily:'Inter,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.white }}>🐳 Top Fans</div>
        <div style={{ fontSize:10, color:C.cyan, background:'rgba(34,211,238,0.1)', padding:'3px 8px', borderRadius:20 }}>12,680 tippers</div>
      </div>
      <div style={{ padding:'0 0 8px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 70px', padding:'8px 16px', borderBottom:`1px solid ${C.border}` }}>
          {['Fan','Tier','Spent','Tips','Risk'].map(h => (
            <div key={h} style={{ fontSize:9, color:C.muted, fontWeight:700, textTransform:'uppercase' }}>{h}</div>
          ))}
        </div>
        {fans.map((f, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 70px', padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.white, marginBottom:3 }}>{f.name}</div>
              <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden', width:'80%' }}>
                <div style={{ height:'100%', width:`${f.bar}%`, background:`linear-gradient(90deg,${C.cyan},${C.pink})`, borderRadius:2 }} />
              </div>
            </div>
            <div style={{ fontSize:10, color:C.cyan }}>{f.tier}</div>
            <div style={{ fontSize:12, fontWeight:800, color:C.green }}>{f.usd}</div>
            <div style={{ fontSize:11, color:C.text }}>{f.tips}</div>
            <div style={{ fontSize:10, fontWeight:700, color:f.rColor, background:`${f.rColor}15`, padding:'2px 7px', borderRadius:20, textAlign:'center', width:'fit-content' }}>{f.risk}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionMockup() {
  const buckets = [12,8,45,22,67,89,34,56,78,43,21,15,8,32,55,88,42,19,28,64]
  const max = Math.max(...buckets)
  return (
    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', fontFamily:'Inter,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:C.white }}>Chaturbate — Sat Mar 15</div>
          <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>68 min · 247 tips</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.green }}>$88.50</div>
          <div style={{ fontSize:10, color:C.green }}>↑ 23% above avg</div>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:10, color:C.muted, marginBottom:6 }}>⏱ Tip timeline (5-min buckets)</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:48 }}>
          {buckets.map((v, i) => (
            <div key={i} style={{ flex:1, height:(v/max)*48, borderRadius:2, background:i===9?`linear-gradient(180deg,${C.gold},${C.orange})`:i>=10?'rgba(34,211,238,0.2)':`linear-gradient(180deg,${C.cyan}60,${C.purple}60)` }} />
          ))}
        </div>
        <div style={{ fontSize:9, color:C.gold, marginTop:4 }}>⭐ Peak at 45 min</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[{ label:'$/min', value:'$1.30', color:C.cyan }, { label:'Pace', value:'🔥 Hot', color:C.green }, { label:'Top fan', value:'62%', color:C.gold }].map(({ label, value, color }) => (
          <div key={label} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:800, color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingClient() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [visible, setVisible] = useState({})
  const sectionRefs = useRef({})

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setVisible(v => ({ ...v, [e.target.dataset.section]: true })) }),
      { threshold: 0.1 }
    )
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const setRef = (key) => (el) => { if (el) { el.dataset.section = key; sectionRefs.current[key] = el } }
  const go = (path) => router.push(path)
  const fadeIn = (key, delay=0) => ({
    opacity: visible[key] ? 1 : 0,
    transform: visible[key] ? 'translateY(0)' : 'translateY(28px)',
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
  })

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    @keyframes glow-pulse{0%,100%{box-shadow:0 0 30px rgba(34,211,238,0.3)}50%{box-shadow:0 0 60px rgba(34,211,238,0.6),0 0 100px rgba(236,72,153,0.2)}}
    @keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(600%)}}
    @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    .cta-btn{display:inline-block;padding:16px 40px;border-radius:12px;background:linear-gradient(135deg,#22D3EE,#EC4899);color:white;font-weight:800;font-size:16px;cursor:pointer;border:none;font-family:'Syne',sans-serif;letter-spacing:0.3px;transition:transform 0.2s,box-shadow 0.2s;animation:glow-pulse 3s infinite;text-decoration:none}
    .cta-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 8px 40px rgba(34,211,238,0.5)!important;animation:none}
    .cta-ghost{display:inline-block;padding:14px 32px;border-radius:12px;background:transparent;color:#F1F5F9;font-weight:700;font-size:15px;cursor:pointer;border:1px solid rgba(255,255,255,0.15);font-family:'Syne',sans-serif;transition:all 0.2s;text-decoration:none}
    .cta-ghost:hover{border-color:#22D3EE;color:#22D3EE;background:rgba(34,211,238,0.06)}
    .fcard{padding:28px;border-radius:16px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);transition:transform 0.25s,border-color 0.25s,box-shadow 0.25s}
    .fcard:hover{transform:translateY(-4px);border-color:rgba(34,211,238,0.25);box-shadow:0 20px 60px rgba(34,211,238,0.06)}
    .tcard{padding:28px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);transition:transform 0.25s,box-shadow 0.25s}
    .tcard:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(0,0,0,0.3)}
    .faq-q{border-bottom:1px solid rgba(255,255,255,0.06);overflow:hidden}
    .ticker-track{display:flex;gap:40px;animation:ticker 28s linear infinite;width:max-content}
    .nav-link{font-size:14px;color:#475569;text-decoration:none;transition:color 0.2s}
    .nav-link:hover{color:#22D3EE}
    .footer-link{display:block;font-size:14px;color:#475569;text-decoration:none;margin-bottom:8px;transition:color 0.2s}
    .footer-link:hover{color:#22D3EE}
  `

  const features = [
    { icon:'⏰', title:'Find Your Peak Hours', outcome:'Stream when your audience actually tips', body:"Your peak hours aren't generic platform peaks — they're specific to your fans' schedules. CamCash finds them from your actual tip timestamps. Most models see 40–60% higher $/hr just from timing alone.", color:C.cyan },
    { icon:'🐳', title:'Track Your Whale Fans', outcome:'Know exactly who\'s making you money', body:"Your top 10–15% of fans generate 60–70% of your income. CamCash ranks every tipper, tracks churn risk, and tells you when a whale is about to go cold — before it hits your monthly total.", color:C.gold },
    { icon:'🎥', title:'Session Breakdown', outcome:'Know why every stream performed how it did', body:'Every session gets a full timeline — when tips came in, whether your pace was growing or dying, which fan drove the revenue. No more guessing what happened.', color:C.purple },
    { icon:'🎯', title:'Platform Comparison', outcome:'Stop wasting hours on the wrong platform', body:"If you're on multiple platforms, you're almost certainly earning more per hour on one than the other. CamCash shows your real $/hr side by side. The gap is usually 2–4x.", color:C.pink },
    { icon:'🔴', title:'Live Mode Coaching', outcome:'Make smarter decisions mid-stream', body:"Log tips as they come in. Get real-time pace alerts, silence detection, goal progress, and one specific 'Do This Now' instruction that updates as your session evolves.", color:C.green },
    { icon:'🎬', title:'Room Title Generator', outcome:'More clicks and tips from your title alone', body:'Your room title is your ad. CamCash generates high-conversion titles using the Hook + Goal + Reward + Urgency formula — with your toy, token goal, and mood built in.', color:C.orange },
  ]

  const testimonials = [
    { quote:"I always thought Saturday was my best night. CamCash showed me my real peak is Tuesday at 11 PM. I shifted my schedule and my income went up noticeably within two weeks.", name:"Chaturbate model", detail:"3 years streaming", stat:"+34% $/hr", statColor:C.green },
    { quote:"The fan churn alerts are the feature I didn't know I needed. One of my top tippers hadn't appeared in 18 days. CamCash flagged it and generated a message. He came back and tipped $80 that same night.", name:"BongaCams model", detail:"18 months streaming", stat:"$80 recovered", statColor:C.cyan },
    { quote:"I was splitting my time equally between Chaturbate and BongaCams. The platform comparison showed Chaturbate earns me $22/hr vs $6/hr on BongaCams. Shifting made a real difference.", name:"Multi-platform model", detail:"Chaturbate + BongaCams", stat:"3.6x $/hr diff", statColor:C.gold },
  ]

  const faqs = [
    { q:'Is CamCash really free?', a:"Yes — completely free during beta. All features unlocked, no credit card required. We'll give plenty of notice before anything changes." },
    { q:'Which platforms does it support?', a:'Chaturbate, BongaCams, MyFreeCams, CamSoda, and Stripchat. If your platform lets you export a CSV, CamCash can analyze it.' },
    { q:'Does it connect to my cam account?', a:"No. CamCash never accesses your platform account. You export a CSV and upload it — that's the only connection. Your login credentials are never involved." },
    { q:'How long does setup take?', a:'Under 2 minutes. Export your CSV, upload it, and your full dashboard is ready. No configuration, no integrations.' },
    { q:'Is my earnings data private?', a:"Your data is stored only in your account. It's never shared, sold, or visible to anyone else." },
  ]

  const ticker = ['🐳 Whale fan detected','📈 +34% earnings this week','⚡ Peak hour in 20 min','🎯 Goal: 847/1000 tokens','💰 $88 session — top 20%','🔥 Session pace: HOT','⚠️ Fan churn risk flagged','🐳 Whale fan detected','📈 +34% earnings this week','⚡ Peak hour in 20 min','🎯 Goal: 847/1000 tokens','💰 $88 session — top 20%']

  return (
    <>
      <style>{css}</style>
      <div style={{ background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", overflowX:'hidden' }}>

        {/* NAV */}
        <nav style={{ position:'sticky', top:0, zIndex:100, padding:'0 40px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', background:scrolled?'rgba(5,7,15,0.92)':'transparent', backdropFilter:scrolled?'blur(20px)':'none', borderBottom:scrolled?`1px solid ${C.border}`:'none', transition:'all 0.3s' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.white }}>Cam<span style={{ color:C.cyan }}>Cash</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:28 }}>
            <a href="/blog/cam-model-earnings" className="nav-link">Blog</a>
            <a href="/guides/chaturbate-earnings-tracker" className="nav-link">Guides</a>
            <button onClick={() => go('/login')} className="cta-btn" style={{ padding:'9px 24px', fontSize:14, animation:'none' }}>Start Free →</button>
          </div>
        </nav>

        {/* HERO */}
        <section style={{ padding:'90px 40px 70px', maxWidth:1200, margin:'0 auto', position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:700, background:`radial-gradient(ellipse 60% 50% at 60% 40%,rgba(34,211,238,0.06) 0%,transparent 70%),radial-gradient(ellipse 40% 40% at 80% 20%,rgba(236,72,153,0.05) 0%,transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.1fr', gap:60, alignItems:'center', position:'relative' }}>
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:20, background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.2)', fontSize:12, color:C.cyan, fontWeight:600, marginBottom:28 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:C.green, boxShadow:`0 0 8px ${C.green}` }} />
                Free during beta — all features unlocked
              </div>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(34px,4vw,54px)', fontWeight:800, color:C.white, lineHeight:1.1, marginBottom:24, letterSpacing:'-0.02em' }}>
                The Cam Model Analytics Tool That{' '}
                <span style={{ background:`linear-gradient(135deg,${C.cyan},${C.pink})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  Makes You More Money
                </span>
              </h1>
              <p style={{ fontSize:18, lineHeight:1.7, color:C.text, marginBottom:36, maxWidth:500 }}>
                Upload your Chaturbate or BongaCams CSV and instantly see your peak earning hours, top fans, session breakdowns, and exactly what to do to increase your income.
              </p>
              <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', marginBottom:36 }}>
                <button onClick={() => go('/login')} className="cta-btn">Upload My CSV — It's Free</button>
                <button onClick={() => go('/login')} className="cta-ghost">See a Demo →</button>
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {['No credit card','Chaturbate & BongaCams','2-min setup','Private & secure'].map(t => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:C.muted }}>
                    <span style={{ color:C.green }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ animation:'float 6s ease-in-out infinite', position:'relative' }}>
              <div style={{ position:'absolute', inset:0, borderRadius:16, overflow:'hidden', pointerEvents:'none', zIndex:2 }}>
                <div style={{ position:'absolute', left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(34,211,238,0.4),transparent)', animation:'scan 4s linear infinite' }} />
              </div>
              <DashboardMockup />
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:'14px 0', background:'rgba(255,255,255,0.01)', overflow:'hidden' }}>
          <div className="ticker-track">
            {ticker.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, fontSize:13, color:C.muted, whiteSpace:'nowrap', fontWeight:500 }}>
                {item}<span style={{ color:C.border, fontSize:20 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* STATS */}
        <section ref={setRef('stats')} style={{ padding:'80px 40px', maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:40, ...fadeIn('stats') }}>
            {[
              { num:12680, suffix:'+', label:'Tips analyzed', color:C.cyan },
              { num:3973, prefix:'$', label:'Revenue tracked', color:C.green },
              { num:5, suffix:' platforms', label:'Supported', color:C.pink },
            ].map(({ num, prefix, suffix, label, color }) => (
              <div key={label}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:48, fontWeight:800, color, marginBottom:8 }}>
                  <Counter end={num} prefix={prefix||''} suffix={suffix||''} />
                </div>
                <div style={{ fontSize:15, color:C.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* PROBLEM */}
        <section ref={setRef('problem')} style={{ padding:'80px 40px', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52, ...fadeIn('problem') }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, color:C.white, lineHeight:1.2, marginBottom:16 }}>
              You're Working Hard.<br />But Are You Working <span style={{ color:C.red }}>Smart?</span>
            </h2>
            <p style={{ fontSize:18, color:C.text, maxWidth:580, margin:'0 auto' }}>
              Most cam models leave real money on the table — not from lack of effort, but from making decisions without data.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {[
              { icon:'🕐', pain:'Streaming at the wrong hours', detail:"Your peak earning window isn't when it's convenient — it's when your fans are online. The $/hr difference can be 50%+.", color:C.red },
              { icon:'👤', pain:'Losing whale fans silently', detail:"Your top 15% of fans generate 60–70% of your income. When a whale goes cold, you won't notice until it shows up in your monthly total.", color:C.orange },
              { icon:'📊', pain:'No idea what\'s actually working', detail:"Was that a good session? Is Chaturbate worth more than BongaCams for your audience? Without data, you're guessing.", color:C.gold },
            ].map(({ icon, pain, detail, color }, i) => (
              <div key={i} className="fcard" style={{ ...fadeIn('problem', i*120), borderColor:`${color}20` }}>
                <div style={{ fontSize:32, marginBottom:14 }}>{icon}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:C.white, marginBottom:10 }}>{pain}</div>
                <p style={{ fontSize:14, color:C.text, lineHeight:1.7 }}>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOLUTION */}
        <section ref={setRef('solution')} style={{ padding:'80px 40px', maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
            <div style={{ ...fadeIn('solution') }}>
              <div style={{ fontSize:12, color:C.cyan, fontWeight:700, textTransform:'uppercase', letterSpacing:2, marginBottom:16 }}>The Solution</div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:38, fontWeight:800, color:C.white, lineHeight:1.2, marginBottom:20 }}>
                Your Data Already Has the Answers.{' '}
                <span style={{ color:C.cyan }}>CamCash Reads Them.</span>
              </h2>
              <p style={{ fontSize:17, color:C.text, lineHeight:1.8, marginBottom:28 }}>
                Upload your CSV and get a complete picture — peak hours specific to your audience, fan loyalty tracking, session breakdowns, platform comparison, and personalized recommendations. All from data you already have.
              </p>
              <button onClick={() => go('/login')} className="cta-btn" style={{ fontSize:15 }}>Analyze My Earnings →</button>
            </div>
            <div style={{ ...fadeIn('solution', 200) }}><FanTableMockup /></div>
          </div>
        </section>

        {/* FEATURES */}
        <section ref={setRef('features')} style={{ padding:'80px 40px', maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52, ...fadeIn('features') }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, color:C.white, marginBottom:14 }}>Everything You Need to Earn More</h2>
            <p style={{ fontSize:17, color:C.text, maxWidth:520, margin:'0 auto' }}>Not generic analytics. Every feature is built around how cam model income actually works.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {features.map(({ icon, title, outcome, body, color }, i) => (
              <div key={title} className="fcard" style={{ ...fadeIn('features', i*80) }}>
                <div style={{ width:48, height:48, borderRadius:12, background:`${color}15`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:16 }}>{icon}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:C.white, marginBottom:6 }}>{title}</div>
                <div style={{ fontSize:13, color, fontWeight:600, marginBottom:10 }}>→ {outcome}</div>
                <p style={{ fontSize:14, color:C.text, lineHeight:1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SESSION VISUAL */}
        <section ref={setRef('session')} style={{ padding:'60px 40px', maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
            <div style={{ ...fadeIn('session', 100) }}><SessionMockup /></div>
            <div style={{ ...fadeIn('session') }}>
              <div style={{ fontSize:12, color:C.purple, fontWeight:700, textTransform:'uppercase', letterSpacing:2, marginBottom:16 }}>Session Breakdown</div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:34, fontWeight:800, color:C.white, lineHeight:1.2, marginBottom:20 }}>Know Exactly What Happened in Every Stream</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Timeline analysis', detail:'See when every tip came in — 5-minute buckets with your peak moment highlighted in gold', color:C.gold },
                  { label:'Revenue velocity', detail:'First vs second half $/min — know if your session momentum is building or dying', color:C.cyan },
                  { label:'Revenue gap', detail:'Every session shows ⚠️ $38 below avg or ✅ $22 above — never wonder again', color:C.green },
                ].map(({ label, detail, color }) => (
                  <div key={label} style={{ display:'flex', gap:14, padding:'14px 18px', borderRadius:12, background:`${color}08`, border:`1px solid ${color}20` }}>
                    <div style={{ width:4, borderRadius:2, background:color, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:13, color:C.text }}>{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section ref={setRef('how')} style={{ padding:'80px 40px', maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <div style={{ ...fadeIn('how'), marginBottom:52 }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, color:C.white, marginBottom:12 }}>Ready in 2 Minutes</h2>
            <p style={{ fontSize:17, color:C.text }}>No integrations. No API keys. No platform access. Just your CSV.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, position:'relative' }}>
            <div style={{ position:'absolute', top:28, left:'16%', right:'16%', height:1, background:`linear-gradient(90deg,${C.cyan}40,${C.purple}40,${C.pink}40)`, zIndex:0 }} />
            {[
              { num:'01', icon:'📤', title:'Export Your CSV', body:'Go to your Chaturbate or BongaCams account, download your token or earnings history. Takes 30 seconds. No API, no account access.' },
              { num:'02', icon:'⚡', title:'Upload to CamCash', body:'Drop your file. CamCash processes your entire tip history instantly — peak hours, fan rankings, session breakdowns, all of it.' },
              { num:'03', icon:'📈', title:'See What to Do Next', body:'Your dashboard shows exactly when to stream, which fans to re-engage, and how each session compares to your average.' },
            ].map(({ num, icon, title, body }, i) => (
              <div key={num} style={{ ...fadeIn('how', i*150), position:'relative', zIndex:1 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:`linear-gradient(135deg,${C.cyan}20,${C.purple}20)`, border:`1px solid rgba(34,211,238,0.3)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 20px' }}>{icon}</div>
                <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Step {num}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:C.white, marginBottom:10 }}>{title}</div>
                <p style={{ fontSize:14, color:C.text, lineHeight:1.7 }}>{body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:48, ...fadeIn('how', 400) }}>
            <button onClick={() => go('/login')} className="cta-btn">Upload My First CSV — Free →</button>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section ref={setRef('testimonials')} style={{ padding:'80px 40px', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48, ...fadeIn('testimonials') }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:800, color:C.white, marginBottom:12 }}>Real Models. Real Results.</h2>
            <p style={{ fontSize:16, color:C.text }}>What happens when cam models actually look at their data.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
            {testimonials.map(({ quote, name, detail, stat, statColor }, i) => (
              <div key={i} className="tcard" style={{ ...fadeIn('testimonials', i*100) }}>
                <div style={{ fontSize:28, fontWeight:900, color:statColor, fontFamily:"'Syne',sans-serif", marginBottom:12 }}>{stat}</div>
                <p style={{ fontSize:15, color:C.text, lineHeight:1.7, marginBottom:20, fontStyle:'italic' }}>"{quote}"</p>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.white }}>{name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section ref={setRef('faq')} style={{ padding:'80px 40px', maxWidth:720, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48, ...fadeIn('faq') }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:800, color:C.white }}>Questions Answered</h2>
          </div>
          <div style={{ ...fadeIn('faq', 100) }}>
            {faqs.map(({ q, a }, i) => (
              <div key={i} className="faq-q">
                <button onClick={() => setOpenFaq(openFaq===i?null:i)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 0', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:16, fontWeight:600, color:C.white }}>{q}</span>
                  <span style={{ color:C.cyan, fontSize:20, transition:'transform 0.3s', transform:openFaq===i?'rotate(45deg)':'rotate(0)' }}>+</span>
                </button>
                <div style={{ maxHeight:openFaq===i?200:0, overflow:'hidden', transition:'max-height 0.35s ease' }}>
                  <p style={{ paddingBottom:20, fontSize:15, color:C.text, lineHeight:1.7 }}>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section ref={setRef('cta')} style={{ padding:'100px 40px', textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 60% at 50% 50%,rgba(34,211,238,0.07) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 30% 30%,rgba(236,72,153,0.05) 0%,transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ position:'relative', maxWidth:700, margin:'0 auto', ...fadeIn('cta') }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:20, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', fontSize:12, color:C.gold, fontWeight:600, marginBottom:28 }}>
              🎉 Free during beta — all features, no limits
            </div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(34px,5vw,54px)', fontWeight:800, color:C.white, lineHeight:1.1, marginBottom:20, letterSpacing:'-0.02em' }}>
              Stop Guessing.<br />
              <span style={{ background:`linear-gradient(135deg,${C.cyan},${C.pink})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Start Earning Smarter.</span>
            </h2>
            <p style={{ fontSize:18, color:C.text, lineHeight:1.7, marginBottom:40 }}>
              Your earnings data already has the answers. Upload your CSV in 2 minutes and see exactly what's driving your income — and what's holding it back.
            </p>
            <button onClick={() => go('/login')} className="cta-btn" style={{ fontSize:18, padding:'18px 52px' }}>
              Upload My CSV — It's Free
            </button>
            <div style={{ marginTop:24, display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap' }}>
              {['No credit card','Chaturbate & BongaCams','Private & secure'].map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:C.muted }}>
                  <span style={{ color:C.green }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop:`1px solid ${C.border}`, padding:'48px 40px' }}>
          <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:40 }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:C.white, marginBottom:12 }}>Cam<span style={{ color:C.cyan }}>Cash</span></div>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.7, maxWidth:260 }}>Free cam model analytics for Chaturbate, BongaCams, and more. Upload your CSV, understand your data, earn more.</p>
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Guides</div>
              {[['Chaturbate Earnings','/guides/chaturbate-earnings-tracker'],['Cam Model Analytics','/guides/cam-model-analytics'],['Top Tippers','/guides/cam-model-top-tippers'],['BongaCams Analytics','/guides/bongacams-analytics']].map(([label, href]) => (
                <a key={href} href={href} className="footer-link">{label}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Blog</div>
              {[['Increase Earnings','/blog/how-to-increase-cam-earnings'],['Chaturbate Strategies','/blog/how-to-make-more-money-on-chaturbate'],['Why Streams Fail','/blog/why-cam-streams-arent-making-money'],['Best Cam Tools','/blog/best-cam-model-tools']].map(([label, href]) => (
                <a key={href} href={href} className="footer-link">{label}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Platforms</div>
              {['Chaturbate','BongaCams','MyFreeCams','CamSoda','Stripchat'].map(p => (
                <div key={p} style={{ fontSize:14, color:C.muted, marginBottom:8 }}>{p}</div>
              ))}
            </div>
          </div>
          <div style={{ maxWidth:1100, margin:'32px auto 0', paddingTop:24, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ fontSize:13, color:C.muted }}>© 2026 CamCash — Built for cam models who want to grow</div>
            <div style={{ fontSize:13, color:C.muted }}>No ads. No data selling. Ever.</div>
          </div>
        </footer>

      </div>
    </>
  )
}
