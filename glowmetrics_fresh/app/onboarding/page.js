'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hlsdlaibnayzbfflxclj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

// ─── Brand palette ─────────────────────────────────────────────
const C = {
  bg:          '#0a0b14',
  sidebar:     '#0d0f1e',
  card:        '#13151f',
  card2:       '#1a1d2e',
  cyan:        '#00e5cc',
  cyanDim:     'rgba(0,229,204,0.10)',
  cyanBorder:  'rgba(0,229,204,0.28)',
  gold:        '#f59e0b',
  goldDim:     'rgba(245,158,11,0.10)',
  green:       '#22c55e',
  greenDim:    'rgba(34,197,94,0.10)',
  purple:      '#a855f7',
  purpleDim:   'rgba(168,85,247,0.10)',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.10)',
  border:      'rgba(255,255,255,0.07)',
  border2:     'rgba(255,255,255,0.12)',
  text:        '#f8fafc',
  muted:       '#94a3b8',
  muted2:      '#64748b',
}

// ─── Platforms ─────────────────────────────────────────────────
const PLATFORMS = [
  {
    id: 'chaturbate', name: 'Chaturbate', short: 'CB', color: '#ff6b35',
    earningsUrl: (username) => username
      ? `https://chaturbate.com/p/${username}/?tab=tokens`
      : 'https://chaturbate.com/accounts/settings/',
    hint: 'Go to your profile → Token Stats tab. Select All Time. Highlight the table, copy, and paste below.',
    placeholder: `06/18/2026 2:32 PM\tusername123\t500\tspin the wheel\n06/18/2026 3:14 PM\twhaleking99\t1000\t\n06/18/2026 3:45 PM\tregularfan\t25\tgreat show`,
  },
  {
    id: 'bongacams', name: 'BongaCams', short: 'BC', color: '#e53935',
    earningsUrl: () => 'https://bongamodels.com/reports/general',
    hint: 'Go to Reports → General. Select your date range. Highlight all rows, copy, and paste below.',
    placeholder: `18.06.2026 14:32\tusername123\t500\t25.00\n18.06.2026 15:14\twhaleking99\t1000\t50.00\n18.06.2026 15:45\tregularfan\t25\t1.25`,
  },
  {
    id: 'myfreecams', name: 'MyFreeCams', short: 'MFC', color: '#ed8936',
    earningsUrl: () => 'https://profiles.myfreecams.com/_/ext/token_sessions',
    hint: 'Go to Token Sessions. Set your date range, highlight all rows, copy and paste below.',
    placeholder: `2026-06-18 14:32:00\tusername123\t500\tspin the wheel\n2026-06-18 15:14:00\twhaleking99\t1000\t\n2026-06-18 15:45:00\tregularfan\t25\tgreat show`,
  },
]

const TOKEN_RATES = { chaturbate: 0.05, bongacams: 0.04, myfreecams: 0.05 }

// ─── Loading messages ───────────────────────────────────────────
const FIRST_MSGS = [
  'Analyzing your data…',
  'Cleaning up your tip history…',
  'Matching dates and token values…',
  'Identifying your top spenders…',
  'Finding your best hours…',
  'Organizing your fans…',
  'Building your dashboard…',
  'Presenting your results…',
]
const EXTRA_MSGS = [
  'Importing additional tip history…',
  'Merging with your dashboard…',
  'Updating your insights…',
]

// ─── Paste parser ───────────────────────────────────────────────
// Converts raw paste text into a File/Blob that the existing /api/upload route can handle.
// We construct a minimal CSV with headers so the existing parser recognises it.
function pasteToCSVBlob(rawText, platformId) {
  const rate = TOKEN_RATES[platformId] || 0.05
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const headerKw = ['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning']

  const csvRows = ['date_time,username,tokens,usd,note']
  let skipped = 0

  for (const line of lines) {
    const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 2) { skipped++; continue }

    const lower = cols.map(c => c.toLowerCase())
    if (lower.filter(c => headerKw.some(k => c.includes(k))).length >= 2) continue

    let ts = null, tsIdx = -1
    for (let i = 0; i < cols.length; i++) {
      const d = tryParseDate(cols[i])
      if (d) { ts = d; tsIdx = i; break }
    }
    if (!ts) { skipped++; continue }

    const rest = cols.filter((_, i) => i !== tsIdx)
    let tokens = null, usd = null, username = null, note = ''

    for (const col of rest) {
      const n = parseFloat(col.replace(/[$,]/g, ''))
      if (!isNaN(n) && n > 0) {
        if (Number.isInteger(n) && n >= 1 && tokens === null) tokens = n
        else if (!Number.isInteger(n) && n < 5000 && usd === null) usd = n
        else if (Number.isInteger(n) && n >= 1 && tokens === null) tokens = n
      } else if (col.length > 0 && isNaN(parseFloat(col))) {
        if (username === null && col.length <= 50 && !/\s{2,}/.test(col) && col.length > 1) username = col
        else if (note === '' && col.length > 0) note = col
      }
    }

    if (!tokens || tokens < 1) { skipped++; continue }
    if (!usd) usd = +(tokens * rate).toFixed(2)
    const safeUser = (username || 'anonymous').replace(/,/g, '')
    const safeNote = note.replace(/,/g, '')
    const isoTs = ts.toISOString().replace('T', ' ').slice(0, 19)
    csvRows.push(`${isoTs},${safeUser},${tokens},${usd},${safeNote}`)
  }

  return {
    blob: new Blob([csvRows.join('\n')], { type: 'text/csv' }),
    rowCount: csvRows.length - 1,
    skipped,
  }
}

function tryParseDate(str) {
  if (!str || str.length < 8) return null
  let m
  // ISO: 2026-06-18 14:32 or 2026-06-18T14:32
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`)
  // EU: 18.06.2026 14:32
  m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`)
  // US: 06/18/2026 2:32 PM
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{1,2}):(\d{2})(?:\s?(AM|PM))?/i)
  if (m) {
    let h = parseInt(m[4])
    if (m[6]?.toUpperCase() === 'PM' && h < 12) h += 12
    if (m[6]?.toUpperCase() === 'AM' && h === 12) h = 0
    return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${String(h).padStart(2,'0')}:${m[5]}:00`)
  }
  // date only
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`)
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function previewFromText(rawText, platformId) {
  const { rowCount, skipped } = pasteToCSVBlob(rawText, platformId)
  const rate = TOKEN_RATES[platformId] || 0.05
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  const parsed = []
  const headerKw = ['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning']

  for (const line of lines) {
    const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 2) continue
    const lower = cols.map(c => c.toLowerCase())
    if (lower.filter(c => headerKw.some(k => c.includes(k))).length >= 2) continue
    let ts = null, tsIdx = -1
    for (let i = 0; i < cols.length; i++) {
      const d = tryParseDate(cols[i])
      if (d) { ts = d; tsIdx = i; break }
    }
    if (!ts) continue
    const rest = cols.filter((_, i) => i !== tsIdx)
    let tokens = null, usd = null, username = null, note = ''
    for (const col of rest) {
      const n = parseFloat(col.replace(/[$,]/g, ''))
      if (!isNaN(n) && n > 0) {
        if (Number.isInteger(n) && n >= 1 && tokens === null) tokens = n
        else if (!Number.isInteger(n) && n < 5000 && usd === null) usd = n
        else if (Number.isInteger(n) && n >= 1 && tokens === null) tokens = n
      } else if (col.length > 0 && isNaN(parseFloat(col))) {
        if (username === null && col.length <= 50 && col.length > 1) username = col
        else if (note === '' && col.length > 0) note = col
      }
    }
    if (!tokens || tokens < 1) continue
    if (!usd) usd = +(tokens * rate).toFixed(2)
    parsed.push({ ts, username: username || 'anonymous', tokens, usd, note })
  }

  if (!parsed.length) return null

  const totalUsd = parsed.reduce((s, r) => s + r.usd, 0)
  const fans = new Set(parsed.map(r => r.username)).size
  const dates = parsed.map(r => r.ts).sort((a, b) => a - b)
  const topSpender = Object.entries(
    parsed.reduce((acc, r) => { acc[r.username] = (acc[r.username] || 0) + r.tokens; return acc }, {})
  ).sort((a, b) => b[1] - a[1])[0]

  // best hour
  const hourCounts = parsed.reduce((acc, r) => {
    const h = r.ts.getHours()
    acc[h] = (acc[h] || 0) + r.tokens
    return acc
  }, {})
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const fmtHour = h => {
    const n = parseInt(h)
    return n === 0 ? '12am' : n < 12 ? `${n}am` : n === 12 ? '12pm' : `${n-12}pm`
  }

  return {
    count: rowCount,
    skipped,
    usd: totalUsd.toFixed(2),
    fans,
    from: dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    to: dates[dates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    sample: parsed.slice(0, 3),
    topSpender: topSpender ? { name: topSpender[0], tokens: topSpender[1] } : null,
    bestHour: bestHour ? fmtHour(bestHour[0]) : null,
  }
}

function hexRgb(hex) {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}

// ─── Sparkle particles ──────────────────────────────────────────
function Sparkle() {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // sparse sparkle dots — subtle, not confetti
    const COLORS = ['#00e5cc','#2DD4BF','#a855f7','#f59e0b','#ffffff']
    const dots = Array.from({ length: 38 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.2 + 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.7 + 0.2,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: Math.random() * 0.018 + 0.006,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }))

    let frame = 0
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        // gentle drift
        d.x += d.vx
        d.y += d.vy
        // alpha pulse
        d.alpha += d.alphaDir * d.alphaSpeed
        if (d.alpha >= 1) { d.alpha = 1; d.alphaDir = -1 }
        if (d.alpha <= 0) { d.alpha = 0; d.alphaDir = 1 }
        // wrap
        if (d.x < -4) d.x = canvas.width + 4
        if (d.x > canvas.width + 4) d.x = -4
        if (d.y < -4) d.y = canvas.height + 4
        if (d.y > canvas.height + 4) d.y = -4

        // draw a 4-point star sparkle
        ctx.save()
        ctx.globalAlpha = d.alpha
        ctx.translate(d.x, d.y)
        ctx.fillStyle = d.color
        const s = d.r
        ctx.beginPath()
        ctx.moveTo(0, -s * 2.5)
        ctx.lineTo(s * 0.5, -s * 0.5)
        ctx.lineTo(s * 2.5, 0)
        ctx.lineTo(s * 0.5, s * 0.5)
        ctx.lineTo(0, s * 2.5)
        ctx.lineTo(-s * 0.5, s * 0.5)
        ctx.lineTo(-s * 2.5, 0)
        ctx.lineTo(-s * 0.5, -s * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })
      frame++
      // run for ~3s (180 frames) then fade out
      if (frame < 220) {
        raf = requestAnimationFrame(draw)
      } else {
        // fade canvas out
        let op = 1
        const fade = () => {
          op -= 0.05
          ctx.globalAlpha = op
          if (op > 0) requestAnimationFrame(fade)
          else ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        fade()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <canvas ref={canvasRef} style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:9999 }} />
  )
}

// ─── Animated counter ───────────────────────────────────────────
function CountUp({ to, prefix='', suffix='', duration=1200 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to, duration])
  return <>{prefix}{val.toLocaleString()}{suffix}</>
}

// ─── Loading screen ─────────────────────────────────────────────
function LoadingScreen({ isFirst }) {
  const msgs = isFirst ? FIRST_MSGS : EXTRA_MSGS
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const total = isFirst ? 6000 : 2000
    const start = Date.now()
    const pi = setInterval(() => {
      const p = Math.min((Date.now() - start) / total, 0.95)
      setProgress(Math.round(p * 100))
    }, 60)
    const mi = setInterval(() => {
      setMsgIdx(i => (i + 1) % msgs.length)
    }, isFirst ? 900 : 700)
    return () => { clearInterval(pi); clearInterval(mi) }
  }, [isFirst, msgs.length])

  return (
    <div style={{ textAlign:'center', padding:'60px 0' }}>
      <div style={{ fontSize:13, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:C.cyan, marginBottom:24 }}>
        Building your dashboard
      </div>
      {/* progress bar */}
      <div style={{ position:'relative', height:6, background:C.border2, borderRadius:3, overflow:'hidden', marginBottom:28, maxWidth:400, margin:'0 auto 28px' }}>
        <div style={{
          position:'absolute', left:0, top:0, height:'100%',
          width:`${progress}%`, borderRadius:3,
          background:`linear-gradient(90deg, ${C.cyan}, #2DD4BF)`,
          transition:'width 0.1s linear',
        }} />
        <div style={{
          position:'absolute', left:0, top:0, height:'100%', width:'100%',
          background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
          animation:'shimmer 1.4s infinite',
        }} />
      </div>

      <div style={{ fontSize:15, color:C.text, fontWeight:500, marginBottom:8, minHeight:24, transition:'opacity 0.3s' }}>
        {msgs[msgIdx]}
      </div>
      <div style={{ fontSize:13, color:C.muted2, marginBottom:32 }}>
        {progress}% complete
      </div>

      {isFirst && (
        <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap' }}>
          {['No password required','Your data stays private','You stay in control'].map(t => (
            <div key={t} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:C.muted2 }}>
              <span style={{ color:C.green }}>✓</span> {t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pro Upsell Modal ───────────────────────────────────────────
function ProUpsellModal({ platform, onClose, onSkip }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9998,
      background:'rgba(8,10,20,0.85)',
      backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px',
      animation:'fadeUp 0.25s ease both',
    }}>
      <div style={{
        width:'100%', maxWidth:520,
        background:'#0d0f1e',
        borderRadius:20,
        overflow:'hidden',
        position:'relative',
      }}>
        {/* gradient border */}
        <div style={{
          position:'absolute', inset:0, borderRadius:20, padding:1,
          background:'linear-gradient(135deg, rgba(0,180,255,0.5) 0%, rgba(255,255,255,0.04) 40%, rgba(200,0,255,0.4) 100%)',
          WebkitMask:'linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)',
          WebkitMaskComposite:'xor',
          maskComposite:'exclude',
          pointerEvents:'none',
        }} />

        <div style={{ padding:'28px 28px 24px' }}>
          {/* header */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#a855f7', marginBottom:8 }}>Unlock All Platforms</div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'#f8fafc', marginBottom:6, lineHeight:1.3 }}>
              You're adding {platform.name}
            </h2>
            <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>
              Multi-platform tracking is a Pro feature. Upgrade to sync all your platforms and unlock your full earning picture.
            </p>
          </div>

          {/* plan cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>

            {/* Early Adopter — highlighted */}
            <div style={{
              background:'rgba(168,85,247,0.08)',
              border:'1.5px solid rgba(168,85,247,0.5)',
              borderRadius:14, padding:'18px 16px',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{
                position:'absolute', top:0, right:0,
                background:'linear-gradient(135deg,#a855f7,#7c3aed)',
                borderRadius:'0 14px 0 10px',
                padding:'3px 10px', fontSize:10, fontWeight:700, color:'#fff',
                letterSpacing:'0.05em',
              }}>BEST DEAL</div>
              <div style={{ fontSize:11, color:'#a855f7', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>Early Adopter</div>
              <div style={{ fontSize:26, fontWeight:700, color:'#f8fafc', lineHeight:1 }}>$9.99</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>/month · locked forever</div>
              <div style={{ fontSize:11, color:'#64748b', textDecoration:'line-through', marginBottom:14 }}>$19.99/mo after 100 users</div>
              {[
                'All 5 platforms',
                'Save history forever',
                'AI learns your patterns',
                'Fan behavior analysis',
                'Predictive coaching',
                'Lifetime price lock ✦',
              ].map(f => (
                <div key={f} style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:'#cbd5e1', marginBottom:5 }}>
                  <span style={{ color:'#a855f7', fontSize:13 }}>✓</span> {f}
                </div>
              ))}
              <button
                onClick={() => window.open('https://www.camcashgrl.com/pricing', '_blank')}
                style={{
                  width:'100%', marginTop:14, padding:'10px',
                  borderRadius:10, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#a855f7,#7c3aed)',
                  color:'#fff', fontSize:13, fontWeight:700,
                  transition:'opacity 0.15s',
                }}>
                Lock in $9.99/mo →
              </button>
            </div>

            {/* Standard */}
            <div style={{
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:14, padding:'18px 16px',
            }}>
              <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>Standard</div>
              <div style={{ fontSize:26, fontWeight:700, color:'#f8fafc', lineHeight:1 }}>$19.99</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:20 }}>/month</div>
              {[
                'All 5 platforms',
                'Save history forever',
                'AI learns your patterns',
                'Fan behavior analysis',
                'Predictive coaching',
              ].map(f => (
                <div key={f} style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:'#94a3b8', marginBottom:5 }}>
                  <span style={{ color:'#22c55e', fontSize:13 }}>✓</span> {f}
                </div>
              ))}
              <button
                onClick={() => window.open('https://www.camcashgrl.com/pricing', '_blank')}
                style={{
                  width:'100%', marginTop:14, padding:'10px',
                  borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer',
                  background:'rgba(255,255,255,0.05)',
                  color:'#94a3b8', fontSize:13, fontWeight:600,
                  transition:'opacity 0.15s',
                }}>
                Get Standard →
              </button>
            </div>
          </div>

          {/* free tier reminder */}
          <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.18)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#94a3b8', textAlign:'center' }}>
            ✅ <span style={{ color:'#f8fafc' }}>Free tier always exists</span> — your current platform stays free forever.
          </div>

          {/* skip */}
          <div style={{ textAlign:'center' }}>
            <button onClick={onSkip}
              style={{ background:'none', border:'none', fontSize:12, color:'#64748b', cursor:'pointer', textDecoration:'underline' }}>
              Skip for now — continue with one platform
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  // step: 'platform' | 'username' | 'paste' | 'csv' | 'preview' | 'loading' | 'step4' | 'done'
  const [step, setStep] = useState('platform')
  const [platformId, setPlatformId] = useState('chaturbate')
  const [cbUsername, setCbUsername] = useState('')
  const [cbUsernameError, setCbUsernameError] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [parseError, setParseError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [isFirstImport, setIsFirstImport] = useState(true)
  const [showSparkle, setShowSparkle] = useState(false)
  const [importedPlatforms, setImportedPlatforms] = useState([])
  const [showUpsell, setShowUpsell] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState(null)

  // CSV state
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvError, setCsvError] = useState('')
  const csvRef = useRef()

  const platform = PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0]

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data } = await supabase
        .from('beta_users').select('onboarding_complete').eq('user_id', user.id).single()
      if (data?.onboarding_complete) { router.replace('/dashboard'); return }
      setUser(user)
      setBooting(false)
    })()
  }, [router])

  async function markOnboardingComplete() {
    if (!user) return
    await supabase.from('beta_users').upsert({
      user_id: user.id,
      email: user.email,
      onboarding_complete: true,
      signed_up_at: user.created_at,
    }, { onConflict: 'user_id' })
  }

  function handlePlatformSelect(id) {
    if (importedPlatforms.length > 0 && !importedPlatforms.includes(id)) {
      setPendingPlatform(id)
      setShowUpsell(true)
      return
    }
    setPlatformId(id)
    if (id === 'chaturbate') {
      setStep('username')
    } else {
      setStep('paste')
    }
  }

  async function handleUsernameSubmit() {
    setCbUsernameError('')
    const cleaned = cbUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!cleaned) {
      setCbUsernameError('Enter your Chaturbate username to continue.')
      return
    }
    setCbUsername(cleaned)
    // save to profiles immediately so it's available everywhere
    if (user) {
      await supabase
        .from('profiles')
        .upsert({ id: user.id, chaturbate_username: cleaned }, { onConflict: 'id' })
    }
    setStep('paste')
  }

  function handleUpsellSkip() {
    setPlatformId(pendingPlatform)
    setShowUpsell(false)
    setPendingPlatform(null)
    setPasteText('')
    if (pendingPlatform === 'chaturbate') {
      setStep('username')
    } else {
      setStep('paste')
    }
  }

  function handlePreview() {
    setParseError('')
    if (!pasteText.trim()) { setParseError('Paste your tip history above first.'); return }
    const preview = previewFromText(pasteText, platformId)
    if (!preview || preview.count === 0) {
      setParseError("We couldn't find any tip rows in that paste. Make sure you copied the full table including dates and token amounts.")
      return
    }
    setPreviewData(preview)
    setStep('preview')
  }

  async function handleImport() {
    if (!user) return
    setImportError('')
    setStep('loading')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const { blob } = pasteToCSVBlob(pasteText, platformId)
      const file = new File([blob], 'pasted_import.csv', { type: 'text/csv' })

      // simulate minimum loading time for first import feel
      const minWait = isFirstImport ? 5500 : 1800
      const [res] = await Promise.all([
        fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: (() => { const f = new FormData(); f.append('file', file); f.append('platform', platform.name); return f })(),
        }),
        new Promise(r => setTimeout(r, minWait)),
      ])

      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Import failed')

      await markOnboardingComplete()
      setImportResult({ inserted: json.inserted || 0, skipped: json.skipped || 0 })
      setImportedPlatforms(prev => prev.includes(platformId) ? prev : [...prev, platformId])

      if (isFirstImport) {
        setIsFirstImport(false)
        setShowSparkle(true)
        setTimeout(() => setShowSparkle(false), 4000)
        setStep('done')
      } else {
        setStep('step4')
      }
    } catch (e) {
      setImportError(e.message || 'Import failed')
      setStep('preview')
    }
  }

  async function handleCsvUpload(file) {
    if (!file || !user) return
    setCsvUploading(true)
    setCsvError('')
    setStep('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')
      const form = new FormData()
      form.append('file', file)
      form.append('platform', platform.name)
      const minWait = isFirstImport ? 5500 : 1800
      const [res] = await Promise.all([
        fetch('/api/upload', { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}` }, body: form }),
        new Promise(r => setTimeout(r, minWait)),
      ])
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Upload failed')
      await markOnboardingComplete()
      setImportResult({ inserted: json.inserted || 0, skipped: json.skipped || 0 })
      setImportedPlatforms(prev => prev.includes(platformId) ? prev : [...prev, platformId])
      if (isFirstImport) {
        setIsFirstImport(false)
        setShowSparkle(true)
        setTimeout(() => setShowSparkle(false), 4000)
        setStep('done')
      } else {
        setStep('step4')
      }
    } catch (e) {
      setCsvError(e.message || 'Upload failed')
      setStep('csv')
    } finally {
      setCsvUploading(false)
    }
  }

  async function skipToDashboard() {
    await markOnboardingComplete()
    router.push('/dashboard')
  }

  // step index for progress bar
  const STEP_ORDER = ['platform','paste','preview','done']
  const stepIdx = { platform:0, username:1, paste:1, csv:1, preview:2, loading:2, step4:3, done:3 }[step] ?? 0

  if (booting) return (
    <div style={{ minHeight:'100vh', background:'#06070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${C.border2}`, borderTopColor:C.cyan, animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh',
      position:'relative',
      background:`
        radial-gradient(ellipse 80% 60% at 5% 0%, rgba(0,100,255,0.28) 0%, rgba(0,60,180,0.10) 40%, transparent 65%),
        radial-gradient(ellipse 70% 58% at 95% 100%, rgba(220,0,255,0.30) 0%, rgba(180,0,200,0.12) 40%, transparent 65%),
        radial-gradient(ellipse 50% 40% at 50% 50%, rgba(0,20,60,0.6) 0%, transparent 100%),
        #06070f
      `,
      fontFamily:"'Inter', system-ui, sans-serif", color:C.text, padding:'40px 20px 100px',
      overflow:'hidden',
    }}>
      {/* dust/particle texture overlay */}
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:`
          radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px),
          radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)
        `,
        backgroundSize:'120px 120px, 60px 60px',
        backgroundPosition:'0 0, 30px 30px',
        opacity:0.18,
      }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
        @keyframes cardShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 24px 2px rgba(0,229,204,0.12),0 0 0 1px rgba(0,229,204,0.15)}50%{box-shadow:0 0 40px 8px rgba(0,229,204,0.22),0 0 0 1px rgba(0,229,204,0.28)}}
        @keyframes borderGlow{0%,100%{opacity:0.7}50%{opacity:1}}
        .plat-card:hover{border-color:rgba(255,255,255,0.2)!important;background:${C.card2}!important}
        .paste-area:focus{outline:none;border-color:${C.cyanBorder}!important}
        .btn-primary:hover{opacity:0.87}
        .btn-ghost:hover{background:rgba(255,255,255,0.06)!important}
        .skip-link:hover{color:${C.muted}!important}
        .action-card:hover{border-color:rgba(255,255,255,0.16)!important;background:${C.card2}!important}
        .stat-card{position:relative;overflow:hidden;}
        .stat-card::after{content:'';position:absolute;top:0;left:0;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.055),transparent);animation:cardShimmer 2.2s ease 0.4s both;}
        .inner-card{
          position:relative;
          background:rgba(13,15,30,0.82);
          border-radius:20px;
          border:1px solid rgba(255,255,255,0.09);
          box-shadow:
            0 0 0 1px rgba(0,180,255,0.15),
            0 0 40px 0 rgba(0,80,255,0.12),
            inset 0 1px 0 rgba(255,255,255,0.07);
          backdrop-filter:blur(12px);
          padding:32px 28px;
          margin-bottom:0;
        }
        .inner-card::before{
          content:'';
          position:absolute;
          inset:0;
          border-radius:20px;
          padding:1px;
          background:linear-gradient(135deg, rgba(0,180,255,0.5) 0%, rgba(255,255,255,0.04) 40%, rgba(200,0,255,0.4) 100%);
          -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
          -webkit-mask-composite:xor;
          mask-composite:exclude;
          pointer-events:none;
          animation:borderGlow 3s ease-in-out infinite;
        }
        textarea::placeholder{color:${C.muted2};font-family:monospace;font-size:12px}
      `}</style>

      {showSparkle && <Sparkle />}
      {showUpsell && pendingPlatform && (
        <ProUpsellModal
          platform={PLATFORMS.find(p => p.id === pendingPlatform)}
          onClose={() => { setShowUpsell(false); setPendingPlatform(null) }}
          onSkip={handleUpsellSkip}
        />
      )}

      <div style={{ maxWidth:640, margin:'0 auto', position:'relative', zIndex:1 }}>
        <div className="inner-card">

        {/* ── Logo + progress ── */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:20 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:C.cyan, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#0a0b14' }}>$</div>
            <span style={{ fontSize:15, fontWeight:600, color:C.cyan }}>CamCash</span>
          </div>

          {step !== 'done' && step !== 'loading' && (
            <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
              {['platform','paste','preview'].map((_, i) => (
                <div key={i} style={{
                  height:3, width:56, borderRadius:2,
                  background: i < stepIdx ? C.cyan : i === stepIdx ? C.cyan : C.border2,
                  opacity: i <= stepIdx ? 1 : 0.35,
                  transition:'all 0.4s',
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            STEP 1: Platform
        ══════════════════════════════════════ */}
        {step === 'platform' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, marginBottom:10 }}>Step 1 of 3</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8, lineHeight:1.3 }}>Where do you stream?</h1>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>Choose your platform to get started.</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} className="plat-card"
                  onClick={() => handlePlatformSelect(p.id)}
                  style={{
                    background: platformId === p.id ? `rgba(${hexRgb(p.color)},0.12)` : C.card,
                    border: platformId === p.id ? `1.5px solid ${p.color}` : `1px solid ${C.border}`,
                    borderRadius:12, padding:'14px 6px 12px', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                    transition:'all 0.15s',
                  }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:`rgba(${hexRgb(p.color)},0.15)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:p.color }}>{p.short}</div>
                  <span style={{ fontSize:11, fontWeight:500, color: platformId === p.id ? C.text : C.muted, textAlign:'center', lineHeight:1.3 }}>{p.name}</span>
                </button>
              ))}
            </div>

            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, textAlign:'center' }}>
                <span style={{ color:C.cyan, fontWeight:600 }}>Copy your tip history. Paste it once.</span> CamCash turns it into analytics.<br />
                <span style={{ color:C.muted2 }}>Unlock your first insights in about 60 seconds.</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => handlePlatformSelect(platformId)}
              style={{ width:'100%', padding:'14px', borderRadius:12, background:C.cyan, border:'none', color:'#0a0b14', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity 0.15s' }}>
              Continue with {platform.name} →
            </button>
            <div style={{ textAlign:'center', marginTop:14 }}>
              <button className="skip-link" onClick={skipToDashboard}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer', transition:'color 0.15s' }}>
                Skip — explore dashboard without importing
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 1b: Chaturbate username
        ══════════════════════════════════════ */}
        {step === 'username' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#ff6b35', marginBottom:10 }}>Step 1 of 3 — Chaturbate</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8 }}>What's your Chaturbate username?</h1>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>
                We'll open your token stats page directly so you can copy your tip history.
              </p>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:500, color:C.muted, marginBottom:8 }}>Chaturbate username</div>
              <div style={{ position:'relative' }}>
                <span style={{
                  position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                  fontSize:14, color:C.muted2, fontWeight:500, pointerEvents:'none',
                }}>chaturbate.com/p/</span>
                <input
                  type="text"
                  value={cbUsername}
                  onChange={e => { setCbUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')); setCbUsernameError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleUsernameSubmit()}
                  placeholder="yourname"
                  autoFocus
                  style={{
                    width:'100%', padding:'13px 14px 13px 168px',
                    background:C.card, border:`1px solid ${cbUsernameError ? C.red : C.border2}`,
                    borderRadius:10, color:C.text, fontSize:14,
                    fontFamily:'monospace', outline:'none', transition:'border-color 0.15s',
                  }}
                />
              </div>
              {cbUsernameError && (
                <div style={{ marginTop:8, fontSize:12, color:C.red }}>⚠️ {cbUsernameError}</div>
              )}
              {cbUsername && (
                <div style={{ marginTop:8, fontSize:12, color:C.muted2 }}>
                  Your stats page: <span style={{ color:C.cyan }}>chaturbate.com/p/{cbUsername}/?tab=tokens</span>
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={handleUsernameSubmit}
              style={{ width:'100%', padding:'14px', borderRadius:12, background:'#ff6b35', border:'none', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity 0.15s', marginBottom:12 }}>
              Continue →
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button className="skip-link" onClick={() => setStep('platform')}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer' }}>
                ← Back
              </button>
              <span style={{ color:C.muted2, fontSize:12 }}>·</span>
              <button className="skip-link" onClick={() => { setCbUsername(''); setStep('paste') }}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer' }}>
                Skip — I'll navigate there myself
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 2: Paste
        ══════════════════════════════════════ */}
        {step === 'paste' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, marginBottom:10 }}>Step 2 of 3 — {platform.name}</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8 }}>Paste your tip history</h1>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>
                Copy your earnings rows from {platform.name} and paste them below.<br />
                CamCash will clean the data automatically.
              </p>
            </div>

            {/* how-to */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:platform.color }}>
                  How to copy from {platform.name}
                </div>
                <button
                  onClick={() => window.open(platform.earningsUrl(cbUsername), '_blank')}
                  style={{ padding:'5px 12px', borderRadius:6, background:`rgba(${hexRgb(platform.color)},0.12)`, border:`1px solid rgba(${hexRgb(platform.color)},0.3)`, color:platform.color, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  Open earnings page ↗
                </button>
              </div>
              <p style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:12 }}>{platform.hint}</p>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {['No password required','You control what gets imported','Takes about 60 seconds'].map(t => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:C.muted2 }}>
                    <span style={{ color:C.green }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>

            {/* paste box */}
            <textarea
              className="paste-area"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`Paste your ${platform.name} tip history here…\n\nExample:\n${platform.placeholder}`}
              style={{
                width:'100%', minHeight:200, padding:'14px 16px',
                background:C.card, border:`1px solid ${C.border2}`,
                borderRadius:12, color:C.text, fontSize:13, lineHeight:1.6,
                resize:'vertical', fontFamily:'monospace', transition:'border-color 0.15s',
                marginBottom:parseError ? 10 : 16,
              }}
            />

            {parseError && (
              <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:10, background:C.redDim, border:`1px solid rgba(248,113,113,0.25)`, fontSize:13, color:C.red }}>
                ⚠️ {parseError}
              </div>
            )}

            {/* numbered instructions */}
            <div style={{ display:'flex', gap:16, marginBottom:20 }}>
              {['Open your earnings or tip history','Highlight the rows you want','Copy and paste them here'].map((t,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, flex:1 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:C.cyan, flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <span style={{ fontSize:12, color:C.muted2, lineHeight:1.4 }}>{t}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <button className="btn-ghost" onClick={() => setStep('platform')}
                style={{ padding:'12px 18px', borderRadius:10, background:'transparent', border:`1px solid ${C.border2}`, color:C.muted, fontSize:14, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                ← Back
              </button>
              <button className="btn-primary" onClick={handlePreview}
                style={{ flex:1, padding:'12px', borderRadius:10, background:C.cyan, border:'none', color:'#0a0b14', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity 0.15s' }}>
                Preview Import →
              </button>
            </div>
            <div style={{ textAlign:'center' }}>
              <button className="skip-link" onClick={() => setStep('csv')}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer', transition:'color 0.15s' }}>
                Upload CSV instead
              </button>
              <span style={{ color:C.muted2, fontSize:12, margin:'0 10px' }}>·</span>
              <button className="skip-link" onClick={skipToDashboard}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer', transition:'color 0.15s' }}>
                Track future tips instead
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            CSV fallback
        ══════════════════════════════════════ */}
        {step === 'csv' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, marginBottom:10 }}>Step 2 of 3 — {platform.name}</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8 }}>Upload your CSV</h1>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>Export your earnings as a CSV file and drop it below.</p>
            </div>

            <div
              onClick={() => !csvUploading && csvRef.current?.click()}
              style={{
                border:`2px dashed ${C.border2}`, borderRadius:12, padding:'40px 20px',
                textAlign:'center', cursor:csvUploading ? 'not-allowed' : 'pointer',
                background:C.card, marginBottom:16, transition:'all 0.15s',
              }}>
              <input ref={csvRef} type="file" accept=".csv,.txt" style={{ display:'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) handleCsvUpload(f) }} />
              {csvUploading ? (
                <>
                  <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${C.border2}`, borderTopColor:C.cyan, animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
                  <div style={{ fontSize:14, color:C.cyan, fontWeight:500 }}>Uploading…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:32, marginBottom:10 }}>📁</div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:4 }}>Drop your CSV here or click to browse</div>
                  <div style={{ fontSize:12, color:C.muted2 }}>Supports {platform.name} export format</div>
                </>
              )}
            </div>

            {csvError && (
              <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:10, background:C.redDim, border:`1px solid rgba(248,113,113,0.25)`, fontSize:13, color:C.red }}>
                ⚠️ {csvError}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-ghost" onClick={() => setStep('paste')}
                style={{ padding:'12px 18px', borderRadius:10, background:'transparent', border:`1px solid ${C.border2}`, color:C.muted, fontSize:14, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                ← Use paste instead
              </button>
              <button className="btn-ghost" onClick={() => setStep('platform')}
                style={{ padding:'12px 18px', borderRadius:10, background:'transparent', border:`1px solid ${C.border}`, color:C.muted2, fontSize:13, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 3: Preview
        ══════════════════════════════════════ */}
        {step === 'preview' && previewData && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, marginBottom:10 }}>Step 3 of 3</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8 }}>Here's what we found</h1>
              <p style={{ fontSize:14, color:C.muted }}>Review before importing.</p>
            </div>

            {/* stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { label:'Tips found', value:previewData.count.toLocaleString(), color:C.cyan },
                { label:'Est. earnings', value:`$${previewData.usd}`, color:C.green },
                { label:'Unique fans', value:previewData.fans.toLocaleString(), color:C.gold },
              ].map(s => (
                <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:C.muted2, marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 16px', marginBottom:16, fontSize:13, color:C.muted }}>
              <span style={{ color:C.muted2 }}>Date range: </span>
              <span style={{ color:C.text, fontWeight:500 }}>{previewData.from} – {previewData.to}</span>
              {previewData.skipped > 0 && (
                <span style={{ marginLeft:16, color:C.gold }}>⚠️ {previewData.skipped} rows skipped</span>
              )}
            </div>

            {/* teaser insights */}
            {(previewData.topSpender || previewData.bestHour) && (
              <div style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:C.cyan, marginBottom:10 }}>First insights detected</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {previewData.topSpender && (
                    <div style={{ background:C.card, borderRadius:8, padding:'8px 12px', fontSize:12, color:C.muted }}>
                      🐋 Top spender: <span style={{ color:C.text, fontWeight:600 }}>{previewData.topSpender.name}</span> ({previewData.topSpender.tokens.toLocaleString()} tokens)
                    </div>
                  )}
                  {previewData.bestHour && (
                    <div style={{ background:C.card, borderRadius:8, padding:'8px 12px', fontSize:12, color:C.muted }}>
                      ⏰ Best hour: <span style={{ color:C.text, fontWeight:600 }}>{previewData.bestHour}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* sample rows */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:16, overflow:'hidden' }}>
              <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:600, color:C.muted2, textTransform:'uppercase', letterSpacing:'0.06em' }}>Sample rows</div>
              {previewData.sample.map((r, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: i < previewData.sample.length-1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ fontSize:11, color:C.muted2, minWidth:100 }}>{r.ts.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                  <div style={{ fontSize:13, color:C.text, flex:1 }}>{r.username}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.cyan }}>{r.tokens.toLocaleString()}</div>
                  <div style={{ fontSize:12, color:C.green }}>${r.usd.toFixed(2)}</div>
                </div>
              ))}
            </div>

            {importError && (
              <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:10, background:C.redDim, border:`1px solid rgba(248,113,113,0.25)`, fontSize:13, color:C.red }}>
                ⚠️ {importError}
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <button className="btn-ghost" onClick={() => setStep('paste')}
                style={{ padding:'12px 18px', borderRadius:10, background:'transparent', border:`1px solid ${C.border2}`, color:C.muted, fontSize:14, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                ← Edit paste
              </button>
              <button className="btn-primary" onClick={handleImport}
                style={{ flex:1, padding:'12px', borderRadius:10, background:C.cyan, border:'none', color:'#0a0b14', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity 0.15s' }}>
                Import {previewData.count.toLocaleString()} tips →
              </button>
            </div>
            <div style={{ textAlign:'center' }}>
              <button className="skip-link" onClick={() => setStep('csv')}
                style={{ background:'none', border:'none', fontSize:12, color:C.muted2, cursor:'pointer', transition:'color 0.15s' }}>
                Try CSV instead
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            LOADING
        ══════════════════════════════════════ */}
        {step === 'loading' && <LoadingScreen isFirst={isFirstImport} />}

        {/* ══════════════════════════════════════
            STEP 4: Make dashboard smarter
        ══════════════════════════════════════ */}
        {step === 'step4' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:36, marginBottom:16 }}>✅</div>
              <h1 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:8 }}>Make your dashboard smarter</h1>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>
                Add more history or turn on live tracking so CamCash can find stronger patterns.
              </p>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {[
                { icon:'📥', title:'Add more history', sub:'Improve accuracy with more tip data', action:() => { setPasteText(''); setStep('paste') }, color:C.cyan },
                { icon:'📡', title:'Set up live tracking', sub:'Track future tips automatically while you stream', action:() => window.open('https://chrome.google.com/webstore','_blank'), color:C.purple },
                { icon:'📊', title:'Go to dashboard', sub:'See what CamCash found so far', action:() => router.push('/dashboard'), color:C.green },
              ].map(a => (
                <button key={a.title} className="action-card" onClick={a.action}
                  style={{
                    display:'flex', alignItems:'center', gap:14, padding:'16px 18px',
                    background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                    cursor:'pointer', transition:'all 0.15s', textAlign:'left',
                  }}>
                  <div style={{ fontSize:22, width:42, height:42, borderRadius:10, background:`rgba(${hexRgb(a.color)},0.1)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{a.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:2 }}>{a.title}</div>
                    <div style={{ fontSize:12, color:C.muted2 }}>{a.sub}</div>
                  </div>
                  <div style={{ marginLeft:'auto', color:C.muted2, fontSize:16 }}>→</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            DONE / SUCCESS
        ══════════════════════════════════════ */}
        {step === 'done' && importResult && (
          <div style={{ animation:'fadeUp 0.4s ease both', textAlign:'center' }}>
            {/* success icon — subtle glow ring instead of emoji */}
            <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
              <div style={{
                width:72, height:72, borderRadius:'50%',
                background:'radial-gradient(circle, rgba(0,229,204,0.18) 0%, transparent 70%)',
                border:`1.5px solid ${C.cyanBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:32,
                boxShadow:'0 0 32px 6px rgba(0,229,204,0.12), 0 0 0 8px rgba(0,229,204,0.05)',
                animation:'glowPulse 2.5s ease-in-out infinite',
              }}>✦</div>
            </div>
            <h1 style={{ fontSize:26, fontWeight:700, color:C.text, marginBottom:8 }}>Your dashboard is ready</h1>
            <p style={{ fontSize:14, color:C.muted, lineHeight:1.6, maxWidth:400, margin:'0 auto 28px' }}>
              We imported your tip history and found your first insights.
            </p>

            {/* animated stat cards with shimmer */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:24 }}>
              {[
                { label:'Tips imported',    value:importResult.inserted,          color:C.cyan,   prefix:'',  suffix:'',        delay:'0s' },
                { label:'Unique fans',      value:previewData?.fans || 0,         color:C.gold,   prefix:'',  suffix:'',        delay:'0.15s' },
                { label:'Est. earnings',    value:parseFloat(previewData?.usd||0),color:C.green,  prefix:'$', suffix:'',        delay:'0.3s' },
                { label:'Top spender',      value:1,                              color:C.purple, prefix:'',  suffix:' found',  delay:'0.45s' },
              ].map(s => (
                <div key={s.label} className="stat-card"
                  style={{
                    background:C.card,
                    border:`1px solid rgba(${hexRgb(s.color)},0.22)`,
                    borderRadius:14, padding:'18px 14px',
                    boxShadow:`0 0 18px 0 rgba(${hexRgb(s.color)},0.07)`,
                    animation:`fadeUp 0.4s ease ${s.delay} both`,
                  }}>
                  <div style={{ fontSize:11, color:C.muted2, marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:s.color }}>
                    <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={1000} />
                  </div>
                </div>
              ))}
            </div>

            {importResult.skipped > 0 && (
              <div style={{ fontSize:12, color:C.muted2, marginBottom:20 }}>
                ({importResult.skipped} duplicate rows skipped — that's normal)
              </div>
            )}

            <button className="btn-primary" onClick={() => router.push('/dashboard')}
              style={{ width:'100%', padding:'14px', borderRadius:12, background:C.cyan, border:'none', color:'#0a0b14', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity 0.15s', marginBottom:10 }}>
              Go to Dashboard →
            </button>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-ghost" onClick={() => { setPasteText(''); setStep('paste') }}
                style={{ flex:1, padding:'11px', borderRadius:10, background:'transparent', border:`1px solid ${C.border2}`, color:C.muted, fontSize:13, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                Add more history
              </button>
              <button className="btn-ghost" onClick={() => window.open('https://chrome.google.com/webstore','_blank')}
                style={{ flex:1, padding:'11px', borderRadius:10, background:'transparent', border:`1px solid ${C.border2}`, color:C.muted, fontSize:13, fontWeight:500, cursor:'pointer', transition:'background 0.15s' }}>
                Set up live tracking
              </button>
            </div>
          </div>
        )}

        {/* footer */}
        {!['loading','done'].includes(step) && (
          <div style={{ textAlign:'center', marginTop:32, fontSize:12, color:C.muted2 }}>
            🔒 Your data is stored securely and never shared.
          </div>
        )}
        </div>{/* end inner-card */}
      </div>{/* end maxWidth container */}
    </div>
  )
}
