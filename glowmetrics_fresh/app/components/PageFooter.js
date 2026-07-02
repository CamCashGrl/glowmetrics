"use client"
import { useState } from "react"

const BLOG_POSTS = [
  { slug: "/blog/how-much-do-cam-models-make",                    icon: "💰", tag: "Earnings",   tagColor: "#10B981", title: "Cam Model Earnings: How Much Do Cam Models Actually Make?",         desc: "Real earnings data — average income, what affects your numbers, and how to increase what you make per stream." },
  { slug: "/blog/how-much-do-chaturbate-models-make",    icon: "📊", tag: "Chaturbate", tagColor: "#22D3EE", title: "How Much Do Chaturbate Models Make Per Hour?",                       desc: "Real Chaturbate model earnings data — average $/hr, token payout rates, and what affects your income." },
  { slug: "/blog/how-to-make-more-money-on-chaturbate",  icon: "🔥", tag: "Strategy",   tagColor: "#EC4899", title: "How to Make More Money on Chaturbate",                               desc: "Proven strategies to increase your Chaturbate earnings — timing, titles, fan engagement, and platform optimization." },
  { slug: "/blog/how-to-increase-cam-earnings",          icon: "📈", tag: "Income",     tagColor: "#60A5FA", title: "How to Increase Cam Earnings (What Actually Works)",                 desc: "Actionable strategies for increasing your income across any cam platform." },
  { slug: "/blog/how-to-re-engage-whales-and-high-tipping-fans", icon: "🐳", tag: "Fan CRM", tagColor: "#F59E0B", title: "How to Re-Engage Whales and Top Tippers",                            desc: "Your biggest spenders go quiet — here's the playbook to bring them back before they disappear for good." },
  { slug: "/blog/how-to-build-loyal-fans",               icon: "👑", tag: "Retention",  tagColor: "#7C5CFF", title: "How to Build a Loyal Fanbase as a Cam Model",                        desc: "The difference between a one-time tipper and a whale who tips every stream — and how to create more of the latter." },
  { slug: "/blog/how-to-get-views-on-chaturbate",        icon: "👁️", tag: "Growth",    tagColor: "#FB923C", title: "How to Get More Views on Chaturbate",                                desc: "What actually drives viewers to your room — tags, titles, timing, and the algorithm." },
  { slug: "/blog/how-to-get-more-tips-on-myfreecams",    icon: "💎", tag: "MFC",        tagColor: "#A78BFA", title: "How to Get More Tips on MyFreeCams",                                 desc: "MFC-specific strategies for increasing tips, growing your fanbase, and maximizing token earnings." },
  { slug: "/blog/why-cam-income-is-inconsistent",        icon: "🎢", tag: "Income",     tagColor: "#60A5FA", title: "Why Cam Income Is Inconsistent (And How to Fix It)",                 desc: "Most cam models earn inconsistently without knowing why. Here's how to identify your patterns and stabilize your income." },
  { slug: "/blog/why-cam-streams-arent-making-money",    icon: "🚫", tag: "Earnings",   tagColor: "#F87171", title: "Why Your Cam Streams Aren't Making Money",                            desc: "The most common reasons streams underperform — and exactly what to fix." },
  { slug: "/blog/cam-model-taxes",                       icon: "🧾", tag: "Business",   tagColor: "#64748B", title: "Cam Model Taxes: What You Need to Know",                             desc: "A practical guide to taxes as a cam model — what to track, what to deduct, and how to stay organized." },
  { slug: "/blog/best-cam-model-tools",                  icon: "⚡", tag: "Tools",      tagColor: "#F59E0B", title: "Best Cam Model Tools for Earnings Optimization",                     desc: "The tools that actually move the needle — analytics, title generators, fan tracking, and what serious creators use." },
  { slug: "/blog/how-to-re-engage-whales-and-high-tipping-fans", icon: "💌", tag: "Fan CRM", tagColor: "#EC4899", title: "Re-Engaging High-Tipping Fans Who've Gone Quiet",           desc: "Step-by-step messaging and re-engagement tactics for fans who used to tip but haven't shown up lately." },
  { slug: "/blog/how-to-get-veiwers-on-chaturbate",      icon: "🎯", tag: "Chaturbate", tagColor: "#22D3EE", title: "How to Get Viewers on Chaturbate (Fast)",                            desc: "Practical tactics to get more eyes on your room and convert viewers into tippers." },
  { slug: "/blog/why-you-arent-making-money-on-chaturbate", icon: "🔍", tag: "Chaturbate", tagColor: "#F87171", title: "Why You Aren't Making Money on Chaturbate",                    desc: "An honest breakdown of the most common mistakes that kill earnings on Chaturbate." },
]

const GUIDES = [
  { slug: "/guides/chaturbate-earnings-tracker",  title: "Chaturbate Earnings Tracker Guide" },
  { slug: "/guides/cam-model-analytics",          title: "Cam Model Analytics Guide" },
]

export default function PageFooter({ variant = "landing" }) {
  const isDashboard = variant === "dashboard"
  const [name, setName]       = useState("")
  const [email, setEmail]     = useState("")
  const [msg, setMsg]         = useState("")
  const [sent, setSent]       = useState(false)
  const [sending, setSending] = useState("")

  const handleContact = async (e) => {
    e.preventDefault()
    if (!email || !msg) return
    setSending(true)
    try {
      await fetch("https://formspree.io/f/xwkgpblo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message: msg }),
      })
    } catch {}
    setSent(true)
    setSending(false)
  }

  const inp = {
    width: "100%", padding: "10px 14px", borderRadius: 9,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#F1F5F9", fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif",
    boxSizing: "border-box", transition: "border-color 0.15s",
  }

  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1, background: isDashboard ? "rgba(6,9,20,0.6)" : "#05070f" }}>

      {/* ── BLOG SECTION ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isDashboard ? "40px 32px 36px" : "56px 40px 44px" }}>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Resources</div>
            <div style={{ fontSize: isDashboard ? 18 : 22, fontWeight: 900, color: "#F1F5F9", letterSpacing: -0.5 }}>Learn how to earn more</div>
          </div>
          <a href="/blog" style={{ fontSize: 12, color: "#22D3EE", textDecoration: "none", fontWeight: 600 }}>View all →</a>
        </div>

        {/* Blog grid — 3 cols desktop, 2 tablet, 1 mobile */}
        <div className="footer-blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {BLOG_POSTS.map((post) => (
            <a key={post.slug} href={post.slug} style={{ textDecoration: "none" }}>
              <div
                style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.045)"; e.currentTarget.style.borderColor = post.tagColor + "30" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{post.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: post.tagColor + "15", color: post.tagColor, border: "1px solid " + post.tagColor + "25", textTransform: "uppercase", letterSpacing: 0.5 }}>{post.tag}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.4 }}>{post.title}</div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.55, flex: 1 }}>{post.desc}</div>
                <div style={{ fontSize: 11, color: post.tagColor, fontWeight: 600, marginTop: 4 }}>Read →</div>
              </div>
            </a>
          ))}
        </div>

        {/* Guides strip */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 44 }}>
          {GUIDES.map(g => (
            <a key={g.slug} href={g.slug} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, background: "rgba(124,92,255,0.08)", border: "1px solid rgba(124,92,255,0.2)", color: "#A78BFA", fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(124,92,255,0.15)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(124,92,255,0.08)"}>
              📖 {g.title}
            </a>
          ))}
        </div>

        {/* ── CONTACT + LINKS ── */}
        <div className="footer-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 40 }}>

          {/* Contact form */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#F1F5F9", marginBottom: 4 }}>Contact Us</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 18 }}>Questions, partnerships, or feedback — we read everything.</div>
            {sent ? (
              <div style={{ padding: "18px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>Message sent!</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>We'll reply within 24 hours.</div>
              </div>
            ) : (
              <form onSubmit={handleContact} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <input type="text" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} style={inp}
                  onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                <input type="email" placeholder="Email address *" required value={email} onChange={e => setEmail(e.target.value)} style={inp}
                  onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                <textarea placeholder="Your message *" required rows={3} value={msg} onChange={e => setMsg(e.target.value)}
                  style={{ ...inp, resize: "vertical" }}
                  onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                <button type="submit" disabled={!!sending} style={{ padding: "10px 0", borderRadius: 9, background: sending ? "rgba(34,211,238,0.2)" : "linear-gradient(135deg,#22D3EE,#EC4899)", border: "none", color: "white", fontWeight: 700, fontSize: 13, cursor: sending ? "not-allowed" : "pointer", boxShadow: sending ? "none" : "0 0 18px rgba(34,211,238,0.25)" }}>
                  {sending ? "Sending…" : "Send Message →"}
                </button>
              </form>
            )}
          </div>

          {/* Right: logo + nav links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "white" }}>$</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#F1F5F9" }}>
                Cam<span style={{ background: "linear-gradient(90deg,#22D3EE,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.7 }}>
              The analytics platform built for cam models.<br/>
              Know exactly when to stream, who to prioritize,<br/>
              and where you earn the most.
            </div>

            {/* Nav links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
              {[
                ["/landing", "Home"],
                ["/landing/demo", "Live Demo"],
                ["/dashboard", "Dashboard"],
                ["/blog", "Blog"],
                ["/blog/how-much-do-cam-models-make", "Earnings Guide"],
                ["/blog/best-cam-model-tools", "Tools"],
                ["/guides/cam-model-analytics", "Analytics Guide"],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 12, color: "#475569", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#94A3B8"}
                  onMouseLeave={e => e.currentTarget.style.color = "#475569"}>
                  {label}
                </a>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {["🔒 Private analytics", "✓ No credit card", "✓ Free during beta"].map(t => (
                <span key={t} style={{ fontSize: 10, color: "#334155" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Legal footer */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#1e3a52" }}>© 2026 CamCash — Built for cam models who want to grow</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[["Privacy Policy", "#"], ["Terms", "#"]].map(([label, href]) => (
              <a key={label} href={href} style={{ fontSize: 11, color: "#1e3a52", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .footer-blog-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .footer-bottom-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 580px) {
          .footer-blog-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
