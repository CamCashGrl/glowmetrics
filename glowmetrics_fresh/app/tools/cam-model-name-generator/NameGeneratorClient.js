'use client'
import { useState, useCallback } from 'react'

const C = {
  bg: '#05070f',
  card: 'rgba(15,20,32,0.8)',
  border: 'rgba(255,255,255,0.08)',
  indigo: '#7C5CFF',
  cyan: '#22D3EE',
  pink: '#EC4899',
  white: '#F1F5F9',
  muted: '#475569',
  text: '#94A3B8',
  green: '#10B981',
  gold: '#F59E0B',
}

// ─── Name data ───────────────────────────────────────────────────────────────

const FIRST = ['Ava','Emma','Lily','Sophia','Chloe','Ruby','Mia','Stella','Luna','Aria','Zoe','Jade','Rose','Ivy','Skye','Nova','Sage','Aurora','Willow','Violet','Sierra','Savannah','Piper','Harper','Hazel','Isla','Freya','Nora','Elena','Maya','Layla','Sienna','Brielle','Celeste','Demi','Eve','Fiona','Grace','Hope','Iris']
const LAST  = ['Quinn','Hart','Brooks','Lane','Blake','West','Rose','Stone','Grey','Fox','Reid','Kane','Vale','Cross','Lake','Frost','Hunt','Moore','Nash','Page','Reed','Steele','Vance','Wren','Cruz','Dean','Faye','Gold','Hale','James','King','Lee','Marsh','Neal','Owen','Park','Ray','Shaw','Todd','Vega','Ward','York','Ace','Bay','Cole','Dale','Earl']

const NICHE_PREFIXES = {
  Goth:       ['Dark','Shadow','Night','Raven'],
  Gamer:      ['Pixel','Neon','Glitch','Cyber'],
  Cosplay:    ['Cosplay','Anime','Pixel'],
  Luxury:     ['Velvet','Crystal','Diamond','Pearl'],
  Dominant:   ['Steel','Iron','Sable'],
  Fitness:    ['Flex','Apex','Peak'],
  Default:    ['Luna','Nova','Velvet','Storm','Ember'],
}

const STAGE_PREFIX = ['Velvet','Crimson','Dark','Neon','Pixel','Shadow','Storm','Ember','Jade','Ruby','Sable','Steel','Violet','Silver','Golden','Crystal','Scarlet','Midnight','Electric','Mystic']
const STAGE_SUFFIX = ['Vixen','Rose','Quinn','Noir','Bliss','Storm','Vex','Luna','Star','Flame','Frost','Night','Dream','Kitten','Phoenix','Raven','Sage','Ash','Eve','Fox']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function syllableCount(word) {
  const m = word.toLowerCase().match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

function brandScore(name) {
  let score = 0
  const len = name.replace(/\s/g, '').length
  if (len >= 8 && len <= 14) score += 25
  else if ((len >= 6 && len <= 7) || (len >= 15 && len <= 18)) score += 15
  else score += 5

  const words = name.trim().split(/\s+/)
  if (words.length === 2) score += 20
  else if (words.length === 1) score += 10
  else score += 5

  if (!/\d/.test(name)) score += 15
  if (!/[^a-zA-Z\s]/.test(name)) score += 15

  const syllables = words.reduce((s, w) => s + syllableCount(w), 0)
  if (syllables >= 2 && syllables <= 4) score += 15
  else score += 8

  if (/^[AELMSVaelmsv]/i.test(name)) score += 10

  return Math.min(score, 100)
}

function scoreColor(s) {
  if (s >= 90) return C.green
  if (s >= 70) return C.cyan
  if (s >= 50) return C.gold
  return '#EF4444'
}

function scoreLabel(s) {
  if (s >= 90) return 'Excellent'
  if (s >= 70) return 'Strong'
  if (s >= 50) return 'Good'
  return 'Weak'
}

function nameStrengths(name) {
  const out = []
  const words = name.trim().split(/\s+/)
  if (words.length === 2) out.push('Two-word brand')
  if (name.length >= 8 && name.length <= 14) out.push('Ideal length')
  if (!/\d/.test(name)) out.push('No numbers')
  if (/^[AELMSV]/i.test(name)) out.push('Strong opener')
  const syl = words.reduce((s, w) => s + syllableCount(w), 0)
  if (syl >= 2 && syl <= 4) out.push('Easy to say')
  if (words.length === 1 && name.length <= 10) out.push('Compact & sharp')
  return out.slice(0, 3).length ? out.slice(0, 3) : ['Unique', 'Brandable', 'Memorable']
}

function generateNames(mode, niches, style, keyword, count) {
  const results = new Set()
  const kw = keyword.trim()
  const nicheKeys = niches.length ? niches : []

  while (results.size < count) {
    let name = ''
    if (mode === 'real') {
      const first = kw || pick(FIRST)
      const last  = pick(LAST)
      name = first.charAt(0).toUpperCase() + first.slice(1) + ' ' + last
    } else if (mode === 'hybrid') {
      let prefixPool = []
      nicheKeys.forEach(n => { if (NICHE_PREFIXES[n]) prefixPool.push(...NICHE_PREFIXES[n]) })
      if (!prefixPool.length) prefixPool = NICHE_PREFIXES.Default
      const prefix = kw || pick(prefixPool)
      const first  = pick(FIRST)
      name = prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' ' + first
    } else {
      const pre = kw || pick(STAGE_PREFIX)
      const suf = pick(STAGE_SUFFIX)
      if (pre.toLowerCase() === suf.toLowerCase()) continue
      name = pre.charAt(0).toUpperCase() + pre.slice(1) + suf
    }
    if (!results.has(name)) results.add(name)
  }

  return [...results].map(name => ({
    name,
    score: brandScore(name),
    strengths: nameStrengths(name),
  }))
}

// ─── Platform config ──────────────────────────────────────────────────────────

const CAM_PLATFORMS = [
  { label: 'Chaturbate',  url: n => `https://chaturbate.com/${n.toLowerCase().replace(/\s/g,'')}/` },
  { label: 'MyFreeCams',  url: n => `https://profiles.myfreecams.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'BongaCams',   url: n => `https://bongacams.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'Stripchat',   url: n => `https://stripchat.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'CamSoda',     url: n => `https://www.camsoda.com/${n.toLowerCase().replace(/\s/g,'')}` },
]
const CREATOR_PLATFORMS = [
  { label: 'OnlyFans', url: n => `https://onlyfans.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'Fansly',   url: n => `https://fansly.com/${n.toLowerCase().replace(/\s/g,'')}` },
]
const SOCIAL_PLATFORMS = [
  { label: 'Instagram', url: n => `https://instagram.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'TikTok',    url: n => `https://tiktok.com/@${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'X / Twitter', url: n => `https://twitter.com/${n.toLowerCase().replace(/\s/g,'')}` },
  { label: 'Reddit',    url: n => `https://reddit.com/user/${n.toLowerCase().replace(/\s/g,'')}` },
]

// ─── Components ───────────────────────────────────────────────────────────────

function Pill({ label, color = C.indigo, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: bg || `${color}22`, border: `1px solid ${color}44`, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function ScoreBar({ score }) {
  const color = scoreColor(score)
  return (
    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', marginTop: 6, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function PlatformRow({ label, url }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 13, color: C.text }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: C.muted }}>? Unknown</span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.cyan, textDecoration: 'none', padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.cyan}33` }}>
          Check →
        </a>
      </div>
    </div>
  )
}

function FAQ({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.white, fontSize: 14, fontWeight: 600, textAlign: 'left' }}
      >
        <span>{question}</span>
        <span style={{ fontSize: 18, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 14px', fontSize: 14, color: C.text, lineHeight: 1.7 }}>
          {answer}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NameGeneratorClient() {
  const [mode, setMode]         = useState('real')
  const [niches, setNiches]     = useState([])
  const [style, setStyle]       = useState('')
  const [keyword, setKeyword]   = useState('')
  const [count, setCount]       = useState(10)
  const [names, setNames]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [domainStatus, setDomainStatus] = useState({})
  const [aiAnalysis, setAiAnalysis]     = useState({})
  const [aiLoading, setAiLoading]       = useState({})
  const [copied, setCopied]     = useState(null)
  const [ctaName, setCtaName]   = useState('')

  const NICHES = ['Gamer','Goth','Cosplay','Alternative','Dominant','Submissive','Luxury','Girl Next Door','Fitness','Nerdy','Playful','Elegant','Mysterious']
  const STYLES = ['Professional','Cute','Sexy','Luxury','Friendly','Unique']

  const toggleNiche = n => setNiches(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setNames([])
    setExpanded(null)
    await new Promise(r => setTimeout(r, 600))
    const result = generateNames(mode, niches, style, keyword, count)
    setNames(result)
    if (result.length) setCtaName(result[0].name)
    setLoading(false)

    // Analytics (fire-and-forget)
    try {
      const sb = await import('@supabase/supabase-js')
      const client = sb.createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      await client.from('name_generator_analytics').insert({
        mode,
        niche: niches.join(',') || null,
        style: style || null,
        names_generated: count,
      })
    } catch (_) {}
  }, [mode, niches, style, keyword, count])

  const checkDomain = useCallback(async (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (domainStatus[name]) return
    setDomainStatus(prev => ({ ...prev, [name]: 'loading' }))
    try {
      const [comRes, netRes, coRes] = await Promise.all([
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=com`).then(r => r.json()).catch(() => null),
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=net`).then(r => r.json()).catch(() => null),
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=co`).then(r => r.json()).catch(() => null),
      ])
      const check = (res, ext) => {
        if (!res || !res.domains) return 'unknown'
        return res.domains.some(d => d.name === `${slug}.${ext}`) ? 'taken' : 'available'
      }
      setDomainStatus(prev => ({
        ...prev,
        [name]: { com: check(comRes, 'com'), net: check(netRes, 'net'), co: check(coRes, 'co') },
      }))
    } catch (_) {
      setDomainStatus(prev => ({ ...prev, [name]: 'error' }))
    }
  }, [domainStatus])

  const getAiAnalysis = useCallback(async (name) => {
    if (aiAnalysis[name] || aiLoading[name]) return
    setAiLoading(prev => ({ ...prev, [name]: true }))
    try {
      const res = await fetch('/api/branding-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      setAiAnalysis(prev => ({ ...prev, [name]: data }))
    } catch (_) {
      setAiAnalysis(prev => ({ ...prev, [name]: { error: true } }))
    } finally {
      setAiLoading(prev => ({ ...prev, [name]: false }))
    }
  }, [aiAnalysis, aiLoading])

  const handleExpand = (name) => {
    if (expanded === name) { setExpanded(null); return }
    setExpanded(name)
    checkDomain(name)
    getAiAnalysis(name)
  }

  const copyName = async (name) => {
    await navigator.clipboard.writeText(name)
    setCopied(name)
    setTimeout(() => setCopied(null), 1800)
  }

  const domainIcon = (status) => {
    if (status === 'available') return { icon: '✓', color: C.green }
    if (status === 'taken')     return { icon: '✗', color: '#EF4444' }
    return { icon: '?', color: C.muted }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .name-card { animation: fadeIn 0.35s ease both; }
        .name-card:hover { border-color: rgba(124,92,255,0.3) !important; }
        button:focus { outline: none; }
        input:focus { outline: none; border-color: rgba(124,92,255,0.5) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 18, color: C.white, textDecoration: 'none' }}>
          Cam<span style={{ color: C.cyan }}>Cash</span>
        </a>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/tools" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Tools</a>
          <a href="/login" style={{ padding: '7px 18px', borderRadius: 8, background: C.indigo, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Sign in</a>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '52px 24px 100px' }}>

        {/* BREADCRUMB */}
        <nav style={{ marginBottom: 28, fontSize: 12 }}>
          <a href="/landing" style={{ color: C.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <a href="/tools" style={{ color: C.cyan, textDecoration: 'none' }}>Tools</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Name Generator</span>
        </nav>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.25)', color: C.indigo, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Free Tool — No signup required
          </span>
          <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, color: C.white, lineHeight: 1.1, marginTop: 18, marginBottom: 14, letterSpacing: '-0.03em' }}>
            Cam Model Name Generator
          </h1>
          <p style={{ fontSize: 17, color: C.text, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Generate brandable stage names and check availability across every major platform instantly.
          </p>
        </div>

        {/* ── GENERATOR FORM ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '28px 32px', marginBottom: 28, backdropFilter: 'blur(16px)' }}>

          {/* Mode tabs */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Generation Mode</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { val: 'real',   label: 'Real Name',   eg: 'e.g. Ava Quinn' },
                { val: 'hybrid', label: 'Hybrid',      eg: 'e.g. Goth Ava, Luna Hart' },
                { val: 'stage',  label: 'Stage Name',  eg: 'e.g. VelvetVixen, DarkDahlia' },
              ].map(({ val, label, eg }) => (
                <button
                  key={val}
                  onClick={() => setMode(val)}
                  style={{
                    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: mode === val ? `linear-gradient(135deg, ${C.indigo}, ${C.pink})` : 'rgba(255,255,255,0.05)',
                    color: mode === val ? '#fff' : C.muted,
                    boxShadow: mode === val ? `0 0 20px ${C.indigo}44` : 'none',
                  }}
                >
                  {label}
                  <span style={{ fontSize: 11, display: 'block', opacity: 0.7, fontWeight: 400, marginTop: 2 }}>{eg}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Niche multi-select */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
              Niche <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional, pick any)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {NICHES.map(n => (
                <button
                  key={n}
                  onClick={() => toggleNiche(n)}
                  style={{
                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: niches.includes(n) ? `${C.indigo}22` : 'rgba(255,255,255,0.04)',
                    color: niches.includes(n) ? C.indigo : C.muted,
                    outline: niches.includes(n) ? `1px solid ${C.indigo}66` : '1px solid transparent',
                  }}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Style single-select */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
              Style <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(prev => prev === s ? '' : s)}
                  style={{
                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: style === s ? `${C.cyan}18` : 'rgba(255,255,255,0.04)',
                    color: style === s ? C.cyan : C.muted,
                    outline: style === s ? `1px solid ${C.cyan}55` : '1px solid transparent',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Keyword + Count row */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Keyword <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </div>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="e.g. rose, luna, star"
                style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.white, fontSize: 14, transition: 'border-color 0.15s' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>How Many</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[10, 25, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    style={{
                      flex: 1, padding: '11px 4px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                      background: count === n ? C.indigo : 'rgba(255,255,255,0.05)',
                      color: count === n ? '#fff' : C.muted,
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', transition: 'all 0.2s',
              background: loading ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${C.indigo}, ${C.pink})`,
              color: loading ? C.muted : '#fff',
              boxShadow: loading ? 'none' : `0 0 32px ${C.indigo}55`,
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${C.muted}`, borderTopColor: C.white, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating names...
              </span>
            ) : '⚡ Generate Names'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* ── RESULTS GRID ── */}
        {names.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{names.length} names generated</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
              {names.map(({ name, score, strengths }, idx) => (
                <div
                  key={name}
                  className="name-card"
                  style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px',
                    animationDelay: `${idx * 0.04}s`, transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.01em' }}>{name}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Brand Score</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(score) }}>{score} — {scoreLabel(score)}</span>
                  </div>
                  <ScoreBar score={score} />

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12, marginBottom: 14 }}>
                    {strengths.map(s => <Pill key={s} label={s} color={C.cyan} />)}
                  </div>

                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      onClick={() => handleExpand(name)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: expanded === name ? `${C.indigo}22` : 'rgba(255,255,255,0.05)',
                        color: expanded === name ? C.indigo : C.muted,
                        outline: expanded === name ? `1px solid ${C.indigo}44` : 'none',
                      }}
                    >
                      {expanded === name ? 'Hide ▲' : 'Check ▼'}
                    </button>
                    <button
                      onClick={() => copyName(name)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: copied === name ? `${C.green}22` : 'rgba(255,255,255,0.05)',
                        color: copied === name ? C.green : C.muted,
                        outline: copied === name ? `1px solid ${C.green}44` : 'none',
                      }}
                    >
                      {copied === name ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* ── AVAILABILITY PANEL ── */}
                  {expanded === name && (
                    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>

                      {/* CAM PLATFORMS */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Cam Platforms</div>
                      {CAM_PLATFORMS.map(p => <PlatformRow key={p.label} label={p.label} url={p.url(name)} />)}

                      {/* CREATOR */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.pink, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>Creator Platforms</div>
                      {CREATOR_PLATFORMS.map(p => <PlatformRow key={p.label} label={p.label} url={p.url(name)} />)}

                      {/* SOCIAL */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>Social</div>
                      {SOCIAL_PLATFORMS.map(p => <PlatformRow key={p.label} label={p.label} url={p.url(name)} />)}

                      {/* DOMAINS */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>Domains</div>
                      {domainStatus[name] === 'loading' ? (
                        <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>Checking domains…</div>
                      ) : domainStatus[name] && typeof domainStatus[name] === 'object' ? (
                        ['com', 'net', 'co'].map(ext => {
                          const s = domainStatus[name][ext]
                          const { icon, color } = domainIcon(s)
                          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
                          return (
                            <div key={ext} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: 13, color: C.text }}>{slug}.{ext}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color }}>{icon} {s === 'available' ? 'Available' : s === 'taken' ? 'Taken' : 'Unknown'}</span>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>Domain check pending…</div>
                      )}

                      {/* ── AI BRANDING ADVISOR ── */}
                      <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.18)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>AI Branding Advisor</div>
                        {aiLoading[name] ? (
                          <div style={{ fontSize: 13, color: C.muted }}>Analyzing brand…</div>
                        ) : aiAnalysis[name]?.error ? (
                          <div style={{ fontSize: 13, color: C.muted }}>Analysis unavailable — API not configured.</div>
                        ) : aiAnalysis[name] ? (
                          <>
                            {aiAnalysis[name].strengths?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>Strengths</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {aiAnalysis[name].strengths.map(s => <Pill key={s} label={s} color={C.green} />)}
                                </div>
                              </div>
                            )}
                            {aiAnalysis[name].weaknesses?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>Watch out for</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {aiAnalysis[name].weaknesses.map(w => <Pill key={w} label={w} color={C.gold} />)}
                                </div>
                              </div>
                            )}
                            {aiAnalysis[name].recommendation && (
                              <p style={{ fontSize: 13, color: C.text, marginTop: 8, marginBottom: 4, lineHeight: 1.6 }}>
                                <strong style={{ color: C.white }}>Recommendation:</strong> {aiAnalysis[name].recommendation}
                              </p>
                            )}
                            {aiAnalysis[name].best_for && (
                              <p style={{ fontSize: 12, color: C.muted, marginBottom: 0, lineHeight: 1.5 }}>
                                <strong>Best for:</strong> {aiAnalysis[name].best_for}
                              </p>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 13, color: C.muted }}>Loading analysis…</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── CTA ── */}
            {ctaName && (
              <div style={{ background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.2)', borderRadius: 16, padding: '28px 32px', textAlign: 'center', marginBottom: 52 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8 }}>
                  Ready to track your earnings as <span style={{ color: C.indigo }}>{ctaName}</span>?
                </div>
                <p style={{ fontSize: 15, color: C.text, marginBottom: 20, lineHeight: 1.6 }}>
                  CamCash tracks your tips, fans, and peak hours across every platform. Free during beta.
                </p>
                <a href="/signup" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 10, background: `linear-gradient(135deg, ${C.indigo}, ${C.pink})`, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 0 28px ${C.indigo}44` }}>
                  Start tracking free →
                </a>
              </div>
            )}
          </>
        )}

        {/* ── SEO CONTENT ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 52 }}>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 16, letterSpacing: '-0.02em' }}>
            How to Choose the Perfect Cam Model Name
          </h2>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: C.text, marginBottom: 16 }}>
            Your cam model name is your brand. It follows you across every platform, shows up in search results, and is the first thing fans see when they find your room. Getting it right matters more than most new models realize — and changing it later costs you the SEO and brand equity you've built.
          </p>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: C.text, marginBottom: 16 }}>
            <strong style={{ color: C.white }}>Why real-name-style names work better long-term.</strong> Names like "Ava Quinn" or "Luna Hart" outperform stage names like "VelvetVixen" in Google search because they match how people actually search for creators. They're also easier for fans to remember and spell. Two-word names in particular score highest for brand recall — viewers can say them out loud, recommend them to friends, and find them again easily.
          </p>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: C.text, marginBottom: 16 }}>
            <strong style={{ color: C.white }}>What makes a name memorable.</strong> The best cam model names are 8–14 characters, have 2–4 syllables across both words, start with a strong consonant or open vowel (A, E, L, M, S, V), and contain no numbers or special characters. Numbers and underscores break discoverability — "ava_quinn99" is harder to find and remember than "Ava Quinn." The brand strength score in this tool calculates exactly these factors.
          </p>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: C.text, marginBottom: 32 }}>
            <strong style={{ color: C.white }}>Check availability before committing.</strong> Register your username on your primary cam platform, OnlyFans, Instagram, and TikTok before announcing your name publicly. Inconsistency across platforms fragments your audience — when fans search "Ava Quinn cam" they expect to find you at every link. Use the availability checker above to open each platform's profile URL and check manually before deciding.
          </p>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 20, letterSpacing: '-0.02em' }}>
            Frequently Asked Questions
          </h2>

          {[
            {
              question: 'What makes a good cam model name?',
              answer: 'A good cam model name is 8–14 characters, two words, easy to spell and pronounce, and consistent with your brand identity. It should score at least 70 on the brand strength scale. Two-word names like "Ava Quinn" or "Luna Hart" consistently outperform one-word stage names for searchability and fan recall.',
            },
            {
              question: 'Should I use my real name as a cam model?',
              answer: 'No — never use your legal name. Use a stage name that feels like a real name. Names like "Lily Reed" or "Nova Blake" feel personal and authentic without exposing your real identity. They\'re also significantly better for SEO than abstract stage names.',
            },
            {
              question: 'How do I check if a cam name is taken?',
              answer: 'Use the "Check Availability" button on each generated name above. It opens the profile URL for each platform so you can verify instantly. For domains, the tool automatically checks .com, .net, and .co availability using a public domain registry API.',
            },
            {
              question: 'What are the best cam model name ideas?',
              answer: 'The best names combine a feminine first name with a strong last name: Ava Quinn, Luna Hart, Nova Blake, Scarlett Reed, Violet Stone. For niche branding, hybrid names work well: Dark Lily (goth), Pixel Nova (gamer), Crystal Hart (luxury). Use the generator above to get 10–50 options instantly.',
            },
            {
              question: 'Can I change my cam name later?',
              answer: 'Yes, but it\'s costly. You lose any SEO ranking your original name had, fans who search for you by name won\'t find you, and cross-platform consistency breaks. Pick a name you can commit to for at least 2–3 years before choosing.',
            },
            {
              question: 'Should my cam name match across all platforms?',
              answer: 'Absolutely. Consistent usernames across Chaturbate, OnlyFans, Instagram, TikTok, and any fan sites dramatically increase discoverability. When a fan sees your Chaturbate name and searches for you on Instagram, finding the exact same username confirms they\'ve found the right person.',
            },
            {
              question: 'What is a brand strength score?',
              answer: 'The brand strength score (0–100) rates a name on five factors: length (ideal 8–14 chars), word count (two words score highest), absence of numbers, absence of special characters, syllable count (2–4 is optimal), and starting consonant or vowel. Scores of 70+ are strong. Scores above 90 are exceptional.',
            },
            {
              question: 'How many names should I generate?',
              answer: 'Generate 25–50 and shortlist your top 5 before checking availability. Availability will eliminate some; personal preference will narrow the rest. Don\'t settle for a name that\'s less than 70 on the brand score — there are infinite combinations and the generator is free to run as many times as you want.',
            },
          ].map(({ question, answer }) => (
            <FAQ key={question} question={question} answer={answer} />
          ))}
        </div>

      </div>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>
    </div>
  )
}
