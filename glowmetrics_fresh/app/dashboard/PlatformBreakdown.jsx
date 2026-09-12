"use client"
import React, { useMemo, useState } from "react"

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45", cyan: "#22D3EE",
  pink: "#EC4899", gold: "#F59E0B", green: "#10B981", white: "#F1F5F9",
  muted: "#64748B", text: "#94A3B8", purple: "#A855F7", red: "#F87171"
}
const PLATFORM_EMOJI = { Chaturbate: "🟣", BongaCams: "🟠", MyFreeCams: "🔵", Stripchat: "🟢", CamSoda: "🔴" }
const money = n => `$${(Number(n) || 0).toFixed(2)}`
const pct = n => `${Math.round(Number(n) || 0)}%`
const dateValue = row => row?.date_time || row?.dateTime || row?.startTime || row?.dateRaw || row?.date
const platformKey = value => String(value || "").trim().toLowerCase()
const samePlatform = (a, b) => platformKey(a) === platformKey(b)
const dateMs = row => { const d = new Date(dateValue(row)); return Number.isFinite(d.getTime()) ? d.getTime() : NaN }
const dateLabel = value => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"
const timeLabel = value => value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"

export default function PlatformBreakdown({
  tips = [], sessions = [], paidSessions = [], profile = null, isPro = false,
  onUpgrade = () => {}, onImport = () => {},
}) {
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [timeRange, setTimeRange] = useState("31D")
  const [detailTab, setDetailTab] = useState("overview")
  const [sessionType, setSessionType] = useState("all")
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  const profilePlatforms = useMemo(() => {
    const raw = profile?.streaming_platforms
    if (Array.isArray(raw)) return raw.filter(Boolean)
    if (typeof raw === "string") {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter(Boolean) : [] }
      catch (_) { return raw.split(",").map(x => x.trim()).filter(Boolean) }
    }
    return []
  }, [profile?.streaming_platforms])

  const platformNames = useMemo(() => {
    const values = [...profilePlatforms, ...tips.map(t => t.platform).filter(Boolean), ...sessions.map(s => s.platform).filter(Boolean), ...paidSessions.map(s => s.platform).filter(Boolean)]
    return [...new Map(values.map(value => [platformKey(value), value])).values()]
  }, [profilePlatforms, tips, sessions, paidSessions])

  // Free gets the recent analysis window; Pro can inspect the full stored history.
  // The database still retains imported history for all tracked platforms.
  const effectiveTimeRange = !isPro && (timeRange === "90D" || timeRange === "ALL") ? "31D" : timeRange
  const cutoff = useMemo(() => {
    if (effectiveTimeRange === "ALL") return null
    const days = effectiveTimeRange === "7D" ? 7 : 31
    return Date.now() - days * 86400000
  }, [effectiveTimeRange])
  const inRange = row => cutoff === null || (Number.isFinite(dateMs(row)) && dateMs(row) >= cutoff)

  const platformData = useMemo(() => platformNames.map(platform => {
    const ptips = tips.filter(t => samePlatform(t.platform, platform) && inRange(t))
    const psessions = sessions.filter(s => samePlatform(s.platform, platform) && inRange(s))
    const ppaid = paidSessions.filter(s => samePlatform(s.platform, platform) && inRange(s))
    const earnings = ptips.reduce((sum, t) => sum + (Number(t.usd) || 0), 0)
    const freeSessionEarnings = psessions.reduce((sum, s) => sum + (Number(s.totalUSD) || 0), 0)
    const privateEarnings = ppaid.reduce((sum, s) => sum + (Number(s.usd) || Number(s.total_usd) || 0), 0)
    const hours = psessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0)
    const allPlatformRows = [...tips.filter(t => samePlatform(t.platform, platform)), ...sessions.filter(s => samePlatform(s.platform, platform)), ...paidSessions.filter(s => samePlatform(s.platform, platform))]
      .map(dateMs).filter(Number.isFinite)
    const firstSeen = allPlatformRows.length ? Math.min(...allPlatformRows) : null
    const lastSeen = allPlatformRows.length ? Math.max(...allPlatformRows) : null
    const historyDays = firstSeen && lastSeen ? Math.max(1, Math.ceil((lastSeen - firstSeen) / 86400000) + 1) : 0
    return {
      platform, earnings, freeSessionEarnings, privateEarnings, totalIdentified: earnings + privateEarnings,
      hours, sessions: psessions.length, privateSessions: ppaid.length,
      uph: hours > 0 ? earnings / hours : 0,
      avgSession: psessions.length ? freeSessionEarnings / psessions.length : 0,
      tipCount: ptips.length, uniqueFans: new Set(ptips.map(t => String(t.username || "unknown").toLowerCase())).size,
      connected: profilePlatforms.some(p => samePlatform(p, platform)),
      historyDays, hasDeeperHistory: historyDays > 31
    }
  }).sort((a, b) => b.totalIdentified - a.totalIdentified), [platformNames, tips, sessions, paidSessions, cutoff, profilePlatforms])

  const comparison = useMemo(() => {
    const active = platformData.filter(p => p.totalIdentified > 0 || p.hours > 0 || p.sessions > 0 || p.privateSessions > 0)
    const topRevenue = active.reduce((a, b) => !a || b.totalIdentified > a.totalIdentified ? b : a, null)
    const topEfficiency = active.filter(p => p.hours > 0).reduce((a, b) => !a || b.uph > a.uph ? b : a, null)
    const deepestHistory = active.reduce((a, b) => !a || b.historyDays > a.historyDays ? b : a, null)
    return { active, topRevenue, topEfficiency, deepestHistory, total: active.reduce((s, p) => s + p.totalIdentified, 0) }
  }, [platformData])

  const selected = selectedPlatform ? platformData.find(p => samePlatform(p.platform, selectedPlatform)) : null

  const selectedTips = useMemo(() => selected ? tips.filter(t => samePlatform(t.platform, selected.platform) && inRange(t)) : [], [selected, tips, cutoff])
  const selectedFreeSessions = useMemo(() => selected ? sessions.filter(s => samePlatform(s.platform, selected.platform) && inRange(s)).sort((a,b) => dateMs(b)-dateMs(a)) : [], [selected, sessions, cutoff])
  const selectedPrivateSessions = useMemo(() => selected ? paidSessions.filter(s => samePlatform(s.platform, selected.platform) && inRange(s)).sort((a,b) => dateMs(b)-dateMs(a)) : [], [selected, paidSessions, cutoff])

  const sessionRows = useMemo(() => {
    if (!selected) return []
    const free = selectedFreeSessions.map(s => ({ kind: "free", id: s.id || `free_${s.startTime}`, date: s.startTime, endDate: s.endTime, earnings: Number(s.totalUSD) || 0, duration: Number(s.durationMinutes) || null, uph: s.usdPerHour == null ? null : Number(s.usdPerHour), fans: s.uniqueFans || 0, tips: s.tipCount || 0, raw: s }))
    const priv = selectedPrivateSessions.map((s, i) => ({ kind: "private", id: s.id || `private_${dateMs(s)}_${i}`, date: dateValue(s), endDate: null, earnings: Number(s.usd) || Number(s.total_usd) || 0, duration: Number(s.durationMinutes || s.duration_minutes) || null, uph: null, fans: 1, tips: null, type: s.session_type || "Paid session", client: s.username || s.member || "Unknown", raw: s }))
    return [...free, ...priv].sort((a,b) => dateMs(b.raw)-dateMs(a.raw))
  }, [selected, selectedFreeSessions, selectedPrivateSessions])

  const trend = useMemo(() => {
    if (!selected) return null
    const now = Date.now(), windowMs = timeRange === "7D" ? 7 : timeRange === "90D" ? 90 : timeRange === "ALL" ? 31 : 30
    if (timeRange === "ALL") return null
    const currentStart = now - windowMs * 86400000
    const previousStart = currentStart - windowMs * 86400000
    const sumTips = rows => rows.reduce((sum, r) => sum + (Number(r.usd) || 0), 0)
    const current = selectedTips.filter(t => dateMs(t) >= currentStart)
    const previous = selectedTips.filter(t => dateMs(t) >= previousStart && dateMs(t) < currentStart)
    const currentUSD = sumTips(current), previousUSD = sumTips(previous)
    const change = previousUSD > 0 ? ((currentUSD - previousUSD) / previousUSD) * 100 : null
    return { currentUSD, previousUSD, change }
  }, [selected, selectedTips, timeRange])

  const openPlatform = platform => { setSelectedPlatform(platform); setDetailTab("overview"); setSessionType("all"); setSelectedSessionId(null) }

  if (selected) return <PlatformDetail
    selected={selected} comparison={comparison} selectedTips={selectedTips}
    selectedFreeSessions={selectedFreeSessions} selectedPrivateSessions={selectedPrivateSessions}
    sessionRows={sessionRows} trend={trend} timeRange={timeRange} setTimeRange={setTimeRange}
    detailTab={detailTab} setDetailTab={setDetailTab} sessionType={sessionType} setSessionType={setSessionType}
    selectedSessionId={selectedSessionId} setSelectedSessionId={setSelectedSessionId}
    isPro={isPro} profile={profile} onUpgrade={onUpgrade} onImport={onImport}
    onBack={() => setSelectedPlatform(null)}
  />

  const unimported = profilePlatforms.filter(p => !platformData.some(x => samePlatform(x.platform, p) && x.totalIdentified > 0))
  return <div>
    <Header title="Your business across platforms" subtitle="Start with what you're actually earning, then dig into the patterns behind it." timeRange={effectiveTimeRange} setTimeRange={setTimeRange} isPro={isPro} onUpgrade={onUpgrade} />

    {comparison.active.length > 1 && <section style={card}>
      <SectionTitle title="Your platforms are telling a story" right={`${comparison.active.length} active platforms`} />
      <div style={comparisonLead}>These are your actual recent numbers. Look for the difference first — then open a platform to understand why.</div>
      <div style={gridCards}>{comparison.active.map(p => <button key={p.platform} onClick={() => openPlatform(p.platform)} style={platformCard}>
        <div style={row}><span style={{fontSize:20}}>{PLATFORM_EMOJI[p.platform] || "🎥"}</span><span style={platformName}>{p.platform}</span>{samePlatform(p.platform, comparison.topEfficiency?.platform) && <Badge color={C.cyan}>Best $/hr</Badge>}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:14}}><strong style={{color:C.green,fontSize:25}}>{money(p.totalIdentified)}</strong><span style={{color:C.muted,fontSize:11}}>identified earnings</span></div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:9,color:C.text,fontSize:11}}><span>{p.sessions} free-chat sessions · {p.privateSessions} private</span><strong style={{color:C.cyan}}>{p.hours ? `${money(p.uph)}/hr` : "—"}</strong></div>
        <div style={openLink}>See why {p.platform} looks this way →</div>
      </button>)}</div>
    </section>}

    {comparison.active.length === 1 && comparison.active[0] && <section style={card}>
      <SectionTitle title="Your platform" right="Open your performance" />
      <button onClick={() => openPlatform(comparison.active[0].platform)} style={{...platformCard,width:"100%",textAlign:"left"}}>
        <div style={row}><span style={{fontSize:21}}>{PLATFORM_EMOJI[comparison.active[0].platform] || "🎥"}</span><span style={platformName}>{comparison.active[0].platform}</span><span style={{marginLeft:"auto",color:C.cyan,fontSize:12,fontWeight:800}}>Open →</span></div>
        <div style={{display:"flex",gap:18,flexWrap:"wrap",marginTop:13,color:C.text,fontSize:12}}><span><b style={{color:C.green}}>{money(comparison.active[0].totalIdentified)}</b> identified earnings</span><span><b style={{color:C.white}}>{comparison.active[0].sessions + comparison.active[0].privateSessions}</b> sessions</span><span><b style={{color:C.cyan}}>{comparison.active[0].hours ? money(comparison.active[0].uph) : "—"}</b>/hr</span></div>
      </button>
    </section>}

    {comparison.active.length === 0 && <section style={{...card,textAlign:"center",padding:40}}><div style={{fontSize:30}}>📊</div><div style={{color:C.white,fontWeight:800,marginTop:8}}>Your platform story starts with your data.</div><div style={{color:C.muted,fontSize:12,marginTop:5}}>Import your earnings to see actual platform performance, sessions, and patterns.</div><button onClick={onImport} style={{...primaryBtn,marginTop:14}}>Import platform data →</button></section>}

    {unimported.length > 0 && <section style={card}>
      <SectionTitle title="Platforms you told us you use" right={`${unimported.length} waiting for data`} />
      <div style={gridCards}>{unimported.map(p => <div key={p} style={waitingCard}><div style={platformName}>{PLATFORM_EMOJI[p] || "🎥"} {p}</div><div style={{color:C.muted,fontSize:11,marginTop:5}}>Bring in your data to see how this platform performs for you.</div><button onClick={onImport} style={{...secondaryBtn,marginTop:10}}>Import {p} data →</button></div>)}</div>
    </section>}

    {comparison.active.length > 0 && !isPro && <section style={conversionHero}>
      <div style={eyebrow}>THE NEXT QUESTION YOUR DATA CREATES</div>
      <h2 style={conversionTitle}>{comparison.active.length > 1 ? "Which platform is really winning over time?" : `What has your ${comparison.active[0].platform} performance looked like beyond the recent window?`}</h2>
      <p style={conversionBody}>{comparison.active.length > 1 ? `You're seeing the most recent 31 days across your active platforms. Pro compares that with the rest of the ${comparison.deepestHistory?.historyDays || "stored"}-day history you've already given CamCash.` : `You're seeing the most recent 31 days. ${comparison.active[0].hasDeeperHistory ? `CamCash already has about ${comparison.active[0].historyDays} days of ${comparison.active[0].platform} data.` : "Import more history and CamCash can build a longer performance record."}`}</p>
      <button onClick={onUpgrade} style={primaryBtn}>See the deeper pattern →</button>
    </section>}
  </div>
}

function PlatformDetail({ selected, comparison, selectedTips, selectedFreeSessions, selectedPrivateSessions, sessionRows, trend, timeRange, setTimeRange, detailTab, setDetailTab, sessionType, setSessionType, selectedSessionId, setSelectedSessionId, isPro, profile, onUpgrade, onImport, onBack }) {
  const revenueShare = comparison.total > 0 ? selected.totalIdentified / comparison.total * 100 : 0
  const others = comparison.active.filter(p => !samePlatform(p.platform, selected.platform) && p.hours > 0)
  const otherUPH = others.length ? others.reduce((s,p)=>s+p.uph,0)/others.length : 0
  const efficiencyDelta = selected.hours > 0 && otherUPH > 0 ? ((selected.uph-otherUPH)/otherUPH)*100 : null
  const totalSessions = selectedFreeSessions.length + selectedPrivateSessions.length
  const detailTabs = ["overview", "earnings", "sessions", "fans"]

  const sessionList = sessionType === "free" ? sessionRows.filter(r=>r.kind==="free") : sessionType === "private" ? sessionRows.filter(r=>r.kind==="private") : sessionRows
  const selectedSession = selectedSessionId ? selectedFreeSessions.find(s => (s.id || `free_${s.startTime}`) === selectedSessionId) : null

  return <div>
    <button onClick={onBack} style={backBtn}>← All Platforms</button>
    <Header title={`${PLATFORM_EMOJI[selected.platform] || "🎥"} Your ${selected.platform} performance`} subtitle={isPro ? "Full history, with recent performance kept in context." : "Recent performance first. Pro goes deeper into the history you have already stored."} timeRange={timeRange} setTimeRange={setTimeRange} isPro={isPro} onUpgrade={onUpgrade} />

    <div style={tabBar}>{detailTabs.map(t=><button key={t} onClick={()=>{setDetailTab(t);setSelectedSessionId(null)}} style={tabButton(detailTab===t)}>{t === "overview" ? "Overview" : t === "earnings" ? "Earnings" : t === "sessions" ? `Sessions (${totalSessions})` : "Fans"}</button>)}</div>

    {detailTab === "overview" && <>
      <div style={grid4}>
        <Metric label="Identified earnings" value={money(selected.totalIdentified)} color={C.green} sub={`${pct(revenueShare)} of connected-platform earnings`} />
        <Metric label="$ / Hour" value={selected.hours ? money(selected.uph) : "—"} color={C.cyan} sub={selected.hours ? `${selected.hours.toFixed(1)} inferred hours` : "No duration data"} />
        <Metric label="Sessions" value={totalSessions || "—"} color={C.white} sub={`${selectedFreeSessions.length} free-chat · ${selectedPrivateSessions.length} private`} />
        <Metric label="Private earnings" value={selected.privateEarnings > 0 ? money(selected.privateEarnings) : "—"} color={C.purple} sub={selected.privateEarnings > 0 ? "Source-supported paid sessions" : "Not reported by this source"} />
      </div>
      <section style={coverageCard}>
        <div>
          <div style={eyebrow}>DATA COVERAGE</div>
          <div style={{color:C.white,fontSize:14,fontWeight:850,marginTop:4}}>{selected.historyDays ? `${selected.historyDays} days of ${selected.platform} data stored` : `Your ${selected.platform} data starts here`}</div>
          <div style={{color:C.text,fontSize:11.5,lineHeight:1.5,marginTop:4}}>{isPro ? "You're viewing the full stored history." : selected.hasDeeperHistory ? "Free shows the latest 31 days; the older history remains stored and becomes useful in Pro." : "Free shows the latest 31 days. More imported history will make longer-term comparisons more useful."}</div>
        </div>
        {!isPro && selected.hasDeeperHistory && <button onClick={onUpgrade} style={secondaryBtn}>Compare full history →</button>}
      </section>
      <div style={grid2}>
        <section style={card}><SectionTitle title="What your data says" />
          {samePlatform(selected.platform, comparison.topRevenue?.platform) && comparison.active.length > 1 && <Insight icon="🏆" title="Highest identified earnings" body={`${selected.platform} currently contributes the most identified earnings across your connected platforms.`} color={C.gold}/>} 
          {samePlatform(selected.platform, comparison.topEfficiency?.platform) && comparison.active.length > 1 && <Insight icon="⚡" title="Best hourly return" body={`${selected.platform} currently has your highest tracked earnings per inferred hour.`} color={C.cyan}/>} 
          {efficiencyDelta !== null && Math.abs(efficiencyDelta) >= 15 && <Insight icon={efficiencyDelta>0?"📈":"📉"} title={efficiencyDelta>0?"Higher hourly return":"Lower hourly return"} body={`${Math.abs(Math.round(efficiencyDelta))}% ${efficiencyDelta>0?"above":"below"} the average hourly return of your other active platforms.`} color={efficiencyDelta>0?C.green:C.gold}/>} 
          {selected.privateEarnings > 0 && <Insight icon="💎" title="Private revenue matters here" body={`${money(selected.privateEarnings)} is explicitly identified as paid/private-session revenue. That's ${pct(selected.totalIdentified>0?selected.privateEarnings/selected.totalIdentified*100:0)} of this platform's identified earnings.`} color={C.purple}/>} 
          {!selectedTips.length && !selectedPrivateSessions.length && <Insight icon="📥" title="More data will sharpen this" body="Import more history for this platform to make the performance story more useful." color={C.text}/>} 
        </section>
        <section style={card}><SectionTitle title="Your next question" />
          <div style={{fontSize:20,fontWeight:850,color:C.white,lineHeight:1.2}}>{trend?.change !== null && trend?.change !== undefined ? (trend.change>=0 ? `Earnings are up ${Math.round(trend.change)}% vs the prior period.` : `Earnings are down ${Math.abs(Math.round(trend.change))}% vs the prior period.`) : "Has this performance actually changed over time?"}</div>
          <div style={{fontSize:12,color:C.text,lineHeight:1.55,marginTop:8}}>{trend?.previousUSD > 0 ? `Recent earnings: ${money(trend.currentUSD)} vs ${money(trend.previousUSD)} in the prior comparable period.` : "Your recent numbers are useful — the deeper question is whether they are a lasting pattern or just a strong/weak stretch."}</div>
          {!isPro && <div style={conversionInline}><div style={eyebrow}>PRO DEEP DIVE</div><div style={{color:C.white,fontWeight:800,fontSize:14}}>{comparison.active.length>1 ? "See which platform has really been winning over your full history." : `See the full ${selected.platform} history you've already imported.`}</div><button onClick={onUpgrade} style={{...primaryBtn,marginTop:10}}>Answer that question →</button></div>}
        </section>
      </div>
    </>}

    {detailTab === "earnings" && <EarningsTab selected={selected} selectedTips={selectedTips} selectedPrivateSessions={selectedPrivateSessions} isPro={isPro} onUpgrade={onUpgrade}/>} 
    {detailTab === "fans" && <FansTab selectedTips={selectedTips} />}
    {detailTab === "sessions" && <SessionsTab selected={selected} sessionRows={sessionList} sessionType={sessionType} setSessionType={setSessionType} selectedSession={selectedSession} setSelectedSessionId={setSelectedSessionId} isPro={isPro} onUpgrade={onUpgrade}/>} 
  </div>
}

function EarningsTab({selected,selectedTips,selectedPrivateSessions,isPro,onUpgrade}) {
  const privatePct = selected.totalIdentified > 0 ? selected.privateEarnings / selected.totalIdentified * 100 : 0
  return <div>
    <div style={grid4}>
      <Metric label="Free-chat / tips" value={money(selected.earnings)} color={C.cyan} sub={`${selected.tipCount} imported tip records`} />
      <Metric label="Private / paid" value={selected.privateEarnings>0?money(selected.privateEarnings):"—"} color={C.purple} sub={selectedPrivateSessions.length?`${selectedPrivateSessions.length} source-supported sessions`:"No supported private data"}/>
      <Metric label="Total identified" value={money(selected.totalIdentified)} color={C.green} sub="Separate revenue sources"/>
      <Metric label="Private share" value={selected.privateEarnings>0?pct(privatePct):"—"} color={C.purple} sub="Of identified platform earnings"/>
    </div>
    <section style={card}><SectionTitle title="Where this platform's money came from" />
      <RevenueBar label="Free-chat / imported tips" value={selected.earnings} total={selected.totalIdentified} color={C.cyan}/>
      {selected.privateEarnings>0 && <RevenueBar label="Private / paid sessions" value={selected.privateEarnings} total={selected.totalIdentified} color={C.purple}/>} 
      <div style={note}>Private earnings are shown only when the source explicitly identifies paid/private sessions. They are not inferred from token size, timing, or other behavior.</div>
    </section>
    {!isPro && <ConversionStrip title="You can see where the money came from. Now see how that mix changed over time." body="Pro turns the current snapshot into a deeper historical earnings picture using the data you've already stored." onUpgrade={onUpgrade}/>} 
  </div>
}

function SessionsTab({selected,sessionRows,sessionType,setSessionType,selectedSession,setSelectedSessionId,isPro,onUpgrade}) {
  const freeRows=sessionRows.filter(r=>r.kind==="free"), privateRows=sessionRows.filter(r=>r.kind==="private")
  const total=sessionRows.reduce((s,r)=>s+r.earnings,0), avg=sessionRows.length?total/sessionRows.length:0
  const best=sessionRows.reduce((a,r)=>!a||r.earnings>a.earnings?r:a,null)
  if(selectedSession) return <SessionDetail session={selectedSession} allSessions={freeRows.map(r=>r.raw)} onBack={()=>setSelectedSessionId(null)} isPro={isPro} onUpgrade={onUpgrade}/>
  return <div>
    <div style={grid4}>
      <Metric label="All sessions" value={sessionRows.length} color={C.white} sub="Free-chat + source-supported private"/>
      <Metric label="Session earnings" value={money(total)} color={C.green} sub="Identified in this range"/>
      <Metric label="Average session" value={money(avg)} color={C.cyan} sub="Across unified session list"/>
      <Metric label="Best session" value={best?money(best.earnings):"—"} color={C.gold} sub={best?`${dateLabel(best.date)} · ${best.kind==="private"?"Private":"Free-chat"}`:"No sessions"}/>
    </div>
    <section style={card}><SectionTitle title="Session performance" right="Unified view" />
      <div style={segmented}>{[["all","All sessions"],["free","Free Chat"],["private","Private"]].map(([k,label])=><button key={k} onClick={()=>setSessionType(k)} style={filterBtn(sessionType===k)}>{label}{k==="free"?` · ${freeRows.length}`:k==="private"?` · ${privateRows.length}`:""}</button>)}</div>
      {sessionRows.length===0 ? <Empty text="No sessions match this view."/> : <div style={{overflowX:"auto"}}><table style={table}><thead><tr><th>Date</th><th>Type</th><th>Earnings</th><th>Duration</th><th>$ / hr</th><th>Driver</th><th></th></tr></thead><tbody>{sessionRows.map(r=><tr key={r.id}>
        <td>{dateLabel(r.date)}<div style={{fontSize:10,color:C.muted}}>{timeLabel(r.date)}</div></td><td><span style={typePill(r.kind)}>{r.kind==="private"?"Private":"Free Chat"}</span>{r.type&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{r.type}</div>}</td><td style={{color:C.green,fontWeight:800}}>{money(r.earnings)}</td><td>{r.duration?`${Math.round(r.duration)} min`:"—"}</td><td>{r.uph!=null?money(r.uph):"—"}</td><td>{r.kind==="private"?r.client||"Client":""}{r.kind==="free"?`${r.fans} fans · ${r.tips} tips`:""}</td><td>{r.kind==="free"?<button onClick={()=>setSelectedSessionId(r.id)} style={smallLink}>Breakdown →</button>:<span style={{color:C.muted,fontSize:10}}>Source record</span>}</td>
      </tr>)}</tbody></table></div>}
    </section>
    {!isPro && <ConversionStrip title="You can see the sessions. Pro helps you see the pattern." body="The session list stays useful. The deeper Pro layer answers whether your best times, session efficiency, and performance changes are consistent across your stored history." onUpgrade={onUpgrade}/>} 
  </div>
}

function SessionDetail({session,allSessions,onBack,isPro,onUpgrade}) {
  const tips=[...(session.tips||[])].sort((a,b)=>new Date(a.dateRaw||a.date_time)-new Date(b.dateRaw||b.date_time))
  const duration=Math.max(Number(session.durationMinutes)||1,1), bucketCount=Math.max(Math.ceil(duration/5),1)
  const buckets=Array.from({length:bucketCount},(_,i)=>({label:`${i*5}m`,usd:0,count:0}))
  const start=new Date(session.startTime).getTime()
  tips.forEach(t=>{const ms=new Date(t.dateRaw||t.date_time).getTime();const i=Math.min(Math.max(Math.floor((ms-start)/60000/5),0),bucketCount-1);buckets[i].usd+=Number(t.usd)||0;buckets[i].count++})
  const max=Math.max(...buckets.map(b=>b.usd),0.01), half=Math.floor(bucketCount/2)||1
  const first=buckets.slice(0,half).reduce((s,b)=>s+b.usd,0), firstPct=session.totalUSD>0?first/session.totalUSD*100:0
  const contributors=Object.entries(tips.reduce((m,t)=>{const u=t.username||"Unknown";m[u]=(m[u]||0)+(Number(t.usd)||0);return m},{})).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const avg=allSessions.length?allSessions.reduce((s,x)=>s+(Number(x.totalUSD)||0),0)/allSessions.length:0
  const performance=avg>0&&session.totalUSD>=avg*1.3?"High performing":avg>0&&session.totalUSD<=avg*.6?"Below average":"Around your average"
  const insights=[]
  if(firstPct>=60) insights.push(`You earned ${Math.round(firstPct)}% of this session's revenue in the first half.`)
  if(firstPct<=35&&duration>20) insights.push("This session warmed up slowly; most revenue arrived later.")
  if(contributors[0]&&session.totalUSD>0&&contributors[0][1]/session.totalUSD>=.4) insights.push(`${contributors[0][0]} drove ${Math.round(contributors[0][1]/session.totalUSD*100)}% of this session's revenue.`)
  if(session.uniqueFans>=5) insights.push(`${session.uniqueFans} different fans tipped — strong audience breadth for this session.`)
  if(!insights.length) insights.push("This session does not show a strong single pattern yet. More sessions make comparisons more reliable.")
  return <div>
    <button onClick={onBack} style={backBtn}>← Back to Sessions</button>
    <section style={card}><div style={row}><div><div style={eyebrow}>{session.platform} · SESSION BREAKDOWN</div><h2 style={{margin:"4px 0 0",color:C.white,fontSize:24}}>{dateLabel(session.startTime)}</h2><div style={{color:C.muted,fontSize:12,marginTop:4}}>{timeLabel(session.startTime)} → {timeLabel(session.endTime)} · inferred session boundaries</div></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:900,color:C.green}}>{money(session.totalUSD)}</div><div style={{fontSize:11,color:C.muted}}>{Math.round(duration)} min · {session.usdPerHour!=null?money(session.usdPerHour)+"/hr":"—"}</div></div></div></section>
    <div style={grid4}><Metric label="Performance" value={performance} color={performance==="High performing"?C.green:performance==="Below average"?C.red:C.gold} sub={avg?`Session average ${money(avg)}`:"No baseline yet"}/><Metric label="Tips" value={session.tipCount} color={C.cyan}/><Metric label="Fans" value={session.uniqueFans} color={C.pink}/><Metric label="Avg tip" value={money(session.avgTipSize)} color={C.gold}/></div>
    <section style={card}><SectionTitle title="Earnings timeline" right="5-minute buckets"/><div style={{display:"flex",alignItems:"flex-end",gap:3,height:100}}>{buckets.map((b,i)=><div key={i} title={`${b.label}: ${money(b.usd)}`} style={{flex:1,height:"100%",display:"flex",alignItems:"flex-end"}}><div style={{width:"100%",height:`${Math.max(b.usd/max*100,b.usd>0?4:2)}%`,background:b.usd===Math.max(...buckets.map(x=>x.usd))?C.gold:C.cyan,borderRadius:"3px 3px 0 0"}}/></div>)}</div><div style={{display:"flex",justifyContent:"space-between",color:C.muted,fontSize:9,marginTop:5}}><span>{timeLabel(session.startTime)}</span><span>{timeLabel(session.endTime)}</span></div></section>
    <div style={grid2}><section style={card}><SectionTitle title="What happened"/><div style={{display:"flex",flexDirection:"column",gap:9}}>{insights.map((x,i)=><div key={i} style={{fontSize:12,color:C.text,lineHeight:1.5}}>→ {x}</div>)}</div></section><section style={card}><SectionTitle title="Top contributors"/>{contributors.map(([name,usd],i)=><div key={name} style={{display:"flex",gap:9,alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}><span style={{color:C.muted,width:18}}>{i+1}</span><span style={{color:C.white,flex:1,fontSize:12}}>{name}</span><span style={{color:C.green,fontWeight:800,fontSize:12}}>{money(usd)}</span><span style={{color:C.muted,fontSize:10}}>{session.totalUSD?Math.round(usd/session.totalUSD*100):0}%</span></div>)}</section></div>
    {!isPro&&<ConversionStrip title="You can see what happened in this session. The bigger question is whether this keeps happening." body="Pro connects session-level behavior to your deeper history so you can tell a repeatable pattern from a one-off result." onUpgrade={onUpgrade}/>} 
  </div>
}

function FansTab({selectedTips}) { const fans=Object.entries(selectedTips.reduce((m,t)=>{const u=t.username||"Unknown";m[u]=(m[u]||0)+(Number(t.usd)||0);return m},{})).sort((a,b)=>b[1]-a[1]); return <section style={card}><SectionTitle title="Top contributors on this platform" right={`${fans.length} identifiable fans`}/>{fans.length?<div>{fans.slice(0,20).map(([name,usd],i)=><div key={name} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}><span style={{width:24,color:C.muted}}>{i+1}</span><span style={{flex:1,color:C.white,fontSize:12,fontWeight:700}}>{name}</span><span style={{color:C.green,fontWeight:800}}>{money(usd)}</span></div>)}</div>:<Empty text="No identifiable fan contribution data in this range."/>}</section> }
function Header({title,subtitle,timeRange,setTimeRange,isPro,onUpgrade}) {
  const options = [["7D","7 days",true],["31D","31 days",true],["90D","90 days",isPro],["ALL","All history",isPro]]
  return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:18}}><div><div style={eyebrow}>PLATFORM INTELLIGENCE</div><h1 style={{margin:0,color:C.white,fontSize:29,fontWeight:850}}>{title}</h1><p style={{margin:"7px 0 0",color:C.text,fontSize:13}}>{subtitle}</p></div><div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}><div style={segmented}>{options.map(([r,label,enabled])=><button key={r} onClick={()=>enabled?setTimeRange(r):onUpgrade()} style={{...filterBtn(timeRange===r),opacity:enabled?1:.62}} title={enabled?label:"Pro unlocks deeper history"}>{r==="ALL"?"All history":label}</button>)}</div>{!isPro&&<span style={{color:C.muted,fontSize:9}}>90D + All history · Pro</span>}</div></div>
}
function Metric({label,value,color,sub}){return <div style={{...card,padding:15,marginBottom:0}}><div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>{label}</div><div style={{color,fontSize:21,fontWeight:850,marginTop:5}}>{value}</div>{sub&&<div style={{color:C.muted,fontSize:10.5,marginTop:3}}>{sub}</div>}</div>}
function SectionTitle({title,right}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:13}}><h2 style={{margin:0,color:C.white,fontSize:15,fontWeight:800}}>{title}</h2>{right&&<span style={{color:C.muted,fontSize:11}}>{right}</span>}</div>}
function Insight({icon,title,body,color}){return <div style={{padding:"11px 12px",borderRadius:10,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",marginBottom:8}}><div style={{color,fontSize:12,fontWeight:800}}>{icon} {title}</div><div style={{color:C.text,fontSize:11.5,lineHeight:1.45,marginTop:3}}>{body}</div></div>}
function RevenueBar({label,value,total,color}){return <div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.text,marginBottom:6}}><span>{label}</span><strong style={{color}}>{money(value)}</strong></div><div style={bar}><div style={{...fill,width:`${total>0?Math.min(100,value/total*100):0}%`,background:color}}/></div></div>}
function ConversionStrip({title,body,onUpgrade}){return <section style={conversionHero}><div style={eyebrow}>GO DEEPER WITH PRO</div><div style={{color:C.white,fontSize:16,fontWeight:850}}>{title}</div><div style={{color:C.text,fontSize:12,lineHeight:1.55,marginTop:5,maxWidth:760}}>{body}</div><button onClick={onUpgrade} style={{...primaryBtn,marginTop:12}}>See the deeper pattern →</button></section>}
function Badge({color,children}){return <span style={{marginLeft:"auto",padding:"3px 7px",borderRadius:99,background:`${color}15`,color,border:`1px solid ${color}30`,fontSize:9,fontWeight:800}}>{children}</span>}
function Empty({text}){return <div style={{color:C.muted,fontSize:12,padding:"18px 0"}}>{text}</div>}
const card={background:"rgba(13,19,34,.72)",border:"1px solid rgba(255,255,255,.07)",borderRadius:15,padding:18,marginBottom:14,boxShadow:"0 8px 30px rgba(0,0,0,.12)"}
const grid4={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:14}
const grid2={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}
const gridCards={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}
const row={display:"flex",alignItems:"center",gap:9}
const platformName={color:C.white,fontSize:14,fontWeight:800}
const platformCard={width:"100%",textAlign:"left",padding:15,borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.08)",cursor:"pointer",color:C.text}
const waitingCard={padding:14,borderRadius:12,border:"1px dashed rgba(34,211,238,.25)",background:"rgba(34,211,238,.035)"}
const openLink={marginTop:12,color:C.cyan,fontSize:11,fontWeight:800}
const segmented={display:"flex",gap:3,padding:4,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,flexWrap:"wrap"}
const filterBtn=active=>({border:"none",borderRadius:7,padding:"6px 9px",background:active?"rgba(34,211,238,.16)":"transparent",color:active?C.cyan:C.muted,fontSize:11,fontWeight:800,cursor:"pointer"})
const comparisonLead={color:C.muted,fontSize:11.5,lineHeight:1.5,marginBottom:12}
const coverageCard={display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap",padding:"13px 15px",borderRadius:12,background:"rgba(34,211,238,.035)",border:"1px solid rgba(34,211,238,.13)",marginBottom:14}
const tabBar={display:"flex",gap:5,marginBottom:14,borderBottom:"1px solid rgba(255,255,255,.07)",paddingBottom:8}
const tabButton=active=>({border:"none",borderRadius:8,padding:"8px 12px",background:active?"rgba(34,211,238,.12)":"transparent",color:active?C.cyan:C.muted,fontSize:12,fontWeight:800,cursor:"pointer"})
const backBtn={border:"none",background:"transparent",color:C.cyan,cursor:"pointer",padding:"0 0 12px",fontSize:12,fontWeight:700}
const primaryBtn={border:"none",borderRadius:9,padding:"9px 14px",background:"linear-gradient(135deg,#22D3EE,#7C5CFF)",color:"#06101A",fontWeight:800,fontSize:12,cursor:"pointer"}
const secondaryBtn={border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"8px 11px",background:"rgba(255,255,255,.04)",color:C.white,fontWeight:700,fontSize:11,cursor:"pointer"}
const conversionHero={marginTop:14,padding:18,borderRadius:14,background:"linear-gradient(135deg,rgba(34,211,238,.07),rgba(168,85,247,.1))",border:"1px solid rgba(168,85,247,.26)"}
const conversionInline={marginTop:15,padding:14,borderRadius:11,background:"rgba(168,85,247,.07)",border:"1px solid rgba(168,85,247,.2)"}
const conversionTitle={margin:"5px 0 0",color:C.white,fontSize:19,fontWeight:850,lineHeight:1.25}
const conversionBody={color:C.text,fontSize:12.5,lineHeight:1.55,maxWidth:760}
const eyebrow={fontSize:10,color:C.cyan,fontWeight:800,textTransform:"uppercase",letterSpacing:1.1}
const bar={height:8,borderRadius:99,background:"rgba(255,255,255,.06)",overflow:"hidden"}
const fill={height:"100%",borderRadius:99}
const note={fontSize:10.5,color:C.muted,lineHeight:1.45,marginTop:10}
const typePill=kind=>({display:"inline-block",padding:"3px 7px",borderRadius:99,background:kind==="private"?"rgba(168,85,247,.1)":"rgba(34,211,238,.08)",color:kind==="private"?C.purple:C.cyan,fontSize:9,fontWeight:800})
const smallLink={border:"none",background:"transparent",color:C.cyan,fontSize:10,fontWeight:800,cursor:"pointer",padding:0}
const table={width:"100%",borderCollapse:"collapse",fontSize:11,color:C.text}
