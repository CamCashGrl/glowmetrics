"use client"
import { useState, useMemo } from "react"
import {
  BarChart, Bar, ComposedChart, Line, LineChart,
  PieChart, Pie, Cell, Label,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

// ─── Constants ───────────────────────────────────────────────────────────────
const BG     = "#0a0e1a"
const CARD   = "rgba(255,255,255,0.03)"
const BORDER = "rgba(255,255,255,0.08)"
const CYAN   = "#22d3ee"
const PURPLE = "#a855f7"
const PINK   = "#f472b6"
const AMBER  = "#f59e0b"
const GREEN  = "#4ade80"
const SLATE  = "#64748b"
const TEXT   = "#f1f5f9"

const TWO_HR_SLOTS = [0,2,4,6,8,10,12,14,16,18,20,22]
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const DAY_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const PLATFORM_COLORS = { chaturbate:"#f97316", myfreecams:"#3b82f6", stripchat:"#ec4899", bongacams:"#8b5cf6", camsoda:"#10b981", other:"#64748b" }
const SOURCE_COLORS = [CYAN, PURPLE, PINK, AMBER, GREEN, "#ef4444", "#f97316", "#3b82f6"]

// ─── UTC helpers ─────────────────────────────────────────────────────────────
function utcHour(date)  { return new Date(date).getUTCHours() }
function utcDay(date)   { return new Date(date).getUTCDay() }
function utcYMD(date)   { const d = new Date(date); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}` }
function utcMonthKey(date) { const d = new Date(date); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}` }

function fmtHour(utcH) {
  return new Date(Date.UTC(2000,0,1,utcH)).toLocaleTimeString([],{hour:"numeric",hour12:true})
}
function fmtDayName(utcDayIdx) {
  return new Date(Date.UTC(2024,0,7+utcDayIdx)).toLocaleDateString("en-US",{weekday:"long"})
}
function localHourDecFromDate(date) {
  const parts = new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",hour12:false}).formatToParts(date)
  const h = parseInt(parts.find(p=>p.type==="hour")?.value??"0") % 24
  const m = parseInt(parts.find(p=>p.type==="minute")?.value??"0")
  return h + m/60
}
function fmtUsd(n) { return `$${Number(n||0).toFixed(2)}` }
function fmtDur(mins) {
  if (mins < 60) return `${Math.round(mins)}m`
  return `${Math.floor(mins/60)}h ${Math.round(mins%60)}m`
}
function normPlatform(raw) {
  if (!raw) return "other"
  const s = raw.toLowerCase()
  if (s.includes("chaturbate")) return "chaturbate"
  if (s.includes("myfreecams") || s.includes("mfc")) return "myfreecams"
  if (s.includes("stripchat")) return "stripchat"
  if (s.includes("bongacams")) return "bongacams"
  if (s.includes("camsoda")) return "camsoda"
  return "other"
}

// ─── Pure data functions ──────────────────────────────────────────────────────
function groupIntoSessions(tips) {
  if (!tips?.length) return []
  const sorted = [...tips].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  const GAP = 4*60*60*1000
  const sessions = []
  let cur = null
  for (const t of sorted) {
    const ts = new Date(t.created_at).getTime()
    if (!cur || ts - cur.lastTs > GAP) {
      if (cur) sessions.push(cur)
      const d = new Date(t.created_at)
      cur = {
        start: d,
        end: d,
        lastTs: ts,
        tokens: 0,
        usd: 0,
        tipsCount: 0,
        tippers: new Set(),
        platform: normPlatform(t.chat_platform),
        utcDay: utcDay(d),
        utcHourStart: utcHour(d),
      }
    }
    cur.tokens   += Number(t.tokens||0)
    cur.usd      += Number(t.usd_value||0)
    cur.tipsCount++
    if (t.from_username) cur.tippers.add(t.from_username)
    cur.end    = new Date(t.created_at)
    cur.lastTs = ts
  }
  if (cur) sessions.push(cur)
  return sessions.map(s => ({
    ...s,
    tippers: s.tippers.size,
    durationMins: (s.end - s.start) / 60000 || 5,
    localHourStart: localHourDecFromDate(s.start),
  }))
}

function platformEfficiency(tips) {
  const map = {}
  for (const t of tips) {
    const p = normPlatform(t.chat_platform)
    if (!map[p]) map[p] = { platform:p, tokens:0, usd:0, count:0, sessions:new Set(), days:new Set() }
    map[p].tokens += Number(t.tokens||0)
    map[p].usd    += Number(t.usd_value||0)
    map[p].count++
    map[p].days.add(utcYMD(t.created_at))
  }
  return Object.values(map).map(p => ({
    ...p,
    sessions: p.sessions.size || 1,
    activeDays: p.days.size,
    avgTip: p.count ? p.usd/p.count : 0,
    usdPerDay: p.days.size ? p.usd/p.days.size : 0,
  })).sort((a,b)=>b.usd-a.usd)
}

function windowStats(tips) {
  const grid = {}
  for (let d=0;d<7;d++) for (const slot of TWO_HR_SLOTS) {
    grid[`${d}_${slot}`] = { day:d, slot, tokens:0, usd:0, count:0, sessions:0 }
  }
  for (const t of tips) {
    const d = utcDay(t.created_at)
    const h = utcHour(t.created_at)
    const slot = Math.floor(h/2)*2
    const key = `${d}_${slot}`
    if (grid[key]) {
      grid[key].tokens += Number(t.tokens||0)
      grid[key].usd    += Number(t.usd_value||0)
      grid[key].count++
    }
  }
  return grid
}

function detectWhales(tips) {
  const map = {}
  for (const t of tips) {
    const u = t.from_username||"anon"
    if (!map[u]) map[u] = { username:u, tokens:0, usd:0, count:0, lastSeen:null, platforms:new Set() }
    map[u].tokens += Number(t.tokens||0)
    map[u].usd    += Number(t.usd_value||0)
    map[u].count++
    const ts = t.created_at
    if (!map[u].lastSeen || ts > map[u].lastSeen) map[u].lastSeen = ts
    if (t.chat_platform) map[u].platforms.add(normPlatform(t.chat_platform))
  }
  return Object.values(map)
    .map(w=>({...w, platforms:w.platforms.size, isWhale:w.tokens>=500}))
    .sort((a,b)=>b.usd-a.usd)
}

function monthlyTotals(tips) {
  const map = {}
  for (const t of tips) {
    const mk = utcMonthKey(t.created_at)
    if (!map[mk]) map[mk] = { month:mk, usd:0, tokens:0, count:0, activeDays:new Set() }
    map[mk].usd    += Number(t.usd_value||0)
    map[mk].tokens += Number(t.tokens||0)
    map[mk].count++
    map[mk].activeDays.add(utcYMD(t.created_at))
  }
  return Object.values(map)
    .map(m=>({...m, activeDays:m.activeDays.size}))
    .sort((a,b)=>a.month.localeCompare(b.month))
    .slice(-12)
}

function weeklyEfficiency(sessions) {
  const map = {}
  for (const s of sessions) {
    const wk = utcYMD(s.start).slice(0,7)
    if (!map[wk]) map[wk] = { week:wk, usd:0, hours:0, sessions:0 }
    map[wk].usd     += s.usd
    map[wk].hours   += s.durationMins/60
    map[wk].sessions++
  }
  return Object.values(map)
    .map(w=>({...w, usdPerHr: w.hours>0 ? w.usd/w.hours : 0}))
    .sort((a,b)=>a.week.localeCompare(b.week))
    .slice(-12)
}

function earningsBySource(tips) {
  const map = {}
  for (const t of tips) {
    const src = normPlatform(t.chat_platform)
    if (!map[src]) map[src] = { name:src, value:0 }
    map[src].value += Number(t.usd_value||0)
  }
  return Object.values(map).sort((a,b)=>b.value-a.value)
}

// ─── Heat color ───────────────────────────────────────────────────────────────
function heatColor(val, max, metric) {
  if (!max || val === 0) return "rgba(255,255,255,0.04)"
  const t = Math.min(val/max, 1)
  if (metric==="usd")    return `rgba(34,211,238,${(0.08+t*0.82).toFixed(2)})`
  if (metric==="tokens") return `rgba(168,85,247,${(0.08+t*0.82).toFixed(2)})`
  return `rgba(74,222,128,${(0.08+t*0.82).toFixed(2)})`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.04)",borderRadius:"12px",padding:"4px",marginBottom:"20px",flexWrap:"wrap"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onSelect(t.id)} style={{
          flex:"1",minWidth:"100px",padding:"8px 16px",borderRadius:"8px",border:"none",cursor:"pointer",
          fontSize:"13px",fontWeight:"600",transition:"all .2s",
          background: active===t.id ? "linear-gradient(135deg,#22d3ee22,#a855f722)" : "transparent",
          color: active===t.id ? CYAN : SLATE,
          borderBottom: active===t.id ? `2px solid ${CYAN}` : "2px solid transparent",
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color=CYAN }) {
  return (
    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:"12px",padding:"16px 20px",flex:"1",minWidth:"120px"}}>
      <div style={{color:SLATE,fontSize:"11px",fontWeight:"600",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>{label}</div>
      <div style={{color,fontSize:"22px",fontWeight:"800",lineHeight:"1"}}>{value}</div>
      {sub && <div style={{color:SLATE,fontSize:"11px",marginTop:"4px"}}>{sub}</div>}
    </div>
  )
}

function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform] || SLATE
  return <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:"700",textTransform:"uppercase",letterSpacing:".04em"}}>{platform}</span>
}

const CTIP = ({ active, payload }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:"#1e2840",border:`1px solid ${BORDER}`,borderRadius:"8px",padding:"10px 14px",fontSize:"12px"}}>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||TEXT,marginBottom:"2px"}}>
          <span style={{fontWeight:"700"}}>{p.name}:</span> {typeof p.value==="number" ? (p.name.toLowerCase().includes("usd")||p.name.toLowerCase().includes("$") ? fmtUsd(p.value) : p.value.toFixed(2)) : p.value}
        </div>
      ))}
    </div>
  )
}

// ─── TAB: Money Map ───────────────────────────────────────────────────────────
function MoneyMapTab({ tips }) {
  const [platform, setPlatform] = useState("all")
  const [metric, setMetric]     = useState("usd")
  const [range, setRange]       = useState("all")
  const [selected, setSelected] = useState(null)

  const platforms = useMemo(()=>{
    const s = new Set(tips.map(t=>normPlatform(t.chat_platform)))
    return ["all",...s]
  },[tips])

  const filtered = useMemo(()=>{
    let arr = tips
    if (platform!=="all") arr = arr.filter(t=>normPlatform(t.chat_platform)===platform)
    if (range!=="all") {
      const now = Date.now()
      const cutoff = range==="30d" ? now-30*86400000 : range==="90d" ? now-90*86400000 : now-7*86400000
      arr = arr.filter(t=>new Date(t.created_at).getTime()>=cutoff)
    }
    return arr
  },[tips,platform,range])

  const grid = useMemo(()=>windowStats(filtered),[filtered])

  const maxVal = useMemo(()=>{
    return Math.max(...Object.values(grid).map(c=>c[metric]||0),1)
  },[grid,metric])

  const selectedStats = useMemo(()=>{
    if (!selected) return null
    const key = `${selected.day}_${selected.slot}`
    const cell = grid[key]
    if (!cell) return null
    return {
      ...cell,
      dayName: fmtDayName(selected.day),
      slotLabel: `${fmtHour(selected.slot)} – ${fmtHour(selected.slot+2)}`,
      avgTip: cell.count ? cell.usd/cell.count : 0,
    }
  },[selected,grid])

  return (
    <div>
      {/* Filter bar */}
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px",alignItems:"center"}}>
        <span style={{color:SLATE,fontSize:"12px",fontWeight:"600"}}>Platform:</span>
        {platforms.map(p=>(
          <button key={p} onClick={()=>setPlatform(p)} style={{
            padding:"4px 12px",borderRadius:"20px",border:`1px solid ${platform===p?CYAN:BORDER}`,
            background:platform===p?"rgba(34,211,238,0.1)":"transparent",
            color:platform===p?CYAN:SLATE,fontSize:"12px",cursor:"pointer",fontWeight:"600",textTransform:"capitalize"
          }}>{p}</button>
        ))}
        <span style={{color:SLATE,fontSize:"12px",fontWeight:"600",marginLeft:"8px"}}>Metric:</span>
        {[["usd","$ Earned"],["tokens","Tokens"],["count","# Tips"]].map(([v,l])=>(
          <button key={v} onClick={()=>setMetric(v)} style={{
            padding:"4px 12px",borderRadius:"20px",border:`1px solid ${metric===v?CYAN:BORDER}`,
            background:metric===v?"rgba(34,211,238,0.1)":"transparent",
            color:metric===v?CYAN:SLATE,fontSize:"12px",cursor:"pointer",fontWeight:"600"
          }}>{l}</button>
        ))}
        <span style={{color:SLATE,fontSize:"12px",fontWeight:"600",marginLeft:"8px"}}>Range:</span>
        {[["all","All Time"],["90d","90 Days"],["30d","30 Days"],["7d","7 Days"]].map(([v,l])=>(
          <button key={v} onClick={()=>setRange(v)} style={{
            padding:"4px 12px",borderRadius:"20px",border:`1px solid ${range===v?CYAN:BORDER}`,
            background:range===v?"rgba(34,211,238,0.1)":"transparent",
            color:range===v?CYAN:SLATE,fontSize:"12px",cursor:"pointer",fontWeight:"600"
          }}>{l}</button>
        ))}
      </div>

      <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
        {/* Heatmap */}
        <div style={{flex:"1",minWidth:"320px"}}>
          <div style={{overflowX:"auto"}}>
            <div style={{display:"grid",gridTemplateColumns:`80px repeat(${TWO_HR_SLOTS.length},1fr)`,gap:"3px",minWidth:"500px"}}>
              {/* Header row */}
              <div/>
              {TWO_HR_SLOTS.map(slot=>(
                <div key={slot} style={{color:SLATE,fontSize:"10px",textAlign:"center",padding:"2px 0",fontWeight:"600"}}>{fmtHour(slot)}</div>
              ))}
              {/* Day rows */}
              {DAYS.map((day,di)=>[
                <div key={`day-${di}`} style={{color:SLATE,fontSize:"11px",fontWeight:"600",display:"flex",alignItems:"center",paddingRight:"8px"}}>{day}</div>,
                ...TWO_HR_SLOTS.map(slot=>{
                  const key=`${di}_${slot}`
                  const cell=grid[key]
                  const val=cell?.[metric]||0
                  const isSelected=selected?.day===di&&selected?.slot===slot
                  return (
                    <div key={slot}
                      onClick={()=>setSelected(isSelected?null:{day:di,slot})}
                      title={`${day} ${fmtHour(slot)}: ${metric==="usd"?fmtUsd(val):Math.round(val)}`}
                      style={{
                        height:"32px",borderRadius:"4px",cursor:"pointer",
                        background:heatColor(val,maxVal,metric),
                        border:isSelected?`2px solid ${CYAN}`:`2px solid transparent`,
                        transition:"all .15s",
                      }}
                    />
                  )
                })
              ])}
            </div>
          </div>
          {/* Legend */}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px",padding:"0 80px 0 88px"}}>
            <span style={{color:SLATE,fontSize:"10px"}}>Low</span>
            <div style={{display:"flex",gap:"2px",alignItems:"center"}}>
              {[0.1,0.3,0.5,0.7,0.9].map(t=>(
                <div key={t} style={{width:"20px",height:"10px",borderRadius:"2px",background:heatColor(t*maxVal,maxVal,metric)}}/>
              ))}
            </div>
            <span style={{color:SLATE,fontSize:"10px"}}>High</span>
          </div>
        </div>

        {/* Detail panel */}
        {selectedStats ? (
          <div style={{width:"220px",background:"rgba(34,211,238,0.05)",border:`1px solid rgba(34,211,238,0.2)`,borderRadius:"12px",padding:"16px"}}>
            <div style={{color:CYAN,fontWeight:"700",fontSize:"13px",marginBottom:"4px"}}>{selectedStats.dayName}</div>
            <div style={{color:SLATE,fontSize:"12px",marginBottom:"12px"}}>{selectedStats.slotLabel}</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:SLATE,fontSize:"12px"}}>Earned</span>
                <span style={{color:TEXT,fontSize:"12px",fontWeight:"700"}}>{fmtUsd(selectedStats.usd)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:SLATE,fontSize:"12px"}}>Tokens</span>
                <span style={{color:TEXT,fontSize:"12px",fontWeight:"700"}}>{selectedStats.tokens.toLocaleString()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:SLATE,fontSize:"12px"}}>Tips</span>
                <span style={{color:TEXT,fontSize:"12px",fontWeight:"700"}}>{selectedStats.count}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:SLATE,fontSize:"12px"}}>Avg Tip</span>
                <span style={{color:TEXT,fontSize:"12px",fontWeight:"700"}}>{fmtUsd(selectedStats.avgTip)}</span>
              </div>
            </div>
            <button onClick={()=>setSelected(null)} style={{marginTop:"12px",width:"100%",padding:"6px",borderRadius:"6px",border:`1px solid ${BORDER}`,background:"transparent",color:SLATE,fontSize:"11px",cursor:"pointer"}}>Clear</button>
          </div>
        ) : (
          <div style={{width:"220px",background:CARD,border:`1px solid ${BORDER}`,borderRadius:"12px",padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"8px"}}>
            <div style={{color:SLATE,fontSize:"12px",textAlign:"center"}}>Click a cell to see<br/>window details</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: Sessions ────────────────────────────────────────────────────────────
function SessionsTab({ sessions }) {
  const recent = useMemo(()=>[...sessions].sort((a,b)=>b.start-a.start).slice(0,10),[sessions])

  // Weekly calendar: last 7 distinct UTC days with sessions
  const calDays = useMemo(()=>{
    const dayMap = {}
    for (const s of sessions) {
      const dk = utcYMD(s.start)
      if (!dayMap[dk]) dayMap[dk] = { date:s.start, key:dk, sessions:[] }
      dayMap[dk].sessions.push(s)
    }
    return Object.values(dayMap)
      .sort((a,b)=>new Date(b.date)-new Date(a.date))
      .slice(0,7)
      .reverse()
  },[sessions])

  const platformColor = (p) => PLATFORM_COLORS[p] || SLATE

  // Bar width/offset: map local hour decimal to percentage of 24h
  const barStyle = (s) => {
    const start = Math.max(s.localHourStart, 0)
    const durH  = Math.min(s.durationMins/60, 24-start)
    return {
      position:"absolute",
      left:`${(start/24)*100}%`,
      width:`${Math.max((durH/24)*100,1)}%`,
      height:"20px",
      borderRadius:"4px",
      background:platformColor(s.platform),
      opacity:0.8,
      cursor:"default",
      display:"flex",
      alignItems:"center",
      overflow:"hidden",
    }
  }

  const hourTicks = [0,6,12,18,24]

  return (
    <div>
      {/* Weekly calendar */}
      <div style={{marginBottom:"24px"}}>
        <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Recent Sessions Timeline</h3>
        {calDays.length===0 && <div style={{color:SLATE,fontSize:"13px"}}>No session data available.</div>}
        {calDays.map(day=>(
          <div key={day.key} style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"10px"}}>
            <div style={{width:"40px",color:SLATE,fontSize:"11px",fontWeight:"600",textAlign:"right",flexShrink:0}}>
              {new Date(day.date).toLocaleDateString("en-US",{weekday:"short",timeZone:"UTC"})}
            </div>
            <div style={{flex:1,position:"relative",height:"24px",background:"rgba(255,255,255,0.03)",borderRadius:"4px",overflow:"hidden"}}>
              {/* Hour ticks */}
              {hourTicks.map(h=>(
                <div key={h} style={{position:"absolute",left:`${(h/24)*100}%`,top:0,bottom:0,width:"1px",background:"rgba(255,255,255,0.06)"}}/>
              ))}
              {day.sessions.map((s,i)=>(
                <div key={i} style={barStyle(s)} title={`${s.platform} | ${fmtDur(s.durationMins)} | ${fmtUsd(s.usd)}`}>
                  <span style={{color:"#fff",fontSize:"9px",fontWeight:"700",padding:"0 4px",whiteSpace:"nowrap",overflow:"hidden"}}>{fmtUsd(s.usd)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* X axis labels */}
        {calDays.length>0 && (
          <div style={{display:"flex",gap:"12px"}}>
            <div style={{width:"40px"}}/>
            <div style={{flex:1,display:"flex",justifyContent:"space-between"}}>
              {["12am","6am","12pm","6pm","12am"].map(l=>(
                <span key={l} style={{color:SLATE,fontSize:"10px"}}>{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent session cards */}
      <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Recent Sessions</h3>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {recent.map((s,i)=>(
          <div key={i} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:"10px",padding:"12px 16px",display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"center"}}>
            <div style={{minWidth:"80px"}}>
              <PlatformBadge platform={s.platform}/>
            </div>
            <div style={{flex:"1",minWidth:"120px"}}>
              <div style={{color:TEXT,fontSize:"13px",fontWeight:"700"}}>
                {s.start.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
              </div>
              <div style={{color:SLATE,fontSize:"11px"}}>{fmtDur(s.durationMins)} session</div>
            </div>
            <div style={{textAlign:"right",minWidth:"80px"}}>
              <div style={{color:CYAN,fontSize:"15px",fontWeight:"800"}}>{fmtUsd(s.usd)}</div>
              <div style={{color:SLATE,fontSize:"11px"}}>{s.tokens.toLocaleString()} tokens</div>
            </div>
            <div style={{textAlign:"right",minWidth:"60px"}}>
              <div style={{color:TEXT,fontSize:"12px"}}>{s.tipsCount} tips</div>
              <div style={{color:SLATE,fontSize:"11px"}}>{s.tippers} tippers</div>
            </div>
          </div>
        ))}
        {recent.length===0 && <div style={{color:SLATE,fontSize:"13px"}}>No sessions found.</div>}
      </div>
    </div>
  )
}

// ─── TAB: Platforms ───────────────────────────────────────────────────────────
function PlatformsTab({ tips, sessions }) {
  const platforms = useMemo(()=>platformEfficiency(tips),[tips])

  // Multistream: sessions with 2+ platforms in same day
  const multiDays = useMemo(()=>{
    const byDay = {}
    for (const s of sessions) {
      const dk = utcYMD(s.start)
      if (!byDay[dk]) byDay[dk] = { date:dk, platforms:new Set(), usd:0, hours:0 }
      byDay[dk].platforms.add(s.platform)
      byDay[dk].usd   += s.usd
      byDay[dk].hours += s.durationMins/60
    }
    return Object.values(byDay)
      .filter(d=>d.platforms.size>1)
      .map(d=>({...d,platforms:d.platforms.size,label:d.date.slice(5)}))
      .sort((a,b)=>a.date.localeCompare(b.date))
      .slice(-12)
  },[sessions])

  // Platform × Day grouped chart
  const platformDayData = useMemo(()=>{
    const map = {}
    for (const t of tips) {
      const dk = utcYMD(t.created_at).slice(5)
      const p  = normPlatform(t.chat_platform)
      if (!map[dk]) map[dk] = { date:dk }
      map[dk][p] = (map[dk][p]||0) + Number(t.usd_value||0)
    }
    return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30)
  },[tips])

  const allPlats = useMemo(()=>[...new Set(tips.map(t=>normPlatform(t.chat_platform)))],[tips])

  const roleLabel = (p, platforms) => {
    if (!platforms.length) return ""
    if (p.usd === Math.max(...platforms.map(x=>x.usd))) return "Primary"
    if (p.avgTip === Math.max(...platforms.map(x=>x.avgTip))) return "High Avg"
    if (p.usdPerDay === Math.max(...platforms.map(x=>x.usdPerDay))) return "Best Daily"
    return "Secondary"
  }

  return (
    <div>
      {/* Platform cards */}
      <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginBottom:"24px"}}>
        {platforms.map(p=>{
          const role = roleLabel(p, platforms)
          const color = PLATFORM_COLORS[p.platform]||SLATE
          return (
            <div key={p.platform} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:"12px",padding:"16px",flex:"1",minWidth:"180px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <PlatformBadge platform={p.platform}/>
                {role && <span style={{background:`${CYAN}22`,color:CYAN,fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"6px"}}>{role}</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                <div><div style={{color:SLATE,fontSize:"10px",fontWeight:"600"}}>EARNED</div><div style={{color:TEXT,fontSize:"16px",fontWeight:"800"}}>{fmtUsd(p.usd)}</div></div>
                <div><div style={{color:SLATE,fontSize:"10px",fontWeight:"600"}}>AVG TIP</div><div style={{color:color,fontSize:"16px",fontWeight:"800"}}>{fmtUsd(p.avgTip)}</div></div>
                <div><div style={{color:SLATE,fontSize:"10px",fontWeight:"600"}}>ACTIVE DAYS</div><div style={{color:TEXT,fontSize:"14px",fontWeight:"700"}}>{p.activeDays}</div></div>
                <div><div style={{color:SLATE,fontSize:"10px",fontWeight:"600"}}>USD/DAY</div><div style={{color:TEXT,fontSize:"14px",fontWeight:"700"}}>{fmtUsd(p.usdPerDay)}</div></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Multistream days */}
      {multiDays.length>0 && (
        <div style={{marginBottom:"24px"}}>
          <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Multi-Platform Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={multiDays} margin={{top:4,right:4,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
              <XAxis dataKey="label" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CTIP/>}/>
              <Bar dataKey="usd" name="$ Earned" fill={CYAN} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform × Day stacked */}
      {platformDayData.length>1 && (
        <div>
          <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Earnings by Platform (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={platformDayData} margin={{top:4,right:4,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
              <XAxis dataKey="date" tick={{fill:SLATE,fontSize:9}} axisLine={false} tickLine={false} interval={4}/>
              <YAxis tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CTIP/>}/>
              <Legend wrapperStyle={{fontSize:"11px",color:SLATE}}/>
              {allPlats.map(p=>(
                <Bar key={p} dataKey={p} name={p} stackId="a" fill={PLATFORM_COLORS[p]||SLATE}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Trends ─────────────────────────────────────────────────────────────
function TrendsTab({ tips, sessions }) {
  const monthly   = useMemo(()=>monthlyTotals(tips),[tips])
  const weekly    = useMemo(()=>weeklyEfficiency(sessions),[sessions])
  const bySource  = useMemo(()=>earningsBySource(tips),[tips])
  const totalUsd  = useMemo(()=>tips.reduce((s,t)=>s+Number(t.usd_value||0),0),[tips])

  const monthlyChart = monthly.map(m=>({
    ...m,
    label: m.month.slice(5),
    usdPerDay: m.activeDays ? +(m.usd/m.activeDays).toFixed(2) : 0,
  }))

  const growth = monthly.length>=2
    ? ((monthly[monthly.length-1].usd - monthly[monthly.length-2].usd) / Math.max(monthly[monthly.length-2].usd,1)*100)
    : 0

  return (
    <div>
      {/* Summary stats */}
      <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginBottom:"24px"}}>
        <StatCard label="Total Earned" value={fmtUsd(totalUsd)} sub={`${tips.length} tips`}/>
        <StatCard label="Active Months" value={monthly.length} sub="in data" color={PURPLE}/>
        <StatCard label="Best Month" value={monthly.length?fmtUsd(Math.max(...monthly.map(m=>m.usd))):"—"} sub={monthly.length?monthly.find(m=>m.usd===Math.max(...monthly.map(x=>x.usd)))?.month?.slice(5):"—"} color={GREEN}/>
        <StatCard label="MoM Growth" value={`${growth>=0?"+":""}${growth.toFixed(0)}%`} sub="last vs prev month" color={growth>=0?GREEN:"#ef4444"}/>
      </div>

      {/* Monthly earnings + $/day ComposedChart */}
      <div style={{marginBottom:"24px"}}>
        <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Monthly Earnings</h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={monthlyChart} margin={{top:4,right:24,left:0,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
            <XAxis dataKey="label" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="left" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="right" orientation="right" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<CTIP/>}/>
            <Legend wrapperStyle={{fontSize:"11px",color:SLATE}}/>
            <Bar yAxisId="left" dataKey="usd" name="$ Earned" fill={CYAN} opacity={0.8} radius={[4,4,0,0]}/>
            <Line yAxisId="right" type="monotone" dataKey="usdPerDay" name="$/Active Day" stroke={AMBER} strokeWidth={2} dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly $/hr line */}
      {weekly.length>1 && (
        <div style={{marginBottom:"24px"}}>
          <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Weekly $/hr Efficiency</h3>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={weekly} margin={{top:4,right:24,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
              <XAxis dataKey="week" tick={{fill:SLATE,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="left" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="right" orientation="right" tick={{fill:SLATE,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CTIP/>}/>
              <Bar yAxisId="left" dataKey="usd" name="$ Earned" fill={PURPLE} opacity={0.6} radius={[3,3,0,0]}/>
              <Line yAxisId="right" type="monotone" dataKey="usdPerHr" name="$/hr" stroke={CYAN} strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Earnings by source donut */}
      {bySource.length>0 && (
        <div>
          <h3 style={{color:TEXT,fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>Earnings by Platform</h3>
          <div style={{display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap"}}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={bySource} cx="50%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {bySource.map((_,i)=>(
                    <Cell key={i} fill={SOURCE_COLORS[i%SOURCE_COLORS.length]}/>
                  ))}
                  <Label value={fmtUsd(totalUsd)} position="center" style={{fill:TEXT,fontSize:"13px",fontWeight:"800"}}/>
                </Pie>
                <Tooltip content={<CTIP/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {bySource.map((s,i)=>(
                <div key={s.name} style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"10px",height:"10px",borderRadius:"2px",background:SOURCE_COLORS[i%SOURCE_COLORS.length],flexShrink:0}}/>
                  <span style={{color:SLATE,fontSize:"12px",textTransform:"capitalize",minWidth:"90px"}}>{s.name}</span>
                  <span style={{color:TEXT,fontSize:"12px",fontWeight:"700"}}>{fmtUsd(s.value)}</span>
                  <span style={{color:SLATE,fontSize:"11px"}}>({totalUsd>0?(s.value/totalUsd*100).toFixed(0):0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inner content (all hooks here) ──────────────────────────────────────────
function MoneyMapContent({ tips }) {
  const [tab, setTab] = useState("map")

  const sessions = useMemo(()=>groupIntoSessions(tips),[tips])

  const totalUsd    = useMemo(()=>tips.reduce((s,t)=>s+Number(t.usd_value||0),0),[tips])
  const totalTokens = useMemo(()=>tips.reduce((s,t)=>s+Number(t.tokens||0),0),[tips])
  const whales      = useMemo(()=>detectWhales(tips).filter(w=>w.isWhale),[tips])
  const avgSession  = useMemo(()=>{
    if (!sessions.length) return 0
    return sessions.reduce((s,x)=>s+x.usd,0)/sessions.length
  },[sessions])

  const TABS = [
    {id:"map",     label:"💰 Money Map"},
    {id:"sessions",label:"📅 Sessions"},
    {id:"platforms",label:"🏆 Platforms"},
    {id:"trends",  label:"📈 Trends"},
  ]

  return (
    <div style={{background:BG,minHeight:"100%",padding:"0",color:TEXT,fontFamily:"inherit"}}>
      {/* Header stats */}
      <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginBottom:"20px"}}>
        <StatCard label="Total Earned" value={fmtUsd(totalUsd)} sub={`${tips.length} tips`}/>
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} sub="all time" color={PURPLE}/>
        <StatCard label="Avg / Session" value={fmtUsd(avgSession)} sub={`${sessions.length} sessions`} color={AMBER}/>
        <StatCard label="Whales" value={whales.length} sub="500+ tokens lifetime" color={PINK}/>
      </div>

      <TabBar tabs={TABS} active={tab} onSelect={setTab}/>

      {tab==="map"       && <MoneyMapTab tips={tips}/>}
      {tab==="sessions"  && <SessionsTab sessions={sessions}/>}
      {tab==="platforms" && <PlatformsTab tips={tips} sessions={sessions}/>}
      {tab==="trends"    && <TrendsTab tips={tips} sessions={sessions}/>}
    </div>
  )
}

// ─── Exported component ───────────────────────────────────────────────────────
export default function MoneyMap({ tips = [], isPro = false }) {
  if (!isPro) {
    return (
      <div style={{width:"100%",padding:"32px 24px",boxSizing:"border-box"}}>
        <div style={{background:"rgba(15,20,32,0.75)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"16px",padding:"48px 40px",width:"100%",boxSizing:"border-box"}}>
          <h2 style={{color:"#f1f5f9",fontSize:"22px",fontWeight:"700",marginBottom:"10px",marginTop:0}}>Money Map</h2>
          <p style={{color:"#94a3b8",fontSize:"14px",marginBottom:"32px"}}>Visualize your earnings with heatmaps, session breakdowns, platform comparisons, and trend analysis.</p>
          <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
            <a href="/live/demo" style={{display:"inline-flex",alignItems:"center",gap:"8px",background:"rgba(34,211,238,0.12)",border:"1px solid rgba(34,211,238,0.3)",color:"#22d3ee",fontWeight:"600",padding:"10px 24px",borderRadius:"10px",textDecoration:"none",fontSize:"14px"}}>▶ Watch Demo</a>
            <a href="/pricing" style={{display:"inline-flex",alignItems:"center",background:"linear-gradient(135deg,#22d3ee,#a855f7)",color:"#0a0e1a",fontWeight:"800",padding:"10px 24px",borderRadius:"10px",textDecoration:"none",fontSize:"14px"}}>Upgrade to Pro</a>
          </div>
        </div>
      </div>
    )
  }

  if (tips.length < 20) {
    return (
      <div style={{textAlign:"center",padding:"60px 24px"}}>
        <div style={{fontSize:"40px",marginBottom:"16px"}}>📊</div>
        <h2 style={{color:"#f1f5f9",marginBottom:"8px"}}>Not Enough Data Yet</h2>
        <p style={{color:"#64748b",marginBottom:"8px"}}>Money Map needs at least 20 tips to build meaningful visualizations.</p>
        <p style={{color:"#64748b"}}>You have <strong style={{color:"#22d3ee"}}>{tips.length}</strong> tip{tips.length===1?"":"s"} — keep streaming!</p>
      </div>
    )
  }

  return <MoneyMapContent tips={tips}/>
}
