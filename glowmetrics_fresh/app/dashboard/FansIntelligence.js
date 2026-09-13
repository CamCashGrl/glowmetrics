"use client"

import React, { useMemo, useState, useEffect } from "react"

const C = {
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  blue: "#60A5FA", green: "#10B981", red: "#F87171", orange: "#FB923C",
  white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const TIER_COLORS = {
  Whale: C.gold,
  Shark: C.blue,
  Regular: C.cyan,
  Dormant: C.orange,
}

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shortMoney = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
const dateOf = (t) => new Date(t?.date_time || t?.dateRaw || 0)
const fanKey = (platform, username) => `${platform || "unknown"}:${String(username || "").trim().toLowerCase()}`

function periodStart(period) {
  const now = new Date()
  if (period === "daily") return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (period === "weekly") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (period === "monthly") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return null
}

function relativeTime(date) {
  const ms = Date.now() - date.getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function PodiumFan({ fan, rank, onView }) {
  if (!fan) return <div className="cc-fan-podium cc-fan-podium-empty" />
  const tierColor = TIER_COLORS[fan.tier] || C.cyan
  return (
    <button className={`cc-fan-podium cc-fan-podium-${rank}`} onClick={() => onView(fan)}>
      <div className="cc-podium-rank">#{rank}</div>
      <div className="cc-podium-orb" style={{ borderColor: `${tierColor}88`, boxShadow: `0 0 28px ${tierColor}22, inset 0 0 24px ${tierColor}14` }}>
        <span>{String(fan.username || "?").charAt(0).toUpperCase()}</span>
      </div>
      <div className="cc-podium-name">{fan.username}</div>
      <div className="cc-podium-platform">{fan.platform || "Unknown"}</div>
      <div className="cc-podium-value">{money(fan.totalUSD)}</div>
      <div className="cc-podium-tips">{fan.tipCount} tips</div>
    </button>
  )
}

export default function FansIntelligence({
  analytics,
  tips = [],
  whales = [],
  isPro,
  onViewFan,
  onMessageFan,
  onAddNote,
  onSearch,
  onUpgrade,
}) {
  const [period, setPeriod] = useState("lifetime")
  const [platform, setPlatform] = useState("ALL")
  const [tier, setTier] = useState("ALL")
  const [feedFilter, setFeedFilter] = useState("ALL")
  const [liveTick, setLiveTick] = useState(0)

  // This is intentionally a display heartbeat. It lets relative timestamps and
  // the live feed update without polling or changing the application's data layer.
  useEffect(() => {
    const id = setInterval(() => setLiveTick(v => v + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const allPlatforms = useMemo(() => {
    const fromTips = tips.map(t => t.platform).filter(Boolean)
    const fromWhales = whales.map(w => w.platform).filter(Boolean)
    return [...new Set([...fromTips, ...fromWhales])]
  }, [tips, whales])

  const whaleByKey = useMemo(() => {
    const map = new Map()
    whales.forEach(w => map.set(fanKey(w.platform, w.username), w))
    return map
  }, [whales])

  const leaderboard = useMemo(() => {
    if (period === "lifetime") {
      return whales
        .filter(w => platform === "ALL" || w.platform === platform)
        .filter(w => tier === "ALL" || w.tier === tier)
        .map(w => ({ ...w, _value: Number(w.totalUSD || 0), _tips: Number(w.tipCount || 0), _period: "lifetime" }))
        .sort((a, b) => b._value - a._value)
    }

    const start = periodStart(period)
    const map = new Map()
    tips.forEach(t => {
      const dt = dateOf(t)
      if (!start || dt < start) return
      if (platform !== "ALL" && t.platform !== platform) return
      const username = String(t.username || "").trim()
      if (!username) return
      const key = fanKey(t.platform, username)
      const existing = map.get(key) || { username, platform: t.platform, _value: 0, _tips: 0 }
      existing._value += Number(t.usd || 0)
      existing._tips += 1
      map.set(key, existing)
    })

    return [...map.values()]
      .map(f => ({
        ...f,
        totalUSD: f._value,
        tipCount: f._tips,
        avgTipSize: f._tips ? f._value / f._tips : 0,
        ...(whaleByKey.get(fanKey(f.platform, f.username)) || {}),
        _value: f._value,
        _tips: f._tips,
        _period: period,
      }))
      .filter(f => tier === "ALL" || f.tier === tier)
      .sort((a, b) => b._value - a._value)
  }, [period, platform, tier, tips, whales, whaleByKey])

  const feed = useMemo(() => {
    const sorted = [...tips]
      .filter(t => t.username && (platform === "ALL" || t.platform === platform))
      .sort((a, b) => dateOf(b) - dateOf(a))
      .slice(0, 16)
    return sorted.map((t, index) => {
      const existing = whaleByKey.get(fanKey(t.platform, t.username))
      const age = Date.now() - dateOf(t).getTime()
      return {
        ...t,
        _existing: existing,
        _new: index < 4 && age >= 0 && age < 30 * 60 * 1000,
        _age: age,
      }
    }).filter(t => {
      if (feedFilter === "NEW") return t._new
      if (feedFilter === "TOP") return Number(t.usd || 0) >= Math.max(1, ...tips.slice(0, 50).map(x => Number(x.usd || 0))) * 0.5
      return true
    })
  }, [tips, platform, feedFilter, whaleByKey, liveTick])

  const total = leaderboard.reduce((sum, f) => sum + Number(f._value || 0), 0)
  const top = leaderboard.slice(0, 3)
  const topFanKeys = new Set(top.map(f => fanKey(f.platform, f.username)))
  const rest = leaderboard.slice(3, 10)
  const activeFanCount = new Set(tips.filter(t => platform === "ALL" || t.platform === platform).map(t => fanKey(t.platform, t.username))).size
  const latestTip = feed[0]

  const renderFanRow = (fan, index) => {
    const tierColor = TIER_COLORS[fan.tier] || C.cyan
    const share = total > 0 ? (Number(fan._value || 0) / total) * 100 : 0
    return (
      <div className="cc-fan-row" key={`${fanKey(fan.platform, fan.username)}-${period}-${index}`} style={{ "--fan-accent": tierColor, "--fan-delay": `${index * 45}ms` }}>
        <div className="cc-fan-rank">{index + 4}</div>
        <div className="cc-fan-avatar" style={{ borderColor: `${tierColor}55`, background: `linear-gradient(145deg, ${tierColor}20, rgba(255,255,255,.035))` }}>
          {String(fan.username || "?").charAt(0).toUpperCase()}
        </div>
        <button className="cc-fan-identity" onClick={() => onViewFan?.(fan)}>
          <strong>{fan.username}</strong>
          <span>{fan.platform || "Unknown"} · {fan.tier || "Supporter"}</span>
        </button>
        <div className="cc-fan-share">
          <div className="cc-fan-share-track"><span style={{ width: `${Math.min(100, share)}%` }} /></div>
          <small>{share.toFixed(0)}% of period</small>
        </div>
        <div className="cc-fan-row-stat"><strong>{shortMoney(fan._value)}</strong><span>{fan._tips} tips</span></div>
        <div className="cc-fan-row-actions">
          <button onClick={() => onViewFan?.(fan)} title="View fan">View</button>
          <button onClick={() => onMessageFan?.(fan)} title="Message fan">✉</button>
          <button onClick={() => onAddNote?.(fan.username)} title="Add note">＋</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cc-fans-intelligence">
      <style>{`
        .cc-fans-intelligence{position:relative;padding-bottom:30px;color:${C.white};}
        .cc-fans-intelligence:before{content:"";position:absolute;inset:0 -24px auto;height:520px;pointer-events:none;background:radial-gradient(circle at 28% 0%,rgba(34,211,238,.10),transparent 36%),radial-gradient(circle at 78% 8%,rgba(236,72,153,.10),transparent 34%);z-index:-1;}
        .cc-fans-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px;}
        .cc-fans-kicker{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${C.cyan};font-weight:800;margin-bottom:5px;}
        .cc-fans-title{margin:0;font-size:23px;line-height:1.1;font-weight:850;letter-spacing:-.5px;}
        .cc-fans-sub{font-size:12px;color:${C.text};margin-top:6px;}
        .cc-live-pill{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(34,211,238,.24);border-radius:999px;background:rgba(34,211,238,.06);font-size:10px;font-weight:800;color:${C.cyan};letter-spacing:.8px;text-transform:uppercase;white-space:nowrap;}
        .cc-live-dot{width:6px;height:6px;border-radius:50%;background:${C.green};box-shadow:0 0 0 4px rgba(16,185,129,.10),0 0 12px rgba(16,185,129,.8);animation:ccLivePulse 1.6s infinite;}
        .cc-fans-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;}
        .cc-segment{display:flex;gap:2px;padding:3px;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:rgba(10,15,27,.72);backdrop-filter:blur(16px);}
        .cc-segment button{border:0;background:transparent;color:${C.text};padding:6px 10px;border-radius:7px;font-size:11px;font-weight:750;cursor:pointer;white-space:nowrap;transition:.18s ease;}
        .cc-segment button.active{color:#06101a;background:linear-gradient(135deg,${C.cyan},${C.indigo} 60%,${C.pink});box-shadow:0 0 18px rgba(34,211,238,.12);}
        .cc-segment button:hover:not(.active){background:rgba(255,255,255,.05);color:${C.white};}
        .cc-fans-hero{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:linear-gradient(145deg,rgba(18,24,38,.88),rgba(9,13,25,.80));box-shadow:0 24px 70px rgba(0,0,0,.30),0 0 50px rgba(34,211,238,.05);padding:17px;margin-bottom:14px;transform:perspective(1100px) rotateX(.5deg);}
        .cc-fans-hero:after{content:"";position:absolute;inset:-1px;background:linear-gradient(110deg,transparent 15%,rgba(34,211,238,.09),transparent 38%,rgba(124,92,255,.08),transparent 68%,rgba(236,72,153,.07),transparent 90%);pointer-events:none;mix-blend-mode:screen;}
        .cc-fans-hero-top{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}
        .cc-fans-hero-title{font-size:12px;font-weight:850;letter-spacing:.9px;text-transform:uppercase;color:${C.white};}
        .cc-fans-hero-meta{font-size:10px;color:${C.muted};}
        .cc-podiums{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1.12fr 1fr;gap:8px;align-items:end;min-height:214px;padding:8px 5%;}
        .cc-fan-podium{position:relative;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.015));padding:13px 8px 11px;color:${C.white};cursor:pointer;transition:transform .24s ease,border-color .24s ease,box-shadow .24s ease;animation:ccFloat 5s ease-in-out infinite;}
        .cc-fan-podium:nth-child(1){animation-delay:-1.2s}.cc-fan-podium:nth-child(3){animation-delay:-2.5s}.cc-fan-podium-1{padding-top:18px;transform:translateY(-10px) scale(1.03);border-color:rgba(245,158,11,.22);box-shadow:0 22px 40px rgba(0,0,0,.25),0 0 36px rgba(245,158,11,.08);}
        .cc-fan-podium:hover{transform:translateY(-7px) scale(1.015);border-color:rgba(34,211,238,.30);box-shadow:0 25px 50px rgba(0,0,0,.35),0 0 32px rgba(34,211,238,.08);}
        .cc-fan-podium-1:hover{transform:translateY(-16px) scale(1.045);}
        .cc-podium-rank{font-size:9px;font-weight:900;color:${C.muted};letter-spacing:1px;margin-bottom:8px;}
        .cc-podium-orb{width:52px;height:52px;margin:0 auto 8px;border-radius:50%;border:1px solid;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.16),rgba(255,255,255,.025) 60%);font-size:18px;font-weight:900;box-shadow:inset 0 0 22px rgba(255,255,255,.03);}
        .cc-fan-podium-1 .cc-podium-orb{width:64px;height:64px;font-size:22px;}
        .cc-podium-name{font-size:12px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.cc-podium-platform{font-size:9px;color:${C.muted};margin-top:2px;}.cc-podium-value{font-size:17px;font-weight:900;margin-top:8px;letter-spacing:-.3px;}.cc-podium-tips{font-size:9px;color:${C.text};margin-top:2px;}
        .cc-fans-live-stat{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px;position:relative;z-index:1;}
        .cc-live-stat{padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);}.cc-live-stat span{display:block;font-size:9px;color:${C.muted};text-transform:uppercase;letter-spacing:.8px}.cc-live-stat strong{display:block;font-size:15px;margin-top:3px;}
        .cc-fans-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.85fr);gap:14px;align-items:start;}
        .cc-fans-panel{border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(13,18,30,.78);backdrop-filter:blur(18px);box-shadow:0 18px 45px rgba(0,0,0,.18);overflow:hidden;}
        .cc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.06);}.cc-panel-title{font-size:12px;font-weight:850;letter-spacing:.6px;text-transform:uppercase;}.cc-panel-sub{font-size:10px;color:${C.muted};margin-top:2px;}
        .cc-fan-row{display:grid;grid-template-columns:25px 34px minmax(120px,1fr) minmax(80px,.7fr) 75px 112px;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.045);animation:ccRowIn .45s ease both;animation-delay:var(--fan-delay);transition:background .18s ease;}.cc-fan-row:hover{background:rgba(255,255,255,.025);}.cc-fan-row:last-child{border-bottom:0;}
        .cc-fan-rank{font-size:10px;font-weight:800;color:${C.muted};text-align:center;}.cc-fan-avatar{width:32px;height:32px;border:1px solid;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:850;}.cc-fan-identity{min-width:0;border:0;background:none;color:${C.white};text-align:left;padding:0;cursor:pointer;}.cc-fan-identity strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.cc-fan-identity span{display:block;font-size:9px;color:${C.muted};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.cc-fan-share-track{height:4px;border-radius:999px;background:rgba(255,255,255,.05);overflow:hidden;}.cc-fan-share-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--fan-accent),${C.indigo},${C.pink});}.cc-fan-share small{font-size:8px;color:${C.muted};}.cc-fan-row-stat{text-align:right;}.cc-fan-row-stat strong{display:block;font-size:11px;}.cc-fan-row-stat span{font-size:8px;color:${C.muted};}.cc-fan-row-actions{display:flex;justify-content:flex-end;gap:4px;}.cc-fan-row-actions button{height:25px;min-width:25px;padding:0 7px;border-radius:7px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:${C.text};font-size:9px;font-weight:750;cursor:pointer;}.cc-fan-row-actions button:first-child{color:${C.cyan};border-color:rgba(34,211,238,.16);}
        .cc-feed{max-height:430px;overflow:auto;}.cc-feed-item{position:relative;display:flex;gap:9px;padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.045);animation:ccFeedIn .5s ease both;}.cc-feed-item:last-child{border-bottom:0;}.cc-feed-item.new{background:linear-gradient(90deg,rgba(34,211,238,.055),transparent 75%);}.cc-feed-dot{width:7px;height:7px;border-radius:50%;margin-top:6px;background:${C.cyan};box-shadow:0 0 12px rgba(34,211,238,.55);flex-shrink:0;}.cc-feed-dot.old{background:${C.muted};box-shadow:none;}.cc-feed-body{min-width:0;flex:1;}.cc-feed-line{font-size:10px;color:${C.text};line-height:1.35;}.cc-feed-line strong{color:${C.white};}.cc-feed-line .amount{color:${C.gold};font-weight:850;}.cc-feed-meta{display:flex;gap:7px;align-items:center;margin-top:3px;font-size:8px;color:${C.muted};}.cc-new-label{font-size:7px;font-weight:900;letter-spacing:.7px;color:${C.green};padding:2px 5px;border-radius:999px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18);}
        .cc-fans-teaser{position:relative;overflow:hidden;padding:14px;margin-top:14px;border-radius:15px;border:1px solid rgba(124,92,255,.20);background:linear-gradient(110deg,rgba(124,92,255,.08),rgba(236,72,153,.055),rgba(34,211,238,.045));}.cc-fans-teaser:before{content:"";position:absolute;width:180px;height:180px;right:-70px;top:-100px;border-radius:50%;background:rgba(236,72,153,.10);filter:blur(20px);}.cc-teaser-content{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;}.cc-teaser-title{font-size:12px;font-weight:850;}.cc-teaser-body{font-size:10px;color:${C.text};margin-top:3px;line-height:1.45;}.cc-teaser-btn{border:0;border-radius:8px;padding:8px 11px;background:linear-gradient(135deg,${C.cyan},${C.indigo} 60%,${C.pink});color:#06101a;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap;}
        .cc-empty{padding:30px 15px;text-align:center;color:${C.muted};font-size:11px;}.cc-empty strong{display:block;color:${C.white};font-size:13px;margin-bottom:4px;}
        @keyframes ccFloat{0%,100%{translate:0 0}50%{translate:0 -5px}}@keyframes ccRowIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes ccFeedIn{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}@keyframes ccLivePulse{0%,100%{opacity:1}50%{opacity:.45}}
        @media(max-width:900px){.cc-fans-grid{grid-template-columns:1fr}.cc-fan-row{grid-template-columns:22px 32px minmax(100px,1fr) 65px 88px}.cc-fan-share{display:none}.cc-podiums{padding:8px 1%;}}
        @media(max-width:640px){.cc-fans-head{align-items:flex-start}.cc-live-pill{display:none}.cc-fans-title{font-size:20px}.cc-podiums{min-height:190px;gap:5px}.cc-fan-podium{padding:10px 5px}.cc-podium-value{font-size:14px}.cc-fan-podium-1 .cc-podium-orb{width:55px;height:55px}.cc-fan-podium-1{transform:translateY(-7px) scale(1.02)}.cc-fans-live-stat{grid-template-columns:1fr 1fr}.cc-fans-live-stat .cc-live-stat:last-child{grid-column:1/-1}.cc-fan-row{grid-template-columns:20px 30px minmax(90px,1fr) 70px}.cc-fan-row-actions{display:none}.cc-teaser-content{align-items:flex-start;flex-direction:column}.cc-teaser-btn{width:100%;}}
      `}</style>

      <div className="cc-fans-head">
        <div>
          <div className="cc-fans-kicker">Fan intelligence</div>
          <h1 className="cc-fans-title">Your fans, in motion</h1>
          <div className="cc-fans-sub">A live view of who is supporting you, where they spend, and what is happening now.</div>
        </div>
        <div className="cc-live-pill"><span className="cc-live-dot" /> Live fan activity</div>
      </div>

      <div className="cc-fans-toolbar">
        <div className="cc-segment" aria-label="Fan leaderboard period">
          {[['lifetime','Lifetime'],['monthly','Month'],['weekly','Week'],['daily','Today']].map(([id,label]) => (
            <button key={id} className={period === id ? 'active' : ''} onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
        {allPlatforms.length > 1 && (
          <div className="cc-segment" aria-label="Platform filter">
            {['ALL', ...allPlatforms].map(p => <button key={p} className={platform === p ? 'active' : ''} onClick={() => setPlatform(p)}>{p === 'ALL' ? 'All platforms' : p}</button>)}
          </div>
        )}
        <div className="cc-segment" aria-label="Fan tier filter">
          {['ALL','Whale','Shark','Regular'].map(t => <button key={t} className={tier === t ? 'active' : ''} onClick={() => setTier(t)}>{t === 'ALL' ? 'All fans' : t}</button>)}
        </div>
        <button onClick={onSearch} style={{ marginLeft:'auto', border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.035)', color:C.text, borderRadius:9, padding:'7px 10px', fontSize:10, fontWeight:750, cursor:'pointer' }}>⌕ Search fan</button>
      </div>

      <section className="cc-fans-hero">
        <div className="cc-fans-hero-top">
          <div><div className="cc-fans-hero-title">Live leaderboard</div><div className="cc-fans-hero-meta">{period === 'lifetime' ? 'Lifetime spend' : `${period[0].toUpperCase()+period.slice(1)} spend`} · ranked from your existing fan data</div></div>
          <div className="cc-fans-hero-meta">{leaderboard.length} ranked</div>
        </div>

        {leaderboard.length > 0 ? (
          <>
            <div className="cc-podiums">
              <PodiumFan fan={top[1]} rank={2} onView={onViewFan} />
              <PodiumFan fan={top[0]} rank={1} onView={onViewFan} />
              <PodiumFan fan={top[2]} rank={3} onView={onViewFan} />
            </div>
            <div className="cc-fans-live-stat">
              <div className="cc-live-stat"><span>Period revenue</span><strong>{money(total)}</strong></div>
              <div className="cc-live-stat"><span>Fans in view</span><strong>{leaderboard.length}</strong></div>
              <div className="cc-live-stat"><span>Latest activity</span><strong>{latestTip ? relativeTime(dateOf(latestTip)) : '—'}</strong></div>
            </div>
          </>
        ) : <div className="cc-empty"><strong>No fan activity in this view yet</strong>Import or connect more fan data to build the leaderboard.</div>}
      </section>

      <div className="cc-fans-grid">
        <section className="cc-fans-panel">
          <div className="cc-panel-head"><div><div className="cc-panel-title">Fan leaderboard</div><div className="cc-panel-sub">Compact ranking · platform context stays attached to every fan</div></div><div style={{fontSize:9,color:C.muted}}>{activeFanCount} unique fans</div></div>
          {rest.length ? rest.map(renderFanRow) : <div className="cc-empty"><strong>More fans will appear here as they tip</strong>The leaderboard is using the same fan records already powering Top Fans.</div>}
        </section>

        <section className="cc-fans-panel">
          <div className="cc-panel-head"><div><div className="cc-panel-title">Fan feed</div><div className="cc-panel-sub">Latest meaningful activity</div></div><div className="cc-segment" style={{padding:2}}>{[['ALL','All'],['NEW','New'],['TOP','Big tips']].map(([id,label]) => <button key={id} className={feedFilter === id ? 'active' : ''} onClick={() => setFeedFilter(id)} style={{padding:'4px 7px',fontSize:9}}>{label}</button>)}</div></div>
          <div className="cc-feed">
            {feed.length ? feed.map((t, i) => (
              <div key={`${fanKey(t.platform,t.username)}-${t.date_time}-${i}`} className={`cc-feed-item ${t._new ? 'new' : ''}`}>
                <span className={`cc-feed-dot ${t._new ? '' : 'old'}`} />
                <div className="cc-feed-body">
                  <div className="cc-feed-line"><strong>{t.username}</strong> tipped <span className="amount">{money(t.usd)}</span></div>
                  <div className="cc-feed-meta"><span>{t.platform || 'Unknown'}</span><span>·</span><span>{relativeTime(dateOf(t))}</span>{t._new && <span className="cc-new-label">NEW ACTIVITY</span>}</div>
                </div>
              </div>
            )) : <div className="cc-empty"><strong>No recent fan activity</strong>Your feed will populate from incoming tip data.</div>}
          </div>
        </section>
      </div>

      {!isPro && (
        <div className="cc-fans-teaser">
          <div className="cc-teaser-content">
            <div><div className="cc-teaser-title">Go deeper with Fan Intelligence</div><div className="cc-teaser-body">Unlock deeper behavior patterns, platform-aware fan signals, and richer re-engagement intelligence without changing the data you already track.</div></div>
            <button className="cc-teaser-btn" onClick={() => onUpgrade?.('fans')}>Unlock Fan Intelligence →</button>
          </div>
        </div>
      )}
    </div>
  )
}
