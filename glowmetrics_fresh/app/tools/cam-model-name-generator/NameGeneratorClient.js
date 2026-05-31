'use client'
import { useState, useCallback } from 'react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#05070f',
  surface: '#0d1117',
  card: 'rgba(15,20,32,0.85)',
  border: 'rgba(255,255,255,0.08)',
  indigo: '#7C5CFF',
  cyan: '#22D3EE',
  pink: '#EC4899',
  white: '#F1F5F9',
  muted: '#475569',
  text: '#94A3B8',
  green: '#10B981',
  gold: '#F59E0B',
  red: '#EF4444',
}

// ─── Name data ────────────────────────────────────────────────────────────────
const FIRST = [
  'Ava','Emma','Lily','Sophia','Chloe','Ruby','Mia','Stella','Luna','Aria',
  'Zoe','Jade','Rose','Ivy','Skye','Nova','Sage','Aurora','Willow','Violet',
  'Sierra','Savannah','Piper','Harper','Hazel','Isla','Freya','Nora','Elena',
  'Maya','Layla','Sienna','Brielle','Celeste','Demi','Eve','Fiona','Grace',
  'Hope','Iris','Leah','Mila','Nina','Opal','Quinn','Rae','Seraphina',
  'Tara','Una','Vera','Winter','Xena','Yasmine','Zara',
]
const LAST = [
  'Quinn','Hart','Brooks','Lane','Blake','West','Rose','Stone','Grey','Fox',
  'Reid','Kane','Vale','Cross','Lake','Frost','Hunt','Moore','Nash','Page',
  'Reed','Steele','Vance','Wren','Cruz','Dean','Faye','Gold','Hale','James',
  'King','Lee','Marsh','Neal','Owen','Park','Ray','Shaw','Todd','Vega',
  'Ward','York','Ace','Bay','Cole','Dale','Earl','Fair','Glen','Hayes',
  'Iris','Jay','Knox','Love','May','North','Orr','Penn','Rowe','Sloane',
]
const NICHE_PREFIXES = {
  Goth:          ['Dark','Shadow','Night','Raven','Obsidian','Noir'],
  Gamer:         ['Pixel','Neon','Glitch','Cyber','Binary','Vector'],
  Cosplay:       ['Cosplay','Anime','Mythic','Arcane','Fable'],
  Luxury:        ['Velvet','Crystal','Diamond','Pearl','Satin','Opulent'],
  Dominant:      ['Steel','Iron','Sable','Onyx','Blade'],
  Fitness:       ['Flex','Apex','Peak','Sculpt','Power'],
  Alternative:   ['Storm','Ember','Hex','Static','Volt'],
  'Girl Next Door': ['Sweet','Sunny','Honey','Daisy','Breezy'],
  Elegant:       ['Celeste','Serene','Grace','Lumière','Opale'],
  Mysterious:    ['Myst','Shade','Veil','Cipher','Echo'],
  Submissive:    ['Kitten','Bunny','Dove','Lamb','Fawn'],
  Playful:       ['Fizz','Spark','Pip','Jazz','Brio'],
  Nerdy:         ['Qubit','Axiom','Cipher','Helix','Nexus'],
}
const NICHE_PREFIXES_DEFAULT = ['Luna','Nova','Velvet','Storm','Ember','Sage','Dusk']

const STAGE_PRE = [
  'Velvet','Crimson','Dark','Neon','Pixel','Shadow','Storm','Ember','Jade',
  'Ruby','Sable','Steel','Violet','Silver','Golden','Crystal','Scarlet',
  'Midnight','Electric','Mystic','Obsidian','Ivory','Cosmic','Wild','Feral',
]
const STAGE_SUF = [
  'Vixen','Rose','Quinn','Noir','Bliss','Storm','Vex','Luna','Star','Flame',
  'Frost','Night','Dream','Kitten','Phoenix','Raven','Sage','Ash','Eve','Fox',
  'Sin','Hex','Dawn','Dusk','Echo','Mist','Vale','Isle','Cove','Glow',
]

// ─── Utilities ────────────────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function syllables(word) {
  const m = word.toLowerCase().match(/[aeiouy]{1,2}/g)
  return m ? Math.max(m.length, 1) : 1
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() }

function brandScore(name) {
  let s = 0
  const clean = name.replace(/\s/g, '')
  const words = name.trim().split(/\s+/)
  const syl = words.reduce((acc, w) => acc + syllables(w), 0)

  // Length (max 25)
  if (clean.length >= 8 && clean.length <= 14) s += 25
  else if (clean.length >= 6 && clean.length <= 18) s += 14
  else s += 5

  // Word count (max 20)
  if (words.length === 2) s += 20
  else if (words.length === 1) s += 10
  else s += 4

  // No numbers (max 15)
  s += /\d/.test(name) ? 0 : 15

  // No special chars (max 15)
  s += /[^a-zA-Z\s]/.test(name) ? 0 : 15

  // Syllables 2–4 (max 15)
  s += (syl >= 2 && syl <= 4) ? 15 : syl === 1 ? 6 : 8

  // Strong opener (max 10)
  s += /^[AEILMNRSVaeilmnrsv]/.test(name) ? 10 : 0

  return Math.min(Math.round(s), 100)
}

function scoreColor(s) {
  if (s >= 90) return C.green
  if (s >= 70) return C.cyan
  if (s >= 50) return C.gold
  return C.red
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
  if (/^[AEILMNRSVaeilmnrsv]/.test(name)) out.push('Strong opener')
  const syl = words.reduce((a, w) => a + syllables(w), 0)
  if (syl >= 2 && syl <= 4) out.push('Easy to say')
  if (words.length === 1 && name.length <= 10) out.push('Compact & sharp')
  if (!/[^a-zA-Z\s]/.test(name)) out.push('Clean characters')
  return out.slice(0, 3).length ? out.slice(0, 3) : ['Unique', 'Brandable', 'Memorable']
}

function generateNames(mode, niches, keyword, count) {
  const results = new Set()
  const kw = keyword.trim()
  const attempts = count * 8

  for (let i = 0; i < attempts && results.size < count; i++) {
    let name = ''
    if (mode === 'real') {
      const first = kw ? capitalize(kw) : pick(FIRST)
      name = first + ' ' + pick(LAST)
    } else if (mode === 'hybrid') {
      let pool = []
      niches.forEach(n => { if (NICHE_PREFIXES[n]) pool.push(...NICHE_PREFIXES[n]) })
      if (!pool.length) pool = NICHE_PREFIXES_DEFAULT
      const pre = kw ? capitalize(kw) : pick(pool)
      name = pre + ' ' + pick(FIRST)
    } else {
      const pre = kw ? capitalize(kw) : pick(STAGE_PRE)
      const suf = pick(STAGE_SUF)
      if (pre.toLowerCase() === suf.toLowerCase()) continue
      name = pre + suf
    }
    if (!results.has(name)) results.add(name)
  }

  return [...results].map(name => ({
    name,
    score: brandScore(name),
    strengths: nameStrengths(name),
  }))
}

// ─── Platform data ────────────────────────────────────────────────────────────
const PLATFORMS = {
  cam: [
    { label: 'Chaturbate',  url: 'https://chaturbate.com/accounts/register/', emoji: '🎬' },
    { label: 'Stripchat',   url: 'https://stripchat.com/signup', emoji: '🎬' },
    { label: 'MyFreeCams',  url: 'https://www.myfreecams.com/', emoji: '🎬' },
    { label: 'BongaCams',   url: 'https://bongacams.com/signup', emoji: '🎬' },
    { label: 'CamSoda',     url: 'https://www.camsoda.com/signup', emoji: '🎬' },
  ],
  creator: [
    { label: 'OnlyFans',    url: 'https://onlyfans.com/', emoji: '💙' },
    { label: 'Fansly',      url: 'https://fansly.com/', emoji: '💙' },
  ],
  social: [
    { label: 'Instagram',   url: 'https://www.instagram.com/accounts/emailsignup/', emoji: '📸' },
    { label: 'TikTok',      url: 'https://www.tiktok.com/signup', emoji: '🎵' },
    { label: 'X / Twitter', url: 'https://twitter.com/i/flow/signup', emoji: '✖️' },
    { label: 'Reddit',      url: 'https://www.reddit.com/register/', emoji: '🔴' },
  ],
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Pill({ label, color }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function ScoreBar({ score }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${score}%`, background: scoreColor(score), borderRadius: 3, transition: 'width 0.7s ease' }} />
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.white, fontSize: 14, fontWeight: 600, textAlign: 'left', gap: 12 }}
      >
        <span>{q}</span>
        <span style={{ fontSize: 20, color: C.muted, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 18px 14px', fontSize: 14, color: C.text, lineHeight: 1.75 }}>{a}</div>}
    </div>
  )
}

function SectionHeader({ id, children }) {
  return (
    <div style={{ marginBottom: 24, marginTop: 56 }}>
      <h2 id={id} style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.02em' }}>
        {children}
      </h2>
      <div style={{ width: 40, height: 3, background: C.indigo, borderRadius: 2 }} />
    </div>
  )
}

function NameCard({ item, idx, expanded, onExpand, domainStatus, aiAnalysis, aiLoading, onCopy, copied }) {
  const { name, score, strengths } = item
  const isExpanded = expanded === name
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')

  return (
    <div
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px',
        animation: `fadeIn 0.35s ease ${idx * 0.03}s both`, transition: 'border-color 0.2s',
        borderColor: isExpanded ? `${C.indigo}55` : C.border,
      }}
    >
      <div style={{ fontSize: 19, fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{name}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Brand Score</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(score) }}>{score}/100 · {scoreLabel(score)}</span>
      </div>
      <ScoreBar score={score} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10, marginBottom: 14 }}>
        {strengths.map(s => <Pill key={s} label={s} color={C.cyan} />)}
      </div>

      <div style={{ display: 'flex', gap: 7 }}>
        <button
          onClick={() => onExpand(name)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: isExpanded ? `${C.indigo}22` : 'rgba(255,255,255,0.05)',
            color: isExpanded ? C.indigo : C.muted,
            outline: isExpanded ? `1px solid ${C.indigo}44` : 'none',
            transition: 'all 0.15s',
          }}
        >{isExpanded ? 'Hide ▲' : 'Availability ▼'}</button>
        <button
          onClick={() => onCopy(name)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: copied === name ? `${C.green}18` : 'rgba(255,255,255,0.05)',
            color: copied === name ? C.green : C.muted,
            outline: copied === name ? `1px solid ${C.green}44` : 'none',
            transition: 'all 0.15s',
          }}
        >{copied === name ? '✓ Copied!' : 'Copy Name'}</button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>

          {/* Domain check */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              🌐 Domain Availability
            </div>
            {domainStatus[name] === 'loading' ? (
              <div style={{ fontSize: 13, color: C.muted }}>Checking domains…</div>
            ) : domainStatus[name] && typeof domainStatus[name] === 'object' ? (
              ['com', 'net', 'co'].map(ext => {
                const st = domainStatus[name][ext]
                const color = st === 'available' ? C.green : st === 'taken' ? C.red : C.muted
                const icon = st === 'available' ? '✓' : st === 'taken' ? '✗' : '—'
                const label = st === 'available' ? 'Available' : st === 'taken' ? 'Taken' : 'Unknown'
                return (
                  <div key={ext} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <span style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>{slug}.{ext}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{icon} {label}</span>
                  </div>
                )
              })
            ) : (
              <div style={{ fontSize: 13, color: C.muted }}>Checking…</div>
            )}
          </div>

          {/* Platform links */}
          {[
            { label: 'Cam Platforms', color: C.indigo, items: PLATFORMS.cam },
            { label: 'Creator Platforms', color: C.pink, items: PLATFORMS.creator },
            { label: 'Social', color: C.cyan, items: PLATFORMS.social },
          ].map(({ label, color, items }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(p => (
                  <a
                    key={p.label}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', transition: 'all 0.15s' }}
                  >
                    {p.label} →
                  </a>
                ))}
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 6 }}>
            Username availability is checked during signup. Click any platform above to visit their registration page and search for your username.
          </p>

          {/* AI analysis */}
          <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(124,92,255,0.06)', border: `1px solid rgba(124,92,255,0.2)` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>AI Brand Analysis</div>
            {aiLoading[name] ? (
              <div style={{ fontSize: 13, color: C.muted }}>Analyzing brand…</div>
            ) : aiAnalysis[name]?.error ? (
              <div style={{ fontSize: 13, color: C.muted }}>Analysis unavailable. Set ANTHROPIC_API_KEY to enable.</div>
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
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>Considerations</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {aiAnalysis[name].weaknesses.map(w => <Pill key={w} label={w} color={C.gold} />)}
                    </div>
                  </div>
                )}
                {aiAnalysis[name].recommendation && (
                  <p style={{ fontSize: 13, color: C.text, marginTop: 8, marginBottom: 4, lineHeight: 1.65 }}>
                    <strong style={{ color: C.white }}>Recommendation: </strong>{aiAnalysis[name].recommendation}
                  </p>
                )}
                {aiAnalysis[name].best_for && (
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 0 }}>
                    <strong>Best for: </strong>{aiAnalysis[name].best_for}
                  </p>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NameGeneratorClient() {
  const [mode, setMode]       = useState('real')
  const [niches, setNiches]   = useState([])
  const [keyword, setKeyword] = useState('')
  const [count, setCount]     = useState(25)
  const [names, setNames]     = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded]         = useState(null)
  const [domainStatus, setDomainStatus] = useState({})
  const [aiAnalysis, setAiAnalysis]     = useState({})
  const [aiLoading, setAiLoading]       = useState({})
  const [copied, setCopied]   = useState(null)
  const [ctaName, setCtaName] = useState('')

  const ALL_NICHES = ['Gamer','Goth','Cosplay','Alternative','Dominant','Submissive','Luxury','Girl Next Door','Fitness','Nerdy','Playful','Elegant','Mysterious']

  const toggleNiche = n => setNiches(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])

  const handleGenerate = useCallback(async () => {
    setLoading(true); setNames([]); setExpanded(null)
    await new Promise(r => setTimeout(r, 500))
    const result = generateNames(mode, niches, keyword, count)
    setNames(result)
    if (result.length) setCtaName(result[0].name)
    setLoading(false)
    try {
      const sb = await import('@supabase/supabase-js')
      const cl = sb.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      await cl.from('name_generator_analytics').insert({ mode, niche: niches.join(',') || null, names_generated: count })
    } catch (_) {}
  }, [mode, niches, keyword, count])

  const checkDomain = useCallback(async name => {
    if (domainStatus[name]) return
    setDomainStatus(p => ({ ...p, [name]: 'loading' }))
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=com`).then(r => r.json()).catch(() => null),
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=net`).then(r => r.json()).catch(() => null),
        fetch(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=co`).then(r => r.json()).catch(() => null),
      ])
      const chk = (res, ext) => res?.domains?.some(d => d.name === `${slug}.${ext}`) ? 'taken' : 'available'
      setDomainStatus(p => ({ ...p, [name]: { com: chk(r1,'com'), net: chk(r2,'net'), co: chk(r3,'co') } }))
    } catch (_) {
      setDomainStatus(p => ({ ...p, [name]: { com: 'unknown', net: 'unknown', co: 'unknown' } }))
    }
  }, [domainStatus])

  const getAiAnalysis = useCallback(async name => {
    if (aiAnalysis[name] || aiLoading[name]) return
    setAiLoading(p => ({ ...p, [name]: true }))
    try {
      const res = await fetch('/api/branding-advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      const data = await res.json()
      setAiAnalysis(p => ({ ...p, [name]: data }))
    } catch (_) {
      setAiAnalysis(p => ({ ...p, [name]: { error: true } }))
    } finally {
      setAiLoading(p => ({ ...p, [name]: false }))
    }
  }, [aiAnalysis, aiLoading])

  const handleExpand = name => {
    if (expanded === name) { setExpanded(null); return }
    setExpanded(name)
    checkDomain(name)
    getAiAnalysis(name)
  }

  const copyName = async name => {
    await navigator.clipboard.writeText(name)
    setCopied(name)
    setTimeout(() => setCopied(null), 2000)
  }

  const nameSections = [
    {
      label: '✨ Cute Names', color: C.pink,
      names: ['Lily Quinn','Daisy Hart','Mia Brooks','Chloe Lane','Ivy Rose','Bree Blake','Rae West','Pip Stone','Zoe Reid','Nova Kane','Wren Vale','Fern Cross'],
    },
    {
      label: '💎 Luxury Names', color: C.gold,
      names: ['Celeste Vance','Sophia Steele','Aurora Gold','Pearl Morgan','Velvet Rose','Crystal Hart','Satin Vale','Opal Moore','Sienna Cross','Brielle Frost','Lumière Nash','Diamond Reed'],
    },
    {
      label: '🖤 Goth Names', color: '#A855F7',
      names: ['Raven Cross','Dark Lily','Shadow Quinn','Nyx Stone','Obsidian Eve','Noir Vale','Sable Frost','Ash Blake','Gothic Rose','Hex Lane','Shade Reid','Void Hart'],
    },
    {
      label: '🎮 Cosplay & Gamer Names', color: C.cyan,
      names: ['Pixel Nova','Neon Aria','Glitch Quinn','Cyber Luna','Vector Jade','Binary Skye','Arcade Mia','Static Eve','Bit Lily','Warp Ava','Sprite Rose','Chip Ivy'],
    },
    {
      label: '🌹 Elegant Names', color: C.indigo,
      names: ['Elena Grace','Serene Hart','Aria Quinn','Celeste Moore','Sophia Wren','Isla Reed','Freya Stone','Aurora Vale','Violet Blake','Nora Lane','Willow Gold','Iris Vance'],
    },
    {
      label: '⛓️ Dominant Names', color: C.red,
      names: ['Steel Quinn','Iron Raven','Sable Cross','Onyx Hart','Blade Stone','Feral Rose','Hex Vale','Vex Lane','Reign Blake','Wrath Reid','Siren Fox','Fang Moore'],
    },
    {
      label: '🌿 Alternative Names', color: C.green,
      names: ['Storm Blake','Ember Cross','Echo Stone','Volt Quinn','Static Reed','Myst Lane','Hex Frost','Nyx Hart','Wren Vale','Sage West','Rune Fox','Lore Nash'],
    },
    {
      label: '👔 Professional Names', color: C.text,
      names: ['Emma Quinn','Sophia Hart','Ava Brooks','Lily Lane','Maya Blake','Isla West','Nora Stone','Freya Reid','Elena Kane','Aurora Vale','Harper Cross','Piper Lake'],
    },
  ]

  const faqs = [
    { q: 'What makes a good cam model name?', a: 'A good cam model name is 8–14 characters, two words, free of numbers or special characters, and easy to spell aloud. Real-name-style combinations like Ava Quinn or Luna Hart consistently outperform abstract stage names for fan recall and Google searchability.' },
    { q: 'Should I use my real name as a cam model?', a: 'Never use your legal name. Use a stage name that sounds like a real name — approachable, personal, and easy to remember. Names like Lily Reed or Nova Blake feel authentic without exposing your identity.' },
    { q: 'Should cam models use first and last names?', a: 'Yes. Two-word names score significantly higher on brand recall tests, Google uniqueness, and professional perception. A fan searching your name on Google will find you much faster with "Ava Quinn" than with "Kitten."' },
    { q: 'How do I know if a Chaturbate username is available?', a: 'Visit Chaturbate\'s registration page and enter your preferred username. Chaturbate tells you immediately if it\'s taken. You can also visit any of the platform links in the availability checker above — they all open the registration page where you can test your username.' },
    { q: 'Can I change my cam model name later?', a: 'Most platforms do allow username changes, but it comes at a cost. You lose the SEO history attached to your old name, fans who search for you won\'t find you easily, and cross-platform consistency breaks. Choose a name you can commit to for at least 2–3 years.' },
    { q: 'Should my OnlyFans and Chaturbate names match?', a: 'Absolutely. Consistent usernames across all platforms — cam sites, creator platforms, and social media — dramatically increase discoverability. When a fan sees your Chaturbate name and searches for you on Instagram, matching usernames instantly confirm they found the right person.' },
    { q: 'How important is domain availability?', a: 'Very important if you plan to build a brand long-term. Securing yourname.com gives you a permanent home base, makes you look professional, and prevents impersonators from squatting on your name. The domain checker in this tool checks .com, .net, and .co automatically.' },
    { q: 'What is the brand strength score?', a: 'The brand strength score (0–100) evaluates a name on six criteria: length, word count, absence of numbers, absence of special characters, syllable count, and starting letter strength. Scores of 70+ are strong. Above 90 is exceptional and rare.' },
    { q: 'What are the best cam model name ideas for 2026?', a: 'The strongest cam model names for 2026 combine a clean feminine first name with a strong last name: Ava Quinn, Luna Hart, Nova Blake, Scarlett Reed, Violet Stone. For niche branding: Dark Lily (goth), Pixel Nova (gamer), Crystal Hart (luxury). Use the generator above for instant options.' },
    { q: 'How long should a cam model name be?', a: 'The ideal total length is 8–14 characters. This is long enough to be distinctive and short enough for fans to remember, spell, and type correctly. Names over 18 characters are hard to recall. Names under 6 characters are often too generic or already taken.' },
    { q: 'Should I put numbers in my cam model name?', a: 'No. Numbers reduce brand strength significantly. They look unprofessional, are hard to remember verbally, and hurt your ability to rank in Google. If your preferred name is taken, change a word in the name rather than adding numbers.' },
    { q: 'Can I use my cam model name for a website?', a: 'Yes, and you should plan to. Securing yourname.com as soon as you commit to a name is smart brand protection. It gives you a hub for your fanbase, improves Google discoverability for your name, and protects you from impersonators.' },
    { q: 'What niche cam model names work best?', a: 'Niche names signal your content style clearly: DarkDahlia for goth, PixelKitten for gaming, VelvetRose for luxury. The trade-off is flexibility — niche names are harder to evolve if your content style changes. Real-name-style names give you more room to grow.' },
    { q: 'What are popular cam model name styles in 2026?', a: 'The most popular cam model name formats in 2026 are two-word real-name combinations (Ava Quinn, Emma Hart), nature-inspired names (Willow Reed, Ivy Stone), color-prefix names (Scarlett Lane, Ruby Cross), and hybrid niche names (Dark Ivy, Pixel Nova).' },
    { q: 'How do I build a brand around my cam model name?', a: 'Register the same username across all platforms immediately. Secure your .com domain. Use the same profile photo everywhere. Establish consistent visual branding — a color palette, a font style, a logo. Mention your name during streams so fans can remember and search for you.' },
    { q: 'What is hybrid naming for cam models?', a: 'Hybrid naming combines a niche descriptor with a real-sounding name: Goth Ava, Luna Hart, Velvet Rose. This approach signals your content niche clearly while keeping the approachability of a real name. It scores well on both brand strength and niche clarity.' },
    { q: 'Are cam model names case sensitive?', a: 'Most platforms treat usernames as case-insensitive for availability. If AvaQuinn is registered, avaQuinn is also unavailable. However, the capitalization you choose during registration affects how your name displays on your profile page.' },
    { q: 'How many names should I generate before choosing?', a: 'Generate 50–100 names and shortlist your top 5 before checking availability. Availability will eliminate some candidates; personal preference narrows the rest. Never settle for a name scoring below 70 on the brand scale — the generator is free and unlimited.' },
    { q: 'What makes a cam model name unprofessional?', a: 'Numbers (HotGirl99), excessive X\'s or underscores (XxSexyKittenxX), overly explicit language in the name itself, copying another creator\'s name with minor spelling changes, and names that are very long or hard to spell all reduce professional perception and fan trust.' },
    { q: 'Should I use my cam name on TikTok and Instagram?', a: 'Yes, even if you don\'t post explicit content on those platforms. Maintaining your cam model name on mainstream social platforms builds brand recognition with a broader audience, drives traffic to your cam profiles, and protects your username from being registered by someone else.' },
    { q: 'What first names work best for cam models?', a: 'Names with 2–3 syllables starting with strong consonants or open vowels score highest: Ava, Emma, Luna, Mia, Sophia, Violet, Nova, Iris. These are globally recognized, easy to say, and pair naturally with most last names.' },
    { q: 'What last names work best for cam models?', a: 'Short, clean last names with strong consonants score best: Quinn, Hart, Blake, Stone, Reed, Lane, Cross, Frost. One-syllable last names pair especially well with two-syllable first names for optimal rhythm and memorability.' },
    { q: 'Do cam model names affect earnings?', a: 'Indirectly, yes. A memorable, professional name increases fan retention (they find you again), improves word-of-mouth growth (fans recommend you by name), and creates a perception of professionalism that can command higher tips over time.' },
    { q: 'How does my cam model name affect Google rankings?', a: 'A unique two-word real-name-style name is much easier to rank for than a generic word. If someone searches "Ava Quinn cam model," you will likely appear on page one. If your name is "Kitten," you are competing with millions of results and will never rank effectively.' },
    { q: 'Can two cam models have the same name?', a: 'Not on the same platform — usernames must be unique per platform. However, different platforms can have the same username registered by different people. This is why checking availability across all platforms before committing is critical.' },
    { q: 'What is the difference between a cam model name and a stage name?', a: 'They are the same thing — a professional pseudonym used for performing. Some creators prefer the term "stage name" to emphasize its professional nature. The key distinction is between real-name-style stage names (Ava Quinn) and abstract stage names (VelvetVixen). Real-name-style typically wins long-term.' },
    { q: 'How does CamCash help cam models?', a: 'CamCash tracks your tip earnings at the transaction level, identifies your highest-value fans and their churn risk, shows your peak earning hours and best streaming days, compares your revenue per hour across platforms, and provides AI-powered coaching during live streams. Free during beta.' },
    { q: 'What cam platforms does CamCash support?', a: 'CamCash currently supports Chaturbate, BongaCams, and MyFreeCams via CSV upload and live browser extension capture. Platform comparison lets you see exactly which platform generates the most revenue per hour for your specific audience.' },
    { q: 'How do I export my Chaturbate earnings?', a: 'Log into Chaturbate as a broadcaster, go to Stats & Data → Token Stats, set your date range, and click Download CSV. Upload that file to CamCash for a complete analytics dashboard including top tippers, session breakdown, and peak hour analysis.' },
    { q: 'Is CamCash free?', a: 'Yes. CamCash is completely free during its beta period. Upload your first CSV at camcashgrl.com in under 2 minutes. No credit card required.' },
  ]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .nc:hover { border-color: rgba(124,92,255,0.3) !important; }
        a { transition: opacity 0.15s; } a:hover { opacity: 0.8; }
        button:focus, input:focus { outline: none; }
        input:focus { border-color: rgba(124,92,255,0.5) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '16px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: C.bg, zIndex: 40 }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 18, color: C.white, textDecoration: 'none' }}>
          Cam<span style={{ color: C.cyan }}>Cash</span>
        </a>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <a href="/tools" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>All Tools</a>
          <a href="/guides/cam-model-room-title-generator" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Title Generator</a>
          <a href="/login" style={{ padding: '7px 18px', borderRadius: 8, background: C.indigo, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Sign in</a>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb" style={{ marginBottom: 28, fontSize: 12 }}>
          <a href="/landing" style={{ color: C.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <a href="/tools" style={{ color: C.cyan, textDecoration: 'none' }}>Tools</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Cam Model Name Generator</span>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {['Free Tool', 'No Signup', 'Brand Scoring', 'Domain Check', 'AI Analysis'].map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.25)', color: C.indigo, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t}</span>
            ))}
          </div>
          <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, color: C.white, lineHeight: 1.08, marginBottom: 16, letterSpacing: '-0.03em' }}>
            Cam Model Name Generator
          </h1>
          <p style={{ fontSize: 18, color: C.text, maxWidth: 560, margin: '0 auto 20px', lineHeight: 1.65 }}>
            Generate brandable stage names, check domain availability, and get an AI brand analysis — all in one free tool.
          </p>
          <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 14, color: C.green, fontWeight: 600 }}>
            ✓ Real-name style recommended for long-term brand growth
          </div>
        </div>

        {/* ── BRANDING PHILOSOPHY ─────────────────────────────────────────── */}
        <div style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.18)', borderRadius: 16, padding: '22px 28px', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Why Real-Name Mode is Recommended</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 24px' }}>
            {[
              ['Ava Quinn', 'vs', 'SexyKitten420'],
              ['Emma Hart', 'vs', 'HotCamGirl69'],
              ['Ruby Brooks', 'vs', 'VelvetPrincessXXX'],
            ].map(([good, , bad]) => (
              <div key={good} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{good}</span>
                <span style={{ color: C.muted }}>vs</span>
                <span style={{ color: C.muted, textDecoration: 'line-through' }}>{bad}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            {['Easier to remember','More professional','Better SEO','Stronger domain brand','Long-term growth','Fans can say it aloud'].map(b => (
              <span key={b} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: C.green }}>✓ {b}</span>
            ))}
          </div>
        </div>

        {/* ── GENERATOR FORM ──────────────────────────────────────────────── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '28px 32px', marginBottom: 28, backdropFilter: 'blur(16px)' }}>

          {/* Mode tabs */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Generation Mode</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { val: 'real',   label: '👤 Real Name',  sub: 'Ava Quinn · Emma Hart' },
                { val: 'hybrid', label: '⚡ Hybrid',      sub: 'Goth Ava · Luna Hart' },
                { val: 'stage',  label: '🎭 Stage Name',  sub: 'VelvetVixen · DarkDahlia' },
              ].map(({ val, label, sub }) => (
                <button
                  key={val}
                  onClick={() => setMode(val)}
                  style={{
                    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    background: mode === val ? `linear-gradient(135deg, ${C.indigo}, ${C.pink})` : 'rgba(255,255,255,0.05)',
                    color: mode === val ? '#fff' : C.muted,
                    boxShadow: mode === val ? `0 0 20px ${C.indigo}44` : 'none',
                  }}
                >
                  {label}
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Niche pills */}
          {(mode === 'hybrid' || mode === 'stage') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Niche <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(pick any)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {ALL_NICHES.map(n => (
                  <button key={n} onClick={() => toggleNiche(n)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    background: niches.includes(n) ? `${C.indigo}20` : 'rgba(255,255,255,0.04)',
                    color: niches.includes(n) ? C.indigo : C.muted,
                    outline: niches.includes(n) ? `1px solid ${C.indigo}55` : 'none',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          )}

          {/* Keyword + Count */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ flex: '2 1 200px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Nickname or keyword <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </div>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g. rose, luna, star, jade"
                style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.white, fontSize: 14, transition: 'border-color 0.15s' }}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>How many</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[25, 50, 100].map(n => (
                  <button key={n} onClick={() => setCount(n)} style={{
                    flex: 1, padding: '11px 4px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    background: count === n ? C.indigo : 'rgba(255,255,255,0.05)',
                    color: count === n ? '#fff' : C.muted,
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', transition: 'all 0.2s',
              background: loading ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${C.indigo}, ${C.pink})`,
              color: loading ? C.muted : '#fff',
              boxShadow: loading ? 'none' : `0 0 32px ${C.indigo}50`,
            }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${C.muted}`, borderTopColor: C.white, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating {count} names…
                </span>
              : `⚡ Generate ${count} Names`
            }
          </button>
        </div>

        {/* ── RESULTS ─────────────────────────────────────────────────────── */}
        {names.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: C.muted }}>{names.length} names generated — click any name to check availability & get an AI analysis</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                {[['90+', C.green,'Excellent'], ['70+', C.cyan,'Strong'], ['50+', C.gold,'Good'], ['<50', C.red,'Weak']].map(([r, c, l]) => (
                  <span key={r} style={{ color: c, fontWeight: 600 }}>{r} {l}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14, marginBottom: 32 }}>
              {names.map((item, idx) => (
                <NameCard
                  key={item.name}
                  item={item}
                  idx={idx}
                  expanded={expanded}
                  onExpand={handleExpand}
                  domainStatus={domainStatus}
                  aiAnalysis={aiAnalysis}
                  aiLoading={aiLoading}
                  onCopy={copyName}
                  copied={copied}
                />
              ))}
            </div>

            {/* CTA after results */}
            {ctaName && (
              <div style={{ background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.22)', borderRadius: 16, padding: '32px', textAlign: 'center', marginBottom: 52 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  Ready to build your brand as <span style={{ color: C.indigo }}>{ctaName}</span>?
                </div>
                <p style={{ fontSize: 15, color: C.text, marginBottom: 24, lineHeight: 1.6 }}>
                  CamCash tracks your tips, identifies your top fans, and shows exactly which hours make you the most money — across every platform.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/login" style={{ padding: '12px 28px', borderRadius: 10, background: `linear-gradient(135deg, ${C.indigo}, ${C.pink})`, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 0 24px ${C.indigo}40` }}>
                    Track Your Earnings Free →
                  </a>
                  <a href="/demo" style={{ padding: '12px 28px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                    See Live Demo →
                  </a>
                </div>
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                  {['Find Your Best Hours', 'Analyze Top Tippers', 'Compare Platforms'].map(t => (
                    <span key={t} style={{ fontSize: 13, color: C.muted }}>✓ {t}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SEO CONTENT SECTIONS
        ════════════════════════════════════════════════════════════════════ */}

        {/* SECTION 1 — What Makes a Good Name */}
        <SectionHeader id="what-makes-a-good-cam-model-name">What Makes a Good Cam Model Name?</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          Your cam model name is the foundation of your entire brand. It appears on every platform, shows up in search results, gets spoken aloud by fans recommending you, and is the first impression every new viewer has of you before they see a single second of your content. Most models choose a name quickly without thinking about the long-term consequences — and many end up rebranding years later at significant cost.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          <strong style={{ color: C.white }}>Memorability is the single most important factor.</strong> A name that fans can remember, spell, and say aloud grows organically. When a fan tells their friend "you should check out Ava Quinn," that referral works because the name is clear. When they try to recommend "XxSexyKitten99xX," the referral breaks down immediately.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          <strong style={{ color: C.white }}>Branding potential determines your ceiling.</strong> A name like "Emma Hart" can anchor a website, a merchandise line, a newsletter, a YouTube channel, and a social media presence. It works equally well at 100 viewers and at 10,000. Niche-specific names like "GothKittenXXX" create a ceiling — they're hard to evolve as your audience or content style changes.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          <strong style={{ color: C.white }}>Fan psychology favors approachable names.</strong> Research in creator marketing consistently shows that fans form stronger parasocial bonds with creators who feel like real people. A real-sounding name — Lily Quinn, Ruby Brooks — signals authenticity. Overly sexualized or generic names create distance. The most successful cam models in terms of loyal, high-tipping fanbases almost universally use real-name-style names.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          <strong style={{ color: C.white }}>Searchability determines discoverability.</strong> When someone searches your name on Google, YouTube, Reddit, or TikTok, a unique two-word name will surface your profiles. A generic word name competes with millions of unrelated results. "Ava Quinn cam" will bring up your profiles on page one. "Kitten cam" surfaces everything except you.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 0 }}>
          <strong style={{ color: C.white }}>Professionalism affects tip psychology.</strong> Fans subconsciously tip more to creators who project professionalism. A clean, non-explicit name signals confidence and class. Combined with quality streaming and consistent branding, it elevates the perception of your work and increases the average tip threshold fans feel comfortable crossing.
        </p>

        {/* SECTION 2 — Real Name vs Stage Name */}
        <SectionHeader id="real-name-vs-stage-name">Real Name vs Stage Name: Which Should You Choose?</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          The debate between real-name-style and pure stage names is one of the most common questions new cam models ask. The answer depends on your goals — but the data strongly favors real-name-style for most models.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            {
              title: 'Real Name Style', subtitle: 'e.g. Ava Quinn, Luna Hart', color: C.green,
              pros: ['Better SEO and Google ranking', 'Higher fan memorability', 'Cross-platform consistency', 'Professional perception', 'Works for any content niche', 'Better for website and domain'],
              cons: ['Less niche-specific at a glance', 'May need a unique twist'],
            },
            {
              title: 'Niche Stage Name', subtitle: 'e.g. DarkDahlia, VelvetVixen', color: C.indigo,
              pros: ['Signals your content style instantly', 'Memorable within niche communities', 'Distinctive visual branding', 'Can be very unique'],
              cons: ['Harder to evolve if you pivot', 'Google ranking is difficult', 'Hard for fans to spell/share', 'Limits brand expansion'],
            },
          ].map(({ title, subtitle, color, pros, cons }) => (
            <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{subtitle}</div>
              {pros.map(p => <div key={p} style={{ fontSize: 13, color: C.green, marginBottom: 5 }}>✓ {p}</div>)}
              <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
              {cons.map(c => <div key={c} style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>— {c}</div>)}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          <strong style={{ color: C.white }}>When niche names make sense:</strong> If you are deeply committed to a very specific content identity — gothic, gaming, cosplay — and you do not plan to pivot, a niche name can reinforce your brand within that community. The risk is that niches evolve, platforms change, and the name that felt perfect at 100 viewers may feel limiting at 10,000.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 0 }}>
          <strong style={{ color: C.white }}>The hybrid approach:</strong> Hybrid names like "Goth Ava" or "Pixel Luna" offer a middle ground — they signal niche while maintaining the structure and memorability of a real name. They score well on brand strength and tend to rank in Google searches like "goth cam model" or "gaming cam girl."
        </p>

        {/* SECTION 3 — 100 Name Ideas */}
        <SectionHeader id="100-cam-model-name-ideas">100 Cam Model Name Ideas (Organized by Style)</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 24 }}>
          Browse our curated list of cam model name ideas organized by style and niche. All names below score 70+ on the brand strength scale. Use the generator above to get personalized variations.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {nameSections.map(({ label, color, names: ns }) => (
            <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{label}</div>
              {ns.map(n => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <span style={{ fontSize: 14, color: C.white, fontWeight: 600 }}>{n}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(brandScore(n)) }}>{brandScore(n)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* SECTION 4 — How Top Models Choose */}
        <SectionHeader id="how-top-cam-models-choose-names">How Top Cam Models Choose Their Names</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>
          The most successful cam models — those who build lasting fanbases and consistent income — share a common approach to naming: they treat it as a business decision, not a creative one.
        </p>
        {[
          { title: 'They prioritize memorability over cleverness.', body: 'A name that\'s clever in the moment but hard to spell or remember is a liability. Top earners consistently choose names that fans can recall hours or days after seeing them. The test: can a fan who watched your stream once find you again the next day by searching your name?' },
          { title: 'They choose names that scale.', body: 'The name you start with needs to work equally well at 50 viewers and 50,000. Names that feel edgy or niche at a small scale often feel limiting or embarrassing at a larger scale. Think about where your brand could go in three years.' },
          { title: 'They maintain consistency across every platform.', body: 'Every top model uses the same username on every platform: Chaturbate, OnlyFans, Instagram, TikTok, Reddit. This cross-platform consistency turns casual viewers into loyal fans who can find you everywhere. It also creates a unified Google presence.' },
          { title: 'They check availability before announcing.', body: 'Announcing a name before securing it on every platform is a costly mistake. Register your username everywhere on the same day. If you cannot get consistent usernames, reconsider the name — the value of cross-platform consistency is too high to compromise.' },
        ].map(({ title, body }) => (
          <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 8 }}>{title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: C.text, margin: 0 }}>{body}</p>
          </div>
        ))}

        {/* SECTION 5 — Common Mistakes */}
        <SectionHeader id="cam-model-naming-mistakes">Common Cam Model Naming Mistakes (And How to Avoid Them)</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 20 }}>
          These are the most common naming mistakes that cost cam models fans, earnings, and long-term brand equity:
        </p>
        {[
          { n: '01', title: 'Adding numbers to an already-taken name', body: 'If AvaBrooks is taken, choosing AvaBrooks99 creates a permanent compromise. You will always be the lesser version of the original name. Change a word instead.' },
          { n: '02', title: 'Choosing a name that\'s hard to spell', body: 'Names with unusual spelling (XxSeraphynaxX, Sxyy_Kitten) create barriers. Fans cannot find you by searching, cannot recommend you verbally, and will not bother typing you into search engines.' },
          { n: '03', title: 'Picking a name tied to a trend', body: 'Names referencing current memes, trends, or slang date quickly. A name that felt fresh in 2023 can feel dated by 2025. Choose timeless names that will work for years.' },
          { n: '04', title: 'Copying a popular creator with variations', body: 'Adding "Real," "Official," "xo," or slight spelling changes to a well-known creator\'s name looks unprofessional and can attract accusations of impersonation. Always choose a fully original name.' },
          { n: '05', title: 'Using explicit words in the name itself', body: 'Platform algorithms, payment processors, and mainstream social media increasingly penalize or shadow-ban accounts with explicit words in usernames. Keep the name clean — save explicit content for your content.' },
          { n: '06', title: 'Choosing a name that\'s too long', body: 'Names over 18 characters are nearly impossible for fans to remember, type correctly, or tag on social media. If your name cannot be said in one breath, it\'s too long.' },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 16, marginBottom: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.indigo, opacity: 0.4, minWidth: 28, flexShrink: 0 }}>{n}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, margin: 0 }}>{body}</p>
            </div>
          </div>
        ))}

        {/* SECTION 6 — Personal Brand */}
        <SectionHeader id="how-to-build-a-personal-brand">How to Build a Personal Brand Around Your Cam Name</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 20 }}>
          Your name is the seed. Your brand is the garden. Once you have your name, here is how to build a presence around it:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { step: '1', title: 'Register everywhere on day one', body: 'Chaturbate, OnlyFans, Fansly, Instagram, TikTok, X, Reddit. Every platform on the same day. This protects your username and establishes cross-platform consistency immediately.' },
            { step: '2', title: 'Secure your domain', body: 'yourname.com should be registered within 24 hours of choosing your name. Even if you don\'t build a website immediately, the domain protects your brand. Register .com, .net, and .co if available.' },
            { step: '3', title: 'Create consistent visual identity', body: 'The same profile photo across all platforms. A consistent color palette. A simple logo or wordmark. Visual consistency makes your brand immediately recognizable.' },
            { step: '4', title: 'Use your name constantly', body: 'Mention your name during every stream: "I\'m [Name], welcome." Say it in your bio, your tip menu header, your video titles. Repetition builds recall.' },
            { step: '5', title: 'Track your brand performance', body: 'Use CamCash to see which platforms and hours generate the most fans. Understanding where your audience grows fastest helps you focus your brand-building energy.' },
            { step: '6', title: 'Evolve intentionally', body: 'As your audience grows, you will naturally refine your brand. Consistent content quality, audience engagement, and performance analytics will show you exactly which direction your brand is growing.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.indigo, opacity: 0.5, marginBottom: 8 }}>{step}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: C.text, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Mid-page CamCash mention */}
        <div style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: 12, padding: '18px 22px', marginBottom: 0 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, margin: 0 }}>
            Once you start streaming, knowing your actual numbers — which fans tip the most, which hours make you the most money, which platform has the best ROI — is what separates models who plateau from models who grow. <a href="/landing" style={{ color: C.cyan, textDecoration: 'none', fontWeight: 600 }}>CamCash</a> tracks all of this automatically from your existing platform CSV exports. Free during beta.
          </p>
        </div>

        {/* SECTION 7 — Platform Guide */}
        <SectionHeader id="platform-username-availability-guide">Platform Username Availability Guide</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 20 }}>
          Each major platform has different rules for usernames and different processes for checking availability. Here is what you need to know for each:
        </p>
        {[
          { platform: 'Chaturbate', color: '#F97316', emoji: '🎬', notes: ['Usernames are 3–36 characters', 'Lowercase letters, numbers, and underscores only', 'Cannot start with a number', 'Check availability during account registration', 'Username cannot be changed after registration'] },
          { platform: 'Stripchat', color: '#EF4444', emoji: '🎬', notes: ['Standard alphanumeric usernames', 'Check during signup', 'Username is used across the platform', 'Profile URL format: stripchat.com/yourusername'] },
          { platform: 'OnlyFans', color: '#00AFF0', emoji: '💙', notes: ['Usernames must be unique across the platform', 'Check during account creation', 'Can be changed once after creation', 'Profile URL: onlyfans.com/yourusername'] },
          { platform: 'Instagram', color: '#E1306C', emoji: '📸', notes: ['30 character maximum', 'Letters, numbers, underscores, periods only', 'Username can be changed but changes affect discoverability', 'Case-insensitive for availability checks'] },
          { platform: 'TikTok', color: '#010101', emoji: '🎵', notes: ['24 character maximum', 'Letters, numbers, periods, underscores', 'Can be changed once every 30 days', 'Username is your primary search identity'] },
          { platform: '.com Domain', color: C.gold, emoji: '🌐', notes: ['Check availability with the domain tool above (automatic)', 'Register immediately once you find an available match', 'Use a registrar like Namecheap or Google Domains', 'If .com is taken, .co is the strongest alternative'] },
        ].map(({ platform, color, emoji, notes }) => (
          <div key={platform} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 10 }}>{emoji} {platform}</div>
            {notes.map(n => <div key={n} style={{ fontSize: 13, color: C.text, marginBottom: 5, paddingLeft: 16, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: C.muted }}>·</span>{n}
            </div>)}
          </div>
        ))}

        {/* SECTION 8 — FAQ */}
        <SectionHeader id="faq">Frequently Asked Questions</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 24 }}>
          Everything you need to know about choosing, checking, and building around your cam model name.
        </p>
        {faqs.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}

        {/* FINAL CTA */}
        <div style={{ marginTop: 60, padding: '40px 36px', borderRadius: 20, background: `linear-gradient(135deg, rgba(124,92,255,0.1), rgba(236,72,153,0.08))`, border: '1px solid rgba(124,92,255,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>After You Choose Your Name</div>
          <h2 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: C.white, marginBottom: 12, letterSpacing: '-0.02em' }}>
            Track Your Earnings From Day One
          </h2>
          <p style={{ fontSize: 15, color: C.text, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.65 }}>
            The models who grow fastest are the ones who know their numbers. CamCash shows you your top tippers, best hours, and most profitable platform — for free.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/login" style={{ padding: '13px 30px', borderRadius: 10, background: `linear-gradient(135deg, ${C.indigo}, ${C.pink})`, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
              Start Tracking Free →
            </a>
            <a href="/demo" style={{ padding: '13px 30px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              See How It Works →
            </a>
          </div>
        </div>

        {/* Related links */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>Related Tools & Guides</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['/guides/cam-model-room-title-generator', 'Room Title Generator'],
              ['/guides/cam-model-token-calculator', 'Token Calculator'],
              ['/blog/best-cam-model-tools', 'Best Cam Model Tools'],
              ['/blog/how-to-increase-cam-earnings', 'How to Increase Earnings'],
              ['/blog/how-to-build-loyal-fans', 'How to Build Loyal Fans'],
              ['/guides/cam-model-analytics', 'Cam Model Analytics Guide'],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.cyan, textDecoration: 'none' }}>
                → {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>
    </div>
  )
}
