"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const G = {
  bg:"#05050f", bg1:"#090918", bg2:"#0e0e22", bg3:"#13132d",
  border:"#1a1a3e", border2:"#252550",
  glow:"#c084fc", glow2:"#e879f9", teal:"#2dd4bf",
  gold:"#fbbf24", green:"#34d399", pink:"#f472b6",
  white:"#faf5ff", med:"#a78bca", dim:"#5b4d7a",
}

const features = [
  { icon:"💰", title:"Earnings Tracking", desc:"Total USD, tokens, avg tip, best day, best month — every metric that matters tracked automatically." },
  { icon:"🐳", title:"Whale & Tipper CRM", desc:"Auto-classify your fans as Whales, Sharks, or Regulars. Add notes, flag follow-ups, track last tip dates." },
  { icon:"⏰", title:"Peak Hour Analysis", desc:"See exactly which hours generate the most tokens so you can schedule your streams for maximum earnings." },
  { icon:"📈", title:"Trend Analytics", desc:"Daily charts, monthly breakdowns, cumulative earnings curves, and platform-by-platform comparison." },
  { icon:"🌐", title:"Multi-Platform", desc:"Import from Chaturbate, BongaCams, and MyFreeCams. All your data unified in one dashboard." },
  { icon:"🔒", title:"100% Private", desc:"Your data is encrypted and isolated. We literally cannot see it — enforced at the database level." },
]

const stats = [
  { value:"6+", label:"Metrics tracked" },
  { value:"3", label:"Platforms supported" },
  { value:"100%", label:"Data privacy" },
  { value:"Free", label:"To get started" },
]

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div style={{ minHeight:"100vh", background:G.bg, fontFamily:"'Syne', sans-serif", overflowX:"hidden" }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:100,
        padding:"0 40px", height:64,
        background: scrolled ? `${G.bg1}ee` : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${G.border}` : "1px solid transparent",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        transition:"all 0.3s",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:"linear-gradient(135deg, #c084fc, #e879f9)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, boxShadow:"0 0 20px #c084fc50",
          }}>✦</div>
          <span style={{ fontSize:18, fontWeight:800, color:G.white, letterSpacing:"-0.02em" }}>
            Glow<span style={{ color:G.glow }}>Metrics</span>
          </span>
        </div>

        <div style={{ display:"flex", gap:12 }}>
          <button onClick={() => router.push("/login")}
            style={{ padding:"9px 20px", borderRadius:8, border:`1px solid ${G.border2}`, background:"transparent", color:G.med, fontSize:14, fontWeight:600, transition:"all 0.2s" }}
            onMouseEnter={e => { e.target.style.borderColor = G.glow; e.target.style.color = G.white }}
            onMouseLeave={e => { e.target.style.borderColor = G.border2; e.target.style.color = G.med }}>
            Log in
          </button>
          <button onClick={() => router.push("/login?mode=signup")}
            style={{ padding:"9px 22px", borderRadius:8, border:"none", background:"linear-gradient(135deg, #c084fc, #e879f9)", color:"#05050f", fontSize:14, fontWeight:700, boxShadow:"0 4px 20px #c084fc40", transition:"all 0.2s" }}
            onMouseEnter={e => e.target.style.boxShadow = "0 6px 30px #c084fc60"}
            onMouseLeave={e => e.target.style.boxShadow = "0 4px 20px #c084fc40"}>
            Get started free →
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"120px 24px 80px", position:"relative", textAlign:"center" }}>

        {/* Background orbs */}
        <div style={{ position:"absolute", top:"20%", left:"10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, #c084fc12 0%, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"10%", right:"5%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, #e879f910 0%, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"40%", right:"20%", width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle, #2dd4bf08 0%, transparent 65%)", pointerEvents:"none" }} />

        {/* Badge */}
        <div className="fade-up" style={{
          display:"inline-flex", alignItems:"center", gap:8, marginBottom:28,
          padding:"6px 16px", borderRadius:100,
          background:`${G.glow}15`, border:`1px solid ${G.glow}30`,
          color:G.glow, fontSize:12, fontWeight:600, letterSpacing:"0.05em",
          fontFamily:"'DM Mono', monospace",
        }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:G.glow, display:"inline-block", animation:"glow-pulse 2s infinite" }} />
          BUILT FOR CAM MODELS
        </div>

        <h1 className="fade-up-1" style={{ fontSize:"clamp(44px, 7vw, 88px)", fontWeight:800, lineHeight:1.05, letterSpacing:"-0.03em", color:G.white, marginBottom:24, maxWidth:900 }}>
          Know your numbers.<br />
          <span style={{
            background:"linear-gradient(135deg, #c084fc 0%, #e879f9 50%, #f472b6 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            backgroundClip:"text",
          }}>Grow your income.</span>
        </h1>

        <p className="fade-up-2" style={{ fontSize:"clamp(16px, 2vw, 20px)", color:G.med, lineHeight:1.7, maxWidth:560, marginBottom:44, fontFamily:"'Space Grotesk', sans-serif", fontWeight:400 }}>
          GlowMetrics turns your tip exports into powerful analytics. Track every token, understand your fans, and find out exactly when and where you earn the most.
        </p>

        <div className="fade-up-3" style={{ display:"flex", gap:14, flexWrap:"wrap", justifyContent:"center", marginBottom:64 }}>
          <button onClick={() => router.push("/login?mode=signup")}
            style={{
              padding:"16px 36px", borderRadius:12, border:"none",
              background:"linear-gradient(135deg, #c084fc, #e879f9)",
              color:"#05050f", fontSize:16, fontWeight:700,
              boxShadow:"0 8px 32px #c084fc40", transition:"all 0.2s",
            }}
            onMouseEnter={e => { e.target.style.transform="translateY(-2px)"; e.target.style.boxShadow="0 12px 40px #c084fc60" }}
            onMouseLeave={e => { e.target.style.transform="translateY(0)"; e.target.style.boxShadow="0 8px 32px #c084fc40" }}>
            Start tracking for free
          </button>
          <button onClick={() => router.push("/login")}
            style={{
              padding:"16px 36px", borderRadius:12,
              border:`1px solid ${G.border2}`, background:"transparent",
              color:G.white, fontSize:16, fontWeight:600, transition:"all 0.2s",
            }}
            onMouseEnter={e => { e.target.style.borderColor=G.glow; e.target.style.background=`${G.glow}10` }}
            onMouseLeave={e => { e.target.style.borderColor=G.border2; e.target.style.background="transparent" }}>
            I already have an account
          </button>
        </div>

        {/* Stats row */}
        <div className="fade-up-4" style={{ display:"flex", gap:0, border:`1px solid ${G.border}`, borderRadius:16, overflow:"hidden", background:G.bg1 }}>
          {stats.map(({ value, label }, i) => (
            <div key={label} style={{
              padding:"20px 40px", textAlign:"center",
              borderRight: i < stats.length - 1 ? `1px solid ${G.border}` : "none",
            }}>
              <div style={{ fontSize:28, fontWeight:800, color:G.glow, letterSpacing:"-0.02em" }}>{value}</div>
              <div style={{ fontSize:12, color:G.dim, marginTop:4, fontFamily:"'DM Mono',monospace", letterSpacing:"0.05em" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section style={{ padding:"100px 24px", maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:64 }}>
          <h2 style={{ fontSize:"clamp(32px, 4vw, 52px)", fontWeight:800, color:G.white, letterSpacing:"-0.02em", marginBottom:16 }}>
            Everything you need to<br />
            <span style={{ color:G.glow }}>understand your business</span>
          </h2>
          <p style={{ fontSize:18, color:G.med, fontFamily:"'Space Grotesk',sans-serif" }}>
            Import your CSV once. Your entire earning history, analyzed instantly.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:20 }}>
          {features.map(({ icon, title, desc }, i) => (
            <div key={title} style={{
              background:G.bg2, border:`1px solid ${G.border}`,
              borderRadius:16, padding:"28px 28px 24px",
              transition:"all 0.3s", cursor:"default",
              position:"relative", overflow:"hidden",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = G.glow + "60"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 20px 40px ${G.glow}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}>
              <div style={{ position:"absolute", top:0, right:0, width:100, height:100, background:`radial-gradient(circle at top right, ${G.glow}08 0%, transparent 70%)`, pointerEvents:"none" }} />
              <div style={{ fontSize:32, marginBottom:16 }}>{icon}</div>
              <h3 style={{ fontSize:18, fontWeight:700, color:G.white, marginBottom:10, letterSpacing:"-0.01em" }}>{title}</h3>
              <p style={{ fontSize:14, color:G.med, lineHeight:1.65, fontFamily:"'Space Grotesk',sans-serif" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ padding:"80px 24px", background:G.bg1, borderTop:`1px solid ${G.border}`, borderBottom:`1px solid ${G.border}` }}>
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ fontSize:"clamp(28px, 4vw, 46px)", fontWeight:800, color:G.white, letterSpacing:"-0.02em", marginBottom:56 }}>
            Up and running in <span style={{ color:G.glow }}>3 steps</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:32 }}>
            {[
              ["01", "Create your account", "Sign up with your email. Your dashboard is ready instantly — no credit card needed."],
              ["02", "Export & import your CSV", "Download your earnings CSV from Chaturbate, BongaCams, or MyFreeCams and drop it in."],
              ["03", "See your analytics", "Your full earnings history, tipper CRM, peak hours, and every metric — live instantly."],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{
                  width:56, height:56, borderRadius:"50%", marginBottom:20,
                  background:`linear-gradient(135deg, ${G.glow}20, ${G.glow2}20)`,
                  border:`1px solid ${G.glow}40`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:14, fontWeight:800, color:G.glow,
                  fontFamily:"'DM Mono',monospace",
                }}>{num}</div>
                <h3 style={{ fontSize:18, fontWeight:700, color:G.white, marginBottom:10 }}>{title}</h3>
                <p style={{ fontSize:14, color:G.med, lineHeight:1.65, fontFamily:"'Space Grotesk',sans-serif" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY CALLOUT ──────────────────────────────────────────────── */}
      <section style={{ padding:"80px 24px", maxWidth:800, margin:"0 auto", textAlign:"center" }}>
        <div style={{
          padding:"48px 40px", borderRadius:24,
          background:`linear-gradient(135deg, ${G.bg2} 0%, ${G.bg3} 100%)`,
          border:`1px solid ${G.border}`,
          position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 0%, ${G.glow}08 0%, transparent 60%)`, pointerEvents:"none" }} />
          <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
          <h2 style={{ fontSize:28, fontWeight:800, color:G.white, marginBottom:16, letterSpacing:"-0.02em" }}>
            Your data is yours. Always.
          </h2>
          <p style={{ fontSize:16, color:G.med, lineHeight:1.7, fontFamily:"'Space Grotesk',sans-serif", maxWidth:560, margin:"0 auto 28px" }}>
            GlowMetrics uses database-level row security. Each user's data is completely isolated — it's not just a policy, it's enforced at the database engine itself. We genuinely cannot read your earnings data.
          </p>
          <div style={{ display:"flex", gap:20, justifyContent:"center", flexWrap:"wrap" }}>
            {["End-to-end isolation", "No data sharing", "Delete anytime"].map(label => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:8, color:G.green, fontSize:14, fontFamily:"'DM Mono',monospace" }}>
                <span style={{ color:G.green }}>✓</span> {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding:"80px 24px 120px", textAlign:"center" }}>
        <h2 style={{ fontSize:"clamp(32px, 5vw, 60px)", fontWeight:800, color:G.white, letterSpacing:"-0.03em", marginBottom:20 }}>
          Ready to see your <span style={{ color:G.glow }}>real numbers?</span>
        </h2>
        <p style={{ fontSize:18, color:G.med, marginBottom:40, fontFamily:"'Space Grotesk',sans-serif" }}>
          Free to start. Import your first CSV in under a minute.
        </p>
        <button onClick={() => router.push("/login?mode=signup")}
          style={{
            padding:"18px 48px", borderRadius:14, border:"none",
            background:"linear-gradient(135deg, #c084fc, #e879f9)",
            color:"#05050f", fontSize:18, fontWeight:700,
            boxShadow:"0 8px 40px #c084fc50", transition:"all 0.2s",
          }}
          onMouseEnter={e => { e.target.style.transform="translateY(-3px)"; e.target.style.boxShadow="0 16px 50px #c084fc70" }}
          onMouseLeave={e => { e.target.style.transform="translateY(0)"; e.target.style.boxShadow="0 8px 40px #c084fc50" }}>
          Create your free account →
        </button>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:`1px solid ${G.border}`, padding:"32px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:6, background:"linear-gradient(135deg, #c084fc, #e879f9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>✦</div>
          <span style={{ fontSize:14, fontWeight:700, color:G.med }}>GlowMetrics</span>
        </div>
        <p style={{ fontSize:12, color:G.dim, fontFamily:"'DM Mono',monospace" }}>
          Built for cam models, by someone who gets it.
        </p>
        <button onClick={() => router.push("/login")} style={{ background:"none", border:"none", color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
          Log in →
        </button>
      </footer>
    </div>
  )
}
