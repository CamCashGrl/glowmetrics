'use client'
import { useState, useCallback, useEffect } from 'react'
import Button from '../../../components/ui/Button'

const C = {
  bg: '#030711', surface: '#0a0f1e', glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)', indigo: '#7C5CFF', cyan: '#22D3EE',
  pink: '#EC4899', white: '#F1F5F9', muted: '#475569', text: '#94A3B8',
  green: '#10B981', gold: '#F59E0B', red: '#EF4444', purple: '#A855F7',
}

const MODES = [
  { id: 'real',         label: 'Real Name',    icon: '👤', sub: 'Ava Quinn · Emma Hart',       color: C.cyan },
  { id: 'luxury',       label: 'Luxury',       icon: '💎', sub: 'Crystal Hart · Pearl Vance',  color: C.gold },
  { id: 'elegant',      label: 'Elegant',      icon: '🌸', sub: 'Celeste Moore · Aria Quinn',   color: C.pink },
  { id: 'gamer',        label: 'Gamer',        icon: '🎮', sub: 'Pixel Nova · Neon Aria',       color: C.cyan },
  { id: 'goth',         label: 'Goth',         icon: '🖤', sub: 'Raven Cross · Shadow Quinn',   color: C.purple },
  { id: 'cosplay',      label: 'Cosplay',      icon: '🎭', sub: 'Arcane Luna · Mythic Rose',    color: '#8B5CF6' },
  { id: 'dominant',     label: 'Dominant',     icon: '⛓️', sub: 'Steel Quinn · Iron Raven',    color: C.red },
  { id: 'softgirl',     label: 'Soft Girl',    icon: '🌷', sub: 'Honey Blossom · Sweet Nova',  color: '#FDA4AF' },
  { id: 'milf',         label: 'Milf',         icon: '🔥', sub: 'Scarlett Lane · Vivian Gold', color: C.gold },
  { id: 'alternative',  label: 'Alternative',  icon: '⚡', sub: 'Storm Blake · Ember Cross',   color: C.green },
  { id: 'professional', label: 'Professional', icon: '👔', sub: 'Emma Quinn · Sophia Hart',    color: C.text },
]

const FIRST = ['Ava','Emma','Lily','Sophia','Chloe','Ruby','Mia','Stella','Luna','Aria','Zoe','Jade','Rose','Ivy','Skye','Nova','Sage','Aurora','Willow','Violet','Sierra','Savannah','Piper','Harper','Hazel','Isla','Freya','Nora','Elena','Maya','Layla','Sienna','Brielle','Celeste','Demi','Eve','Fiona','Grace','Hope','Iris','Leah','Mila','Nina','Opal','Quinn','Rae','Tara','Vera','Winter','Zara']
const LAST  = ['Quinn','Hart','Brooks','Lane','Blake','West','Rose','Stone','Grey','Fox','Reid','Kane','Vale','Cross','Lake','Frost','Hunt','Moore','Nash','Page','Reed','Steele','Vance','Wren','Cruz','Dean','Faye','Gold','Hale','James','King','Lee','Marsh','Neal','Owen','Park','Ray','Shaw','Todd','Vega','Ward','York','Cole','Dale','Glen','Hayes','Knox','Love','May','North','Penn','Rowe','Sloane']

const MODE_DATA = {
  real:         { firsts: FIRST, lasts: LAST, style: 'two' },
  luxury:       { firsts: ['Crystal','Pearl','Velvet','Satin','Diamond','Opal','Jade','Amber','Ivory','Celeste','Sienna','Aurora'], lasts: LAST, style: 'two' },
  elegant:      { firsts: ['Celeste','Aria','Seraphina','Aurora','Isla','Elena','Freya','Nora','Sophia','Elara','Vivienne','Rosalind','Imogen','Beatrice'], lasts: LAST, style: 'two' },
  gamer:        { prefixes: ['Pixel','Neon','Glitch','Cyber','Binary','Vector','Arcade','Static','Warp','Sprite','Byte','Hex','Volt','Chip','Flux'], firsts: FIRST, style: 'hybrid' },
  goth:         { prefixes: ['Dark','Shadow','Night','Raven','Obsidian','Noir','Sable','Ash','Hex','Void','Onyx','Shade','Myst','Wraith','Dusk'], firsts: FIRST, style: 'hybrid' },
  cosplay:      { prefixes: ['Arcane','Mythic','Fable','Legend','Realm','Spell','Rune','Lore','Ether','Astral','Elven','Lunar'], firsts: FIRST, style: 'hybrid' },
  dominant:     { prefixes: ['Steel','Iron','Sable','Onyx','Blade','Reign','Wrath','Feral','Vex','Fang','Crest','Siege'], firsts: FIRST, style: 'hybrid' },
  softgirl:     { prefixes: ['Honey','Daisy','Breezy','Sweet','Sunny','Rosy','Blush','Peach','Cherry','Sugar','Cotton','Dewy'], firsts: FIRST, style: 'hybrid' },
  milf:         { firsts: ['Scarlett','Vivian','Veronica','Victoria','Natasha','Serena','Valentina','Camille','Adriana','Isabelle','Roxanne','Simone','Cassandra','Bianca'], lasts: LAST, style: 'two' },
  alternative:  { prefixes: ['Storm','Ember','Static','Volt','Echo','Myst','Rune','Ash','Flux','Dusk','Nyx','Hex','Lore'], firsts: FIRST, style: 'hybrid' },
  professional: { firsts: ['Emma','Sophia','Ava','Lily','Maya','Isla','Nora','Freya','Elena','Aurora','Harper','Piper','Claire','Grace'], lasts: LAST, style: 'two' },
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() }
function syllables(w) { const m = w.toLowerCase().match(/[aeiouy]{1,2}/g); return m ? Math.max(m.length,1) : 1 }

function computeScores(name) {
  const clean = name.replace(/\s/g,'')
  const words = name.trim().split(/\s+/)
  const syl = words.reduce((a,w) => a + syllables(w), 0)
  const len = clean.length

  let brand = 0
  if (len >= 8 && len <= 14) brand += 25; else if (len >= 6 && len <= 18) brand += 14; else brand += 5
  if (words.length === 2) brand += 20; else if (words.length === 1) brand += 10; else brand += 4
  brand += /\d/.test(name) ? 0 : 15
  brand += /[^a-zA-Z\s]/.test(name) ? 0 : 15
  brand += (syl >= 2 && syl <= 4) ? 15 : syl === 1 ? 6 : 8
  brand += /^[AEILMNRSVaeilmnrsv]/.test(name) ? 10 : 0
  brand = Math.min(Math.round(brand), 100)

  let seo = 40
  if (words.length === 2) seo += 30
  if (!/\d/.test(name)) seo += 15
  if (len >= 8 && len <= 16) seo += 10
  if (/^[A-Z]/.test(name)) seo += 5
  seo = Math.min(seo, 100)

  let mem = 30
  if (syl >= 3 && syl <= 5) mem += 30; else if (syl === 2) mem += 20
  if (words.length === 2) mem += 20
  if (/^[AEILMNRSVaeilmnrsv]/i.test(name)) mem += 10
  if (len >= 7 && len <= 13) mem += 10
  mem = Math.min(mem, 100)

  let search = 35
  if (words.length === 2) search += 35
  if (!/\d/.test(name) && !/[^a-zA-Z\s]/.test(name)) search += 20
  if (len >= 8 && len <= 14) search += 10
  search = Math.min(search, 100)

  let social = 40
  if (clean.length >= 6 && clean.length <= 14) social += 30
  if (/^[A-Za-z]/.test(clean)) social += 15
  if (!/[^a-zA-Z0-9]/.test(clean)) social += 15
  social = Math.min(social, 100)

  return { brand, seo, memorability: mem, searchability: search, social }
}

function overallScore(scores) {
  return Math.round(scores.brand*0.3 + scores.seo*0.2 + scores.memorability*0.2 + scores.searchability*0.2 + scores.social*0.1)
}

function getScoreColor(s) {
  if (s >= 90) return C.green
  if (s >= 75) return C.cyan
  if (s >= 60) return C.gold
  return C.red
}
function getScoreLabel(s) {
  if (s >= 90) return 'Excellent'
  if (s >= 75) return 'Strong'
  if (s >= 60) return 'Good'
  return 'Fair'
}

function buildAnalysis(name, scores) {
  const words = name.trim().split(/\s+/)
  const syl = words.reduce((a,w) => a + syllables(w), 0)
  const overall = overallScore(scores)
  const strengths = []
  const tips = []
  if (words.length === 2) strengths.push('Two-word structure ranks uniquely on Google')
  if (scores.memorability >= 75) strengths.push('High memorability — fans recall this after one stream')
  if (scores.seo >= 75) strengths.push('SEO-strong — will rank page one for branded searches')
  if (scores.social >= 75) strengths.push('Clean social handle across every platform')
  if (/^[AEILMNRSVaeilmnrsv]/i.test(name)) strengths.push('Strong opening letter creates confident first impression')
  if (syl >= 3 && syl <= 4) strengths.push('Natural rhythm (3-4 syllables) — easy to say and share')
  if (!/\d/.test(name)) strengths.push('No numbers — professional appearance on all platforms')
  if (scores.brand < 70) tips.push('A two-word structure would boost brand potential significantly')
  if (scores.seo < 60) tips.push('A more unique pairing would improve Google discoverability')
  if (name.replace(/\s/g,'').length > 16) tips.push('Slightly long — a shorter version is easier for fans to type')
  if (words.length === 1) tips.push('Adding a surname creates a more searchable, unique identity')
  const bestFor = overall >= 85 ? 'Long-term brand building, domain registration, all platforms'
    : overall >= 70 ? 'Cross-platform consistency, professional presence, social growth'
    : 'Niche community building, specific platform identity'
  return { strengths: strengths.slice(0,3), tips: tips.slice(0,2), bestFor }
}

function getRoast(name, scores) {
  const overall = overallScore(scores)
  const words = name.trim().split(/\s+/)
  if (overall >= 90) return '🔥 10/10. Your future fans are already searching for you.'
  if (overall >= 80) return '✨ Solid. This name will age well — zero cringe in 2 years.'
  if (overall >= 70) return '👍 Strong foundation. Not iconic yet, but close. Generate a few more to compare.'
  if (/\d/.test(name)) return '💀 The number has to go. Fans think every good name was taken. Try a variation without it.'
  if (words.length === 1) return '😬 One word means zero Google presence. Add a last name and watch the scores jump.'
  if (name.replace(/\s/g,'').length > 18) return '😅 Longer than most OnlyFans bios. Fans will never type this correctly. Shorten it.'
  if (overall >= 60) return '🤔 Middle of the pack. Generate a few more — you\'ll find something stronger.'
  return '⚠️ Needs work. Adjust the structure for a significantly better result.'
}

function generateNames(modeId, keyword, count) {
  const data = MODE_DATA[modeId] || MODE_DATA.real
  const results = new Set()
  const kw = keyword.trim()
  const attempts = count * 12
  for (let i = 0; i < attempts && results.size < count; i++) {
    let name = ''
    if (data.style === 'two') {
      const first = kw ? capitalize(kw) : pick(data.firsts)
      const last = pick(data.lasts)
      if (first.toLowerCase() !== last.toLowerCase()) name = `${first} ${last}`
    } else {
      const pre = kw ? capitalize(kw) : pick(data.prefixes)
      const first = pick(data.firsts)
      if (pre.toLowerCase() !== first.toLowerCase()) name = `${pre} ${first}`
    }
    if (name && !results.has(name)) results.add(name)
  }
  return [...results].map(name => {
    const scores = computeScores(name)
    return { name, scores, analysis: buildAnalysis(name, scores), roast: getRoast(name, scores) }
  }).sort((a,b) => overallScore(b.scores) - overallScore(a.scores))
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AnimatedBar({ score, color, delay = 0 }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        height: '100%', width: `${score}%`, background: color,
        borderRadius: 3, animation: `scoreGrow 0.9s ease ${delay}s both`,
        boxShadow: `0 0 8px ${color}60`,
      }} />
    </div>
  )
}

function ScoreRow({ label, score, delay }) {
  const color = getScoreColor(score)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{score} <span style={{ opacity: 0.6 }}>{getScoreLabel(score)}</span></span>
      </div>
      <AnimatedBar score={score} color={color} delay={delay} />
    </div>
  )
}

function NameCard({ item, idx, favorites, onFavorite, compareList, onCompare, copied, onCopy, domainStatus, onCheckDomain }) {
  const { name, scores, analysis, roast } = item
  const overall = overallScore(scores)
  const isFav = favorites.has(name)
  const isCompared = compareList.includes(name)
  const compareDisabled = compareList.length >= 2 && !isCompared
  const [showRoast, setShowRoast] = useState(false)
  const [showDomain, setShowDomain] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g,'')
  const overallColor = getScoreColor(overall)

  const handleDomain = () => {
    setShowDomain(v => !v)
    if (!domainStatus[name]) onCheckDomain(name)
  }

  return (
    <div className="name-card" style={{
      background: 'rgba(10,15,30,0.88)', backdropFilter: 'blur(20px)',
      border: `1px solid ${isCompared ? C.indigo+'66' : isFav ? C.gold+'44' : C.border}`,
      borderRadius: 18, padding: '20px 22px',
      animation: `fadeInUp 0.4s ease ${idx * 0.035}s both`,
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 3 }}>{name}</div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>@{slug}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: overallColor, lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Overall</div>
        </div>
      </div>

      {/* Score bars */}
      <ScoreRow label="Brand"        score={scores.brand}         delay={idx*0.035+0.1} />
      <ScoreRow label="SEO"          score={scores.seo}           delay={idx*0.035+0.15} />
      <ScoreRow label="Memorability" score={scores.memorability}  delay={idx*0.035+0.2} />
      <ScoreRow label="Searchability" score={scores.searchability} delay={idx*0.035+0.25} />
      <ScoreRow label="Social Handle" score={scores.social}       delay={idx*0.035+0.3} />

      {/* Analysis pills */}
      {analysis.strengths.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '12px 0 0' }}>
          {analysis.strengths.map(s => (
            <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: C.green }}>✓ {s}</span>
          ))}
        </div>
      )}

      {/* AI Analysis expandable */}
      {(analysis.tips.length > 0 || analysis.bestFor) && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowAnalysis(v => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: C.indigo, fontWeight: 600, padding: 0 }}>
            {showAnalysis ? '▲ Hide AI analysis' : '▼ AI brand analysis'}
          </button>
          {showAnalysis && (
            <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.18)', borderRadius: 10 }}>
              {analysis.tips.map(t => (
                <div key={t} style={{ fontSize: 12, color: C.gold, marginBottom: 4 }}>💡 {t}</div>
              ))}
              {analysis.bestFor && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}><strong style={{ color: C.white }}>Best for:</strong> {analysis.bestFor}</div>}
            </div>
          )}
        </div>
      )}

      {/* Domain check */}
      {showDomain && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>🌐 Domain Availability</div>
          {domainStatus[name] === 'loading' ? (
            <div style={{ fontSize: 12, color: C.muted }}>Checking…</div>
          ) : domainStatus[name] && typeof domainStatus[name] === 'object' ? (
            ['com','net','co'].map(ext => {
              const st = domainStatus[name][ext]
              const color = st === 'available' ? C.green : st === 'taken' ? C.red : C.muted
              return (
                <div key={ext} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>{slug}.{ext}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{st === 'available' ? '✓ Available' : st === 'taken' ? '✗ Taken' : '— Unknown'}</span>
                </div>
              )
            })
          ) : <div style={{ fontSize: 12, color: C.muted }}>Loading…</div>}
        </div>
      )}

      {/* Roast */}
      {showRoast && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 10, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          {roast}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={() => onFavorite(name)} style={{ flex: 1, minWidth: 60, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: isFav ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: isFav ? C.gold : C.muted, outline: isFav ? `1px solid ${C.gold}44` : 'none', transition: 'all 0.15s' }}>
          {isFav ? '★ Saved' : '☆ Save'}
        </button>
        <button onClick={() => onCompare(name)} disabled={compareDisabled} style={{ flex: 1, minWidth: 60, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: compareDisabled ? 'not-allowed' : 'pointer', border: 'none', background: isCompared ? 'rgba(124,92,255,0.15)' : 'rgba(255,255,255,0.04)', color: isCompared ? C.indigo : compareDisabled ? C.muted+'88' : C.muted, outline: isCompared ? `1px solid ${C.indigo}44` : 'none', transition: 'all 0.15s', opacity: compareDisabled ? 0.5 : 1 }}>
          {isCompared ? '⚖ Added' : '⚖ Compare'}
        </button>
        <button onClick={() => onCopy(name)} style={{ flex: 1, minWidth: 60, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: copied === name ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', color: copied === name ? C.green : C.muted, outline: copied === name ? `1px solid ${C.green}44` : 'none', transition: 'all 0.15s' }}>
          {copied === name ? '✓ Copied' : '📋 Copy'}
        </button>
        <button onClick={handleDomain} style={{ flex: 1, minWidth: 60, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: showDomain ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', color: showDomain ? C.gold : C.muted, transition: 'all 0.15s' }}>
          🌐 Domain
        </button>
        <button onClick={() => setShowRoast(v => !v)} style={{ flex: 1, minWidth: 60, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: showRoast ? 'rgba(236,72,153,0.1)' : 'rgba(255,255,255,0.04)', color: showRoast ? C.pink : C.muted, transition: 'all 0.15s' }}>
          🎤 Roast
        </button>
      </div>
    </div>
  )
}

function ComparePanel({ names, items, onClose }) {
  if (names.length < 2) return null
  const a = items.find(x => x.name === names[0])
  const b = items.find(x => x.name === names[1])
  if (!a || !b) return null
  const aOverall = overallScore(a.scores)
  const bOverall = overallScore(b.scores)
  const winner = aOverall >= bOverall ? a : b
  const SCORE_KEYS = [
    { key: 'brand', label: 'Brand' },
    { key: 'seo', label: 'SEO' },
    { key: 'memorability', label: 'Memorability' },
    { key: 'searchability', label: 'Searchability' },
    { key: 'social', label: 'Social Handle' },
  ]
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, maxHeight: '80vh', overflowY: 'auto', background: 'rgba(3,7,17,0.97)', backdropFilter: 'blur(20px)', border: `1px solid ${C.border}`, borderBottom: 'none', borderRadius: '18px 18px 0 0', padding: '20px 24px calc(28px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>⚖️ Name Comparison</div>
        <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 14, cursor: 'pointer', padding: '4px 10px' }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 12, alignItems: 'start', maxWidth: 700, margin: '0 auto' }}>
        {/* Name A */}
        <div style={{ background: aOverall >= bOverall ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${aOverall >= bOverall ? 'rgba(16,185,129,0.25)' : C.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 2 }}>{a.name}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: getScoreColor(aOverall), marginBottom: 10 }}>{aOverall}</div>
          {SCORE_KEYS.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text, marginBottom: 4 }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span style={{ color: getScoreColor(a.scores[key]), fontWeight: 700 }}>{a.scores[key]}</span>
            </div>
          ))}
        </div>
        {/* VS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.muted, paddingTop: 20 }}>VS</div>
        {/* Name B */}
        <div style={{ background: bOverall > aOverall ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${bOverall > aOverall ? 'rgba(16,185,129,0.25)' : C.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 2 }}>{b.name}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: getScoreColor(bOverall), marginBottom: 10 }}>{bOverall}</div>
          {SCORE_KEYS.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text, marginBottom: 4 }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span style={{ color: getScoreColor(b.scores[key]), fontWeight: 700 }}>{b.scores[key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: C.green, fontWeight: 700 }}>
        🏆 Winner: {winner.name} ({overallScore(winner.scores)}/100)
      </div>
    </div>
  )
}

function SectionHeader({ id, children }) {
  return (
    <div style={{ marginBottom: 24, marginTop: 56 }}>
      <h2 id={id} style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.02em' }}>{children}</h2>
      <div style={{ width: 40, height: 3, background: C.indigo, borderRadius: 2 }} />
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.white, fontSize: 14, fontWeight: 600, textAlign: 'left', gap: 12 }}>
        <span>{q}</span>
        <span style={{ fontSize: 20, color: C.muted, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 18px 14px', fontSize: 14, color: C.text, lineHeight: 1.75 }}>{a}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NameGeneratorClient() {
  const [mode, setMode]           = useState('real')
  const [keyword, setKeyword]     = useState('')
  const [count, setCount]         = useState(25)
  const [names, setNames]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [favorites, setFavorites] = useState(new Set())
  const [compareList, setCompareList] = useState([])
  const [domainStatus, setDomainStatus] = useState({})
  const [copied, setCopied]       = useState(null)
  const [topName, setTopName]     = useState(null)
  const [showFavs, setShowFavs]   = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true); setNames([]); setCompareList([])
    await new Promise(r => setTimeout(r, 400))
    const result = generateNames(mode, keyword, count)
    setNames(result)
    if (result.length) setTopName(result[0])
    setLoading(false)
    try {
      const sb = await import('@supabase/supabase-js')
      const cl = sb.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      await cl.from('name_generator_analytics').insert({ mode, names_generated: count })
    } catch (_) {}
  }, [mode, keyword, count])

  const fetchWithTimeout = useCallback((url, ms = 7000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    return fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .catch(() => null)
      .finally(() => clearTimeout(timer))
  }, [])

  const checkDomain = useCallback(async name => {
    if (domainStatus[name]) return
    setDomainStatus(p => ({ ...p, [name]: 'loading' }))
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g,'')
    try {
      const [r1,r2,r3] = await Promise.all([
        fetchWithTimeout(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=com`),
        fetchWithTimeout(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=net`),
        fetchWithTimeout(`https://api.domainsdb.info/v1/domains/search?domain=${slug}&zone=co`),
      ])
      const chk = (res,ext) => res == null ? 'unknown' : (res.domains?.some(d=>d.name===`${slug}.${ext}`) ? 'taken' : 'available')
      setDomainStatus(p => ({ ...p, [name]: { com: chk(r1,'com'), net: chk(r2,'net'), co: chk(r3,'co') } }))
    } catch (_) {
      setDomainStatus(p => ({ ...p, [name]: { com:'unknown', net:'unknown', co:'unknown' } }))
    }
  }, [domainStatus])

  const toggleFavorite = name => setFavorites(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n })
  const toggleCompare  = name => setCompareList(p => p.includes(name) ? p.filter(x=>x!==name) : p.length < 2 ? [...p,name] : p)
  const copyName = async name => { await navigator.clipboard.writeText(name); setCopied(name); setTimeout(()=>setCopied(null),2000) }

  const displayNames = showFavs ? names.filter(x => favorites.has(x.name)) : names

  const nameSections = [
    { label: '✨ Cute Names', color: C.pink, names: ['Lily Quinn','Daisy Hart','Mia Brooks','Chloe Lane','Ivy Rose','Bree Blake','Rae West','Nova Kane','Wren Vale','Fern Cross','Zoe Reid','Pip Stone'] },
    { label: '💎 Luxury Names', color: C.gold, names: ['Celeste Vance','Sophia Steele','Aurora Gold','Pearl Morgan','Velvet Rose','Crystal Hart','Satin Vale','Opal Moore','Sienna Cross','Brielle Frost','Diamond Reed','Ivory Nash'] },
    { label: '🖤 Goth Names', color: C.purple, names: ['Raven Cross','Dark Lily','Shadow Quinn','Obsidian Eve','Noir Vale','Sable Frost','Ash Blake','Hex Lane','Shade Reid','Void Hart','Wraith Stone','Myst Lane'] },
    { label: '🎮 Gamer Names', color: C.cyan, names: ['Pixel Nova','Neon Aria','Glitch Quinn','Cyber Luna','Vector Jade','Binary Skye','Arcade Mia','Static Eve','Warp Ava','Sprite Rose','Byte Lily','Flux Ivy'] },
    { label: '🌸 Elegant Names', color: '#FDA4AF', names: ['Elena Grace','Serene Hart','Aria Quinn','Celeste Moore','Sophia Wren','Isla Reed','Freya Stone','Aurora Vale','Violet Blake','Nora Lane','Willow Gold','Iris Vance'] },
    { label: '⛓️ Dominant Names', color: C.red, names: ['Steel Quinn','Iron Raven','Sable Cross','Onyx Hart','Blade Stone','Feral Rose','Hex Vale','Reign Blake','Wrath Reid','Siren Fox','Fang Moore','Crest Lane'] },
    { label: '🌷 Soft Girl Names', color: '#FDA4AF', names: ['Honey Mia','Daisy Hart','Sweet Luna','Blush Rose','Cherry Nova','Peach Ivy','Sugar Lane','Cotton Blake','Rosy Quinn','Dewy Stone','Breezy Vale','Sunny Wren'] },
    { label: '👔 Professional Names', color: C.text, names: ['Emma Quinn','Sophia Hart','Ava Brooks','Lily Lane','Maya Blake','Isla West','Nora Stone','Freya Reid','Elena Kane','Aurora Vale','Harper Cross','Piper Lake'] },
  ]

  const faqs = [
    { q:'What makes a good cam model name?', a:'A good cam model name is 8–14 characters, two words, free of numbers or special characters, and easy to spell aloud. Real-name-style combinations like Ava Quinn or Luna Hart consistently outperform abstract stage names for fan recall and Google searchability.' },
    { q:'Should I use my real name as a cam model?', a:"Never use your legal name. Use a stage name that sounds like a real name — approachable, personal, and easy to remember. Names like Lily Reed or Nova Blake feel authentic without exposing your identity." },
    { q:'Should cam models use first and last names?', a:"Yes. Two-word names score significantly higher on brand recall tests, Google uniqueness, and professional perception. A fan searching your name on Google will find you much faster with 'Ava Quinn' than with 'Kitten.'" },
    { q:'How do I know if a Chaturbate username is available?', a:"Visit Chaturbate's registration page and enter your preferred username. Chaturbate tells you immediately if it's taken. Use the domain checker in this tool and visit each platform's registration page to verify." },
    { q:'Can I change my cam model name later?', a:"Most platforms allow username changes, but it comes at a cost. You lose the SEO history attached to your old name, fans who search for you won't find you easily, and cross-platform consistency breaks. Choose a name you can commit to for at least 2–3 years." },
    { q:'Should my OnlyFans and Chaturbate names match?', a:'Absolutely. Consistent usernames across all platforms dramatically increase discoverability. When a fan sees your Chaturbate name and searches for you on Instagram, matching usernames instantly confirm they found the right person.' },
    { q:'How important is domain availability?', a:"Very important for long-term brand building. Securing yourname.com gives you a permanent home base, makes you look professional, and prevents impersonators from squatting on your name." },
    { q:'What is the brand strength score?', a:'The brand strength score (0–100) evaluates a name on six criteria: length, word count, absence of numbers, absence of special characters, syllable count, and starting letter strength. Scores of 70+ are strong. Above 90 is exceptional.' },
    { q:'What are the best cam model name ideas for 2026?', a:'The strongest cam model names for 2026 combine a clean feminine first name with a strong last name: Ava Quinn, Luna Hart, Nova Blake, Scarlett Reed, Violet Stone. For niche branding: Dark Lily (goth), Pixel Nova (gamer), Crystal Hart (luxury).' },
    { q:'How long should a cam model name be?', a:'The ideal total length is 8–14 characters. Long enough to be distinctive, short enough for fans to remember and type correctly. Names over 18 characters are hard to recall. Names under 6 are often too generic or already taken.' },
    { q:'Should I put numbers in my cam model name?', a:'No. Numbers reduce brand strength significantly. They look unprofessional, are hard to remember verbally, and hurt your ability to rank in Google. If your preferred name is taken, change a word rather than adding numbers.' },
    { q:'Can I use my cam model name for a website?', a:"Yes, and you should plan to. Securing yourname.com immediately is smart brand protection. It gives you a hub for your fanbase, improves Google discoverability, and protects you from impersonators." },
    { q:'What niche cam model names work best?', a:'Niche names signal your content style clearly: DarkDahlia for goth, PixelKitten for gaming, VelvetRose for luxury. The trade-off is flexibility — niche names are harder to evolve if your content changes.' },
    { q:'What are popular cam model name styles in 2026?', a:'The most popular formats are two-word real-name combinations (Ava Quinn, Emma Hart), nature-inspired names (Willow Reed, Ivy Stone), color-prefix names (Scarlett Lane, Ruby Cross), and hybrid niche names (Dark Ivy, Pixel Nova).' },
    { q:'How do I build a brand around my cam model name?', a:'Register the same username across all platforms immediately. Secure your .com domain. Use the same profile photo everywhere. Establish consistent visual branding. Mention your name during every stream.' },
    { q:'Are cam model names case sensitive?', a:"Most platforms treat usernames as case-insensitive for availability. If AvaQuinn is registered, avaQuinn is also unavailable. However, the capitalization you choose during registration affects how your name displays on your profile." },
    { q:'How many names should I generate before choosing?', a:"Generate 50–100 names and shortlist your top 5 before checking availability. Availability will eliminate some; personal preference narrows the rest. Never settle for a name scoring below 70 — the generator is free and unlimited." },
    { q:'What makes a cam model name unprofessional?', a:"Numbers (HotGirl99), excessive X's or underscores (XxSexyKittenxX), overly explicit language in the name, copying another creator's name with minor changes, and names that are very long or hard to spell all reduce professional perception." },
    { q:'Should I use my cam name on TikTok and Instagram?', a:"Yes, even if you don't post explicit content there. Maintaining your cam model name on mainstream social platforms builds brand recognition, drives traffic to your cam profiles, and protects your username." },
    { q:'What first names work best for cam models?', a:'Names with 2–3 syllables starting with strong consonants or open vowels score highest: Ava, Emma, Luna, Mia, Sophia, Violet, Nova, Iris. These are globally recognized, easy to say, and pair naturally with most last names.' },
    { q:'What last names work best for cam models?', a:'Short, clean last names with strong consonants score best: Quinn, Hart, Blake, Stone, Reed, Lane, Cross, Frost. One-syllable last names pair especially well with two-syllable first names for optimal rhythm.' },
    { q:'Do cam model names affect earnings?', a:'Indirectly, yes. A memorable, professional name increases fan retention, improves word-of-mouth growth, and creates a perception of professionalism that can command higher tips over time.' },
    { q:'How does my cam model name affect Google rankings?', a:"A unique two-word real-name-style name is much easier to rank for than a generic word. If someone searches 'Ava Quinn cam model,' you'll likely appear on page one. If your name is 'Kitten,' you're competing with millions of results." },
    { q:'How does CamCash help cam models?', a:'CamCash tracks your tip earnings at the transaction level, identifies your highest-value fans and their churn risk, shows your peak earning hours and best streaming days, compares your revenue per hour across platforms, and provides AI-powered coaching during live streams. Free during beta.' },
    { q:'Is CamCash free?', a:'Yes. CamCash is completely free during its beta period. Upload your first CSV at camcashgrl.com in under 2 minutes. No credit card required.' },
  ]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes scoreGrow { from { width:0; } to { width:var(--w,100%); } }
        @keyframes glowPulse { 0%,100% { box-shadow:0 0 20px rgba(124,92,255,0.3); } 50% { box-shadow:0 0 40px rgba(124,92,255,0.6); } }
        @keyframes heroFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
        .name-card:hover { border-color:rgba(124,92,255,0.35)!important; box-shadow:0 4px 30px rgba(124,92,255,0.1); }
        .mode-btn:hover { transform:translateY(-2px); }
        a { transition:opacity 0.15s; } a:hover { opacity:0.8; }
        button:focus,input:focus { outline:none; }
        input:focus { border-color:rgba(124,92,255,0.5)!important; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#0a0f1e; } ::-webkit-scrollbar-thumb { background:rgba(124,92,255,0.3); border-radius:3px; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '16px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(3,7,17,0.95)', backdropFilter: 'blur(16px)', zIndex: 40 }}>
        <a href="/landing" style={{ fontWeight: 700, fontSize: 15, color: C.white, textDecoration: 'none', letterSpacing: '-0.2px' }}>💜 CamCash</a>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/tools" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>All Tools</a>
          <a href="/guides/cam-model-room-title-generator" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Title Generator</a>
          <a href="/guides/cam-model-token-calculator" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Token Calc</a>
          <Button as="a" href="/login" style={{ padding: '7px 18px', fontSize: 13 }}>Sign in</Button>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 120px' }}>

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb" style={{ marginBottom: 28, fontSize: 12 }}>
          <a href="/landing" style={{ color: C.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <a href="/tools" style={{ color: C.cyan, textDecoration: 'none' }}>Tools</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Cam Model Name Generator</span>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 52, position: 'relative' }}>
          {/* Badge pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {['Free Tool','No Signup','5-Score AI Analysis','Domain Check','11 Style Modes'].map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.25)', color: C.indigo, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t}</span>
            ))}
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5.5vw,58px)', fontWeight: 900, color: C.white, lineHeight: 1.05, marginBottom: 18, letterSpacing: '-0.03em' }}>
            Cam Model<br />
            <span style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Name Generator</span>
          </h1>
          <p style={{ fontSize: 18, color: C.text, maxWidth: 580, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Generate brandable creator names with AI-powered brand scoring — Brand, SEO, Memorability, Searchability, and Social Handle scores for every name.
          </p>
          {/* Score preview */}
          <div style={{ display: 'inline-flex', gap: 16, padding: '14px 24px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[['Brand','#7C5CFF'],['SEO','#22D3EE'],['Memory','#EC4899'],['Search','#10B981'],['Handle','#F59E0B']].map(([l,c]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${c}18`, border: `2px solid ${c}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: c }}>✦</div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── GENERATOR CARD ───────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(24px)', border: `1px solid rgba(124,92,255,0.2)`, borderRadius: 24, padding: '32px 36px', marginBottom: 32, boxShadow: '0 8px 60px rgba(124,92,255,0.08)' }}>

          {/* Mode selector */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Choose Your Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {MODES.map(m => (
                <button
                  key={m.id}
                  className="mode-btn"
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: '12px 8px', borderRadius: 12, cursor: 'pointer', border: 'none', transition: 'all 0.18s',
                    background: mode === m.id ? `linear-gradient(135deg, ${m.color}22, ${m.color}11)` : 'rgba(255,255,255,0.03)',
                    outline: mode === m.id ? `1.5px solid ${m.color}66` : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: mode === m.id ? `0 0 20px ${m.color}25` : 'none',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: mode === m.id ? C.white : C.muted, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3, display: mode === m.id ? 'block' : 'none' }}>{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Keyword + Count row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ flex: '2 1 220px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Nickname or keyword <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g. rose, luna, star…"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.white, fontSize: 16, transition: 'border-color 0.15s' }}
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>How many</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[25,50,100].map(n => (
                  <button key={n} onClick={() => setCount(n)} style={{ flex: 1, padding: '12px 4px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: count === n ? C.indigo : 'rgba(255,255,255,0.05)', color: count === n ? '#fff' : C.muted }}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate} disabled={loading}
            style={{ width: '100%', padding: '17px', fontSize: 16 }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${C.muted}`, borderTopColor: C.white, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating {count} names…
                </span>
              : `⚡ Generate ${count} ${MODES.find(m=>m.id===mode)?.label || ''} Names`
            }
          </Button>
        </div>

        {/* ── RESULTS ──────────────────────────────────────────────────────── */}
        {names.length > 0 && (
          <>
            {/* Results header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{names.length} names · sorted by Overall Score</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Click ⭐ to save · ⚖️ to compare · 🎤 for roast</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {favorites.size > 0 && (
                  <button onClick={() => setShowFavs(v=>!v)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', border: 'none', background: showFavs ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', color: showFavs ? C.gold : C.muted, outline: showFavs ? `1px solid ${C.gold}44` : 'none', transition: 'all 0.15s' }}>
                    ★ {favorites.size} saved {showFavs ? '(show all)' : '(show favorites)'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
                  {[['90+',C.green,'Excellent'],['75+',C.cyan,'Strong'],['60+',C.gold,'Good'],['<60',C.red,'Fair']].map(([r,c,l]) => (
                    <span key={r} style={{ color: c, fontWeight: 600 }}>{r} {l}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
              {displayNames.map((item, idx) => (
                <NameCard
                  key={item.name} item={item} idx={idx}
                  favorites={favorites} onFavorite={toggleFavorite}
                  compareList={compareList} onCompare={toggleCompare}
                  copied={copied} onCopy={copyName}
                  domainStatus={domainStatus} onCheckDomain={checkDomain}
                />
              ))}
            </div>

            {/* ── BUILD YOUR CREATOR BRAND CTA ─────────────────────────── */}
            {topName && (
              <div style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(124,92,255,0.25)', borderRadius: 20, padding: '36px 40px', marginBottom: 60, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,255,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Build Your Creator Brand</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', marginBottom: 4 }}>{topName.name}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(overallScore(topName.scores)) }}>Overall: {overallScore(topName.scores)}/100 · {getScoreLabel(overallScore(topName.scores))}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>@{topName.name.toLowerCase().replace(/[^a-z0-9]/g,'')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['brand','seo','memorability','searchability','social']).map(k => (
                      <div key={k} style={{ textAlign: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: getScoreColor(topName.scores[k]) }}>{topName.scores[k]}</div>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: 'capitalize' }}>{k === 'memorability' ? 'Memory' : k === 'searchability' ? 'Search' : k === 'social' ? 'Handle' : k}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 15, color: C.text, marginBottom: 24, lineHeight: 1.65, maxWidth: 520 }}>
                  You have your name. Now track which hours make you the most money, who your top fans are, and how to grow your brand — all from your existing platform data.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button as="a" href="/login" style={{ padding: '13px 28px', fontSize: 15 }}>
                    Start Tracking Your Creator Business →
                  </Button>
                  <Button as="a" href="/demo" variant="secondary" style={{ padding: '13px 28px', fontSize: 15 }}>
                    See Live Demo →
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
                  {['Find Your Best Hours','Analyze Top Tippers','Compare Platforms','Live Coaching'].map(t => (
                    <span key={t} style={{ fontSize: 12, color: C.muted }}>✓ {t}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SEO CONTENT
        ════════════════════════════════════════════════════════════════════ */}

        <SectionHeader id="what-makes-a-good-cam-model-name">What Makes a Good Cam Model Name?</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>Your cam model name is the foundation of your entire creator brand. It appears on every platform, shows up in search results, gets spoken aloud by fans recommending you, and is the first impression every new viewer has before they watch a single second of your content. Most models choose a name quickly without thinking about the long-term consequences — and many end up rebranding years later at significant cost.</p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}><strong style={{ color: C.white }}>Memorability is the single most important factor.</strong> A name fans can remember, spell, and say aloud grows organically. When a fan tells their friend "you should check out Ava Quinn," that referral works because the name is clear. When they try to recommend "XxSexyKitten99xX," the referral breaks down immediately.</p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}><strong style={{ color: C.white }}>Branding potential determines your ceiling.</strong> A name like "Emma Hart" can anchor a website, a merchandise line, a newsletter, a YouTube channel, and a full social media presence. It works equally well at 100 viewers and 10,000. Niche-specific names like "GothKittenXXX" create a ceiling — they're hard to evolve as your audience or content style changes.</p>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 0 }}><strong style={{ color: C.white }}>Searchability determines discoverability.</strong> When someone searches your name on Google, YouTube, Reddit, or TikTok, a unique two-word name will surface your profiles. A generic word name competes with millions of unrelated results. "Ava Quinn cam" brings up your profiles on page one. "Kitten cam" surfaces everything except you.</p>

        <SectionHeader id="best-cam-girl-names">Best Cam Girl Names for 2026</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>The best cam girl names in 2026 combine a strong, recognizable feminine first name with a clean, distinctive last name. Based on brand scoring data, these are the characteristics that separate the highest-performing names from the rest:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { style: 'Classic Real-Name', examples: 'Ava Quinn, Emma Hart, Ruby Brooks', why: 'Works across every platform, ages well' },
            { style: 'Nature-Inspired', examples: 'Willow Reed, Ivy Stone, Luna Vale', why: 'Memorable, gentle, widely appealing' },
            { style: 'Color-Prefix', examples: 'Scarlett Lane, Violet Cross, Ruby Frost', why: 'Visually distinctive, strong brand identity' },
            { style: 'Luxury Aesthetic', examples: 'Crystal Hart, Pearl Vance, Velvet Rose', why: 'Premium positioning, high-value fan attraction' },
          ].map(({ style: s, examples, why }) => (
            <div key={s} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>{s}</div>
              <div style={{ fontSize: 12, color: C.indigo, marginBottom: 6, fontStyle: 'italic' }}>{examples}</div>
              <div style={{ fontSize: 12, color: C.muted }}>✓ {why}</div>
            </div>
          ))}
        </div>

        <SectionHeader id="chaturbate-username-ideas">Chaturbate Username Ideas</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>Chaturbate usernames must be 3–36 characters, lowercase letters only, with numbers and underscores permitted. The strongest Chaturbate usernames read like a real name — they're easy to search, easy to remember, and unique enough to rank in Google. Here are 20 high-scoring username ideas for Chaturbate:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 24 }}>
          {['avaquinn','emmahartx','lunavale','novablake','rubycross','violetstone','skyelane','irisreed','mayafrost','noramoon','celestevance','auroraking','willowkane','ivyblythe','hazelwren','piperlane','harperrose','lilymarch','sophiawild','elenasnow'].map(n => {
            const displayName = n.charAt(0).toUpperCase() + n.slice(1).replace(/([a-z])([A-Z])/g,'$1 $2')
            return (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: C.white, fontFamily: 'monospace' }}>@{n}</span>
              </div>
            )
          })}
        </div>

        <SectionHeader id="onlyfans-name-ideas">OnlyFans Name Ideas</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>OnlyFans usernames can be changed once after creation, so choosing the right one matters. The strongest OnlyFans names are the same as your Chaturbate username — cross-platform consistency is critical for fan discoverability. Here are 20 high-scoring OnlyFans name ideas optimized for the platform's audience:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 24 }}>
          {[['crystalhart','💎 Luxury aesthetic'],['velvetrosa','🌹 Sensual & elegant'],['novabanks','⭐ Modern & clean'],['scarlettlane','🔴 Bold & memorable'],['lunavalentine','🌙 Romantic & dreamy'],['ivorymoon','🤍 Soft luxury'],['jadelane','💚 Fresh & brandable'],['rosethorne','🌹 Dark romantic'],['ambermoss','🍂 Natural & warm'],['sapphirevale','💙 Premium brand']].map(([n,v]) => (
            <div key={n} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.white, fontFamily: 'monospace' }}>@{n}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{v}</span>
            </div>
          ))}
        </div>

        <SectionHeader id="seo-friendly-creator-names">SEO-Friendly Creator Names: How Your Name Affects Google Ranking</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 16 }}>Your cam model name directly affects how discoverable you are on Google, and most models don't realize this until they've been streaming for months. Here's how name choice impacts SEO:</p>
        {[
          { title: 'Unique two-word names rank instantly', body: 'If you search "Ava Quinn cam model" right now, you\'ll find exactly one person. That uniqueness means Google can assign all search authority for that query to one profile. A generic single-word name like "Kitten" is competing with billions of unrelated results.' },
          { title: 'Your name is a keyword', body: 'Every time a fan mentions you on Reddit, Twitter, or any forum, your name becomes a link in Google\'s graph. Two-word real-name-style names create searchable text anchors. One-word or symbol-heavy names create noise that Google can\'t index effectively.' },
          { title: 'Consistent cross-platform names build Google authority', body: 'When the same name appears on Chaturbate, OnlyFans, Instagram, TikTok, and a personal .com domain, Google treats all those signals as one entity. This "brand authority" is how top models dominate the first page for searches about them.' },
          { title: 'Domain registration amplifies SEO', body: 'Owning yourname.com means you have a direct property Google can index. Combined with your social profiles and cam platform pages, this creates a full-page-one presence for anyone searching your name.' },
        ].map(({ title, body }) => (
          <div key={title} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: C.text, margin: 0 }}>{body}</p>
          </div>
        ))}

        <SectionHeader id="real-name-vs-stage-name">Real Name vs Stage Name: Which Should You Choose?</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 20 }}>The debate between real-name-style and pure stage names is one of the most common questions new cam models ask. The answer depends on your goals — but the data strongly favors real-name-style for most models.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { title: 'Real Name Style', sub: 'e.g. Ava Quinn, Luna Hart', color: C.green, pros: ['Better SEO and Google ranking','Higher fan memorability','Cross-platform consistency','Professional perception','Works for any content niche','Better for website and domain'], cons: ['Less niche-specific at a glance','May need a unique twist'] },
            { title: 'Niche Stage Name', sub: 'e.g. DarkDahlia, VelvetVixen', color: C.indigo, pros: ['Signals your content style instantly','Memorable within niche communities','Distinctive visual branding','Can be very unique'], cons: ['Harder to evolve if you pivot','Google ranking is difficult','Hard for fans to spell/share','Limits brand expansion'] },
          ].map(({ title, sub, color, pros, cons }) => (
            <div key={title} style={{ background: 'rgba(10,15,30,0.85)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{sub}</div>
              {pros.map(p => <div key={p} style={{ fontSize: 13, color: C.green, marginBottom: 5 }}>✓ {p}</div>)}
              <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
              {cons.map(c => <div key={c} style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>— {c}</div>)}
            </div>
          ))}
        </div>

        <SectionHeader id="100-cam-model-name-ideas">100 Cam Model Name Ideas (Organized by Style)</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 24 }}>Browse our curated list of cam model name ideas organized by style and niche. All names below score 70+ on the brand strength scale. Use the generator above for personalized variations.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {nameSections.map(({ label, color, names: ns }) => (
            <div key={label} style={{ background: 'rgba(10,15,30,0.85)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{label}</div>
              {ns.map(n => {
                const sc = overallScore(computeScores(n))
                return (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 14, color: C.white, fontWeight: 600 }}>{n}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: getScoreColor(sc) }}>{sc}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <SectionHeader id="how-to-build-brand">How to Build a Personal Brand Around Your Cam Name</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 20 }}>Your name is the seed. Your brand is the garden. Once you have your name, here's how to build a presence around it:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { step:'1', title:'Register everywhere on day one', body:'Chaturbate, OnlyFans, Fansly, Instagram, TikTok, X, Reddit. Every platform on the same day. This protects your username and establishes cross-platform consistency immediately.' },
            { step:'2', title:'Secure your domain', body:'yourname.com should be registered within 24 hours of choosing your name. Register .com, .net, and .co if available. Even if you don\'t build a site immediately, the domain protects your brand.' },
            { step:'3', title:'Create consistent visual identity', body:'The same profile photo across all platforms. A consistent color palette. A simple logo or wordmark. Visual consistency makes your brand immediately recognizable.' },
            { step:'4', title:'Use your name constantly', body:'Mention your name during every stream: "I\'m [Name], welcome." Say it in your bio, your tip menu header, your video titles. Repetition builds recall.' },
            { step:'5', title:'Track your brand performance', body:'Use CamCash to see which platforms and hours generate the most fans. Understanding where your audience grows fastest helps you focus your brand-building energy.' },
            { step:'6', title:'Evolve intentionally', body:'As your audience grows, you\'ll naturally refine your brand. Consistent analytics — from a tool like CamCash — will show you exactly which direction your brand is growing.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ background: 'rgba(10,15,30,0.85)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.indigo, opacity: 0.5, marginBottom: 8 }}>{step}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: C.text, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: 12, padding: '18px 22px', marginBottom: 0 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, margin: 0 }}>
            Once you start streaming, knowing your actual numbers — which fans tip the most, which hours are most profitable, which platform has the best ROI — is what separates models who plateau from models who grow. <a href="/landing" style={{ color: C.cyan, textDecoration: 'none', fontWeight: 600 }}>CamCash</a> tracks all of this automatically. <a href="/blog/cam-model-earnings" style={{ color: C.cyan, textDecoration: 'none' }}>See what cam models actually earn →</a>
          </p>
        </div>

        <SectionHeader id="naming-mistakes">Common Cam Model Naming Mistakes</SectionHeader>
        {[
          { n:'01', title:'Adding numbers to an already-taken name', body:'If AvaBrooks is taken, AvaBrooks99 creates a permanent compromise. You\'ll always be the lesser version of the original. Change a word instead.' },
          { n:'02', title:'Choosing a name that\'s hard to spell', body:'Names with unusual spelling (XxSeraphynaxX, Sxyy_Kitten) create barriers. Fans can\'t find you by searching, can\'t recommend you verbally, and won\'t bother typing you into search engines.' },
          { n:'03', title:'Picking a name tied to a trend', body:'Names referencing current memes or slang date quickly. A name that felt fresh in 2023 can feel dated by 2025. Choose timeless names that will work for years.' },
          { n:'04', title:'Copying a popular creator with variations', body:'Adding "Real," "Official," or slight spelling changes to a well-known creator\'s name looks unprofessional and can attract accusations of impersonation. Always choose a fully original name.' },
          { n:'05', title:'Using explicit words in the name itself', body:'Platform algorithms and payment processors increasingly penalize accounts with explicit words in usernames. Keep the name clean — save explicit content for your content.' },
          { n:'06', title:'Choosing a name that\'s too long', body:'Names over 18 characters are nearly impossible for fans to remember, type correctly, or tag on social media. If your name can\'t be said in one breath, it\'s too long.' },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 16, marginBottom: 12, background: 'rgba(10,15,30,0.85)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.indigo, opacity: 0.4, minWidth: 28, flexShrink: 0 }}>{n}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, margin: 0 }}>{body}</p>
            </div>
          </div>
        ))}

        <SectionHeader id="faq">Frequently Asked Questions</SectionHeader>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: C.text, marginBottom: 24 }}>Everything you need to know about choosing, checking, and building around your cam model name.</p>
        {faqs.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}

        {/* FINAL CTA */}
        <div style={{ marginTop: 60, padding: '44px 40px', borderRadius: 22, background: `linear-gradient(135deg, rgba(124,92,255,0.12), rgba(236,72,153,0.08))`, border: '1px solid rgba(124,92,255,0.22)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>After You Choose Your Name</div>
          <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: C.white, marginBottom: 14, letterSpacing: '-0.02em' }}>Track Your Earnings From Day One</h2>
          <p style={{ fontSize: 15, color: C.text, marginBottom: 28, maxWidth: 500, margin: '0 auto 28px', lineHeight: 1.7 }}>
            The models who grow fastest are the ones who know their numbers. CamCash shows you your top tippers, best hours, and most profitable platform — free.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <Button as="a" href="/login" style={{ padding: '14px 32px', fontSize: 15 }}>Start Tracking Free →</Button>
            <Button as="a" href="/demo" variant="secondary" style={{ padding: '14px 32px', fontSize: 15 }}>See How It Works →</Button>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Top Tippers','Peak Hours','Platform Comparison','AI Live Coaching','Full History'].map(t => (
              <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted }}>✓ {t}</span>
            ))}
          </div>
        </div>

        {/* Related links */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>Related Tools & Guides</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['/guides/cam-model-room-title-generator','Room Title Generator'],
              ['/guides/cam-model-token-calculator','Token Calculator'],
              ['/tools/profile-studio','Creator Profile Studio'],
              ['/guides/cam-model-income-tracker','Income Tracker'],
              ['/tools','All Free Tools'],
              ['/guides/cam-model-room-title-generator?tab=hashtags','Hashtag Generator'],
              ['/blog/best-cam-model-tools','Best Cam Model Tools'],
              ['/blog/how-to-increase-cam-earnings','How to Increase Earnings'],
              ['/blog/how-to-build-loyal-fans','Build Loyal Fans'],
              ['/blog/how-to-make-more-money-on-chaturbate','Make More on Chaturbate'],
              ['/guides/cam-model-analytics','Analytics Guide'],
              ['/blog/cam-model-earnings','Earnings Guide'],
            ].map(([href,label]) => (
              <a key={href} href={href} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.cyan, textDecoration: 'none' }}>→ {label}</a>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>

      {/* Compare panel */}
      {compareList.length === 2 && (
        <ComparePanel names={compareList} items={names} onClose={() => setCompareList([])} />
      )}
    </div>
  )
}
