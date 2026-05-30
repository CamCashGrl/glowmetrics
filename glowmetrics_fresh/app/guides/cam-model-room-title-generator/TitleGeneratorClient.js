'use client'
import { useState, useEffect } from 'react'

const TOYS = ['None', 'Lush', 'Domi', 'Edge', 'Hush', 'Interactive toy']
const MOODS = [
  { value: 'none', label: 'No mood (auto)' },
  { value: 'tease', label: 'Tease / buildup' },
  { value: 'dominant', label: 'Dominant / in charge' },
  { value: 'submissive', label: 'Submissive / playful' },
  { value: 'hype', label: 'High energy / hype' },
  { value: 'mystery', label: 'Mystery / curiosity' },
]

const TOY_PHRASES = {
  Lush: { control: 'tip to control my Lush 🎮', react: 'Lush reacts to every tip ⚡', buildup: "so close… don't stop 💦" },
  Domi: { control: 'tip to run my Domi ⚡', react: 'Domi goes full power with every tip', buildup: 'turning it up with every tip 🔥' },
  Edge: { control: 'tip to push me to the edge', react: 'Edge reacts instantly ⚡', buildup: 'building up with every tip 🔥' },
  Hush: { control: 'you control my Hush 😈', react: 'wearing it — tip to activate 🔴', buildup: "getting harder to stay quiet 🤫" },
  'Interactive toy': { control: 'tip to control my toy 🎮', react: 'toy reacts to every tip ⚡', buildup: 'building up with every tip 🔥' },
}

const MOOD_HOOKS = {
  tease: ["let's see how far you take me", "I'm not giving it up that easy", "you have to earn it tonight", "almost… not yet"],
  dominant: ["top tipper owns this room", "you earn what I give you", "prove you deserve it", "I decide — you tip"],
  submissive: ["I do what you say tonight", "you're in charge — tip to command me", "your wish is my reaction", "tell me what to do"],
  hype: ["WE ARE SO CLOSE 🔥", "the energy in here is insane", "LET'S GOOO — tip to push it", "this room is on fire"],
  mystery: ["you won't believe what happens at goal", "something big is coming… tip to find out", "I have a surprise — help me get there", "curious? tip to unlock it"],
}

function buildTitle({ tokenGoal, action, toy, mood, useEmojis }) {
  const e = (emoji) => useEmojis ? emoji : ''
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const hasToy = toy && toy !== 'None'
  const hasMood = mood && mood !== 'none'
  const toyData = hasToy ? TOY_PHRASES[toy] : null
  const moodHooks = hasMood ? MOOD_HOOKS[mood] : []
  const hooks = [
    ...(moodHooks.length ? moodHooks : []),
    ...(hasToy ? [toyData.control, `my ${toy} is live ${e('🔴')}`, `you control my ${toy} ${e('👑')}`] : []),
    `you decide what I do ${e('👑')}`,
    `tip to take control ${e('😈')}`,
    `not holding back tonight ${e('🔥')}`,
    `feeling dangerous tonight ${e('😈')}`,
    `make me ${e('😏')}`,
    `prove you want it ${e('👀')}`,
  ]
  let goal = ''
  if (tokenGoal && action && hasToy) goal = `hit ${tokenGoal} → ${action} + ${toy} reacts`
  else if (tokenGoal && action) goal = `hit ${tokenGoal} → ${action}`
  else if (tokenGoal && hasToy) goal = `hit ${tokenGoal} → ${toyData.react}`
  else if (tokenGoal) goal = `tip to reach ${tokenGoal}`
  else if (action && hasToy) goal = `tip → ${action} + ${toyData.react}`
  else if (action) goal = `tip → ${action} ${e('😏')}`
  else if (hasToy) goal = toyData.react
  else goal = pick(['tip = instant reaction', 'tip to decide what happens', 'tip to run this room'])
  const urgencies = ['tonight only', 'this hour only', 'now or never', 'live now', "don't miss it", 'while I\'m in this mood']
  const hook = pick(hooks)
  const urgency = pick(urgencies)
  const structures = [
    `${hook} ${e('💦')} ${goal} (${urgency})`,
    `${goal} → ${pick(['special reward', 'big reaction', 'you choose everything'])} ${e('🔥')} • ${urgency}`,
    `${hook}… ${goal} ${e('👀')} (${urgency})`,
    `${urgency.toUpperCase()} ${e('⚡')} ${hook} — ${goal}`,
    `${hook} • ${goal} • ${urgency}`,
  ]
  let title = pick(structures)
  title = title.replace(/\s{2,}/g, ' ').trim()
  if (title.length > 100) title = title.slice(0, 97) + '...'
  return title
}

const C = {
  bg: '#0d0f14', surface: '#121620', card: 'rgba(18,22,32,0.6)',
  border: 'rgba(99,102,241,0.1)', text: '#a3a8b8', textStrong: '#e8eaf0',
  accentMuted: '#6366f1', accentViolet: '#7c3aed', accentBlue: '#3b82f6',
  green: '#10b981',
}

export default function TitleGeneratorClient() {
  const [tokens, setTokens] = useState('')
  const [action, setAction] = useState('')
  const [toy, setToy] = useState('None')
  const [mood, setMood] = useState('none')
  const [useEmojis, setUseEmojis] = useState(true)
  const [results, setResults] = useState([])
  const [favorites, setFavorites] = useState({})
  const [copied, setCopied] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('titleFavorites')
    if (saved) setFavorites(JSON.parse(saved))
  }, [])

  const generate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const newTitle = buildTitle({ tokenGoal: tokens, action, toy, mood, useEmojis })
      setResults([newTitle, ...results.slice(0, 9)])
      setCopied(null)
      setIsGenerating(false)
    }, 200)
  }

  const copyTitle = (title, idx) => {
    navigator.clipboard.writeText(title)
    setCopied(idx)
    setTimeout(() => setCopied(null), 1500)
  }

  const toggleFavorite = (title) => {
    const newFavs = { ...favorites, [title]: !favorites[title] }
    setFavorites(newFavs)
    localStorage.setItem('titleFavorites', JSON.stringify(newFavs))
  }

  const inp = {
    padding: '9px 12px', borderRadius: 7, fontSize: 13,
    background: '#0f1219', border: `1px solid ${C.border}`,
    color: C.textStrong, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  const globalStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: ${C.bg}; }
    input:focus, select:focus { outline: none; border-color: ${C.accentMuted} !important; background: rgba(99,102,241,0.05) !important; }
    a { color: ${C.accentMuted}; text-decoration: none; transition: opacity 0.2s; }
    a:hover { opacity: 0.85; }
    @keyframes heartBeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif', lineHeight: 1.5 }}>
      <style>{globalStyles}</style>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '10px 20px 100px' }}>
        
        {/* BREADCRUMB */}
        <div style={{ marginBottom: 16, fontSize: 11, color: C.text, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          <a href="/" style={{ color: C.accentMuted }}>Home</a>
          <span style={{ margin: '0 8px', opacity: 0.4 }}>•</span>
          <span>Room Title Generator</span>
        </div>

        {/* HEADER */}
        <h1 style={{ fontSize: 32, fontWeight: 900, color: C.textStrong, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Room Title Generator
        </h1>
        <p style={{ fontSize: 14, color: C.text, marginBottom: 24, lineHeight: 1.6, maxWidth: '90%' }}>
          Generate high-converting Chaturbate room titles instantly. Free tool, no signup required.
        </p>

        {/* GENERATOR */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 28, backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, fontWeight: 600 }}>Goal</label>
              <input type="number" value={tokens} onChange={e => setTokens(e.target.value)} placeholder="e.g. 500" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, fontWeight: 600 }}>Reward</label>
              <input value={action} onChange={e => setAction(e.target.value)} placeholder="e.g. flash, dance" style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, fontWeight: 600 }}>Toy</label>
              <select value={toy} onChange={e => setToy(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {TOYS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, fontWeight: 600 }}>Mood</label>
              <select value={mood} onChange={e => setMood(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {MOODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.text }}>
              <input type="checkbox" checked={useEmojis} onChange={() => setUseEmojis(v => !v)} style={{ accentColor: C.accentMuted, cursor: 'pointer' }} />
              Add emojis
            </label>
          </div>
          
          <button onClick={generate} disabled={isGenerating} style={{
            width: '100%', marginTop: 12, padding: '12px 20px', borderRadius: 9,
            background: `linear-gradient(135deg, ${C.accentMuted}, ${C.accentViolet})`,
            border: `1px solid rgba(99,102,241,0.3)`,
            color: C.textStrong, fontSize: 13, fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(99,102,241,0.1)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.3px',
            opacity: isGenerating ? 0.7 : 1,
          }} onMouseEnter={(e) => {
            if (!isGenerating) {
              e.style.transform = 'translateY(-1px)'
              e.style.boxShadow = '0 4px 12px rgba(99,102,241,0.15)'
            }
          }} onMouseLeave={(e) => {
            e.style.transform = 'translateY(0)'
            e.style.boxShadow = '0 2px 8px rgba(99,102,241,0.1)'
          }}>
            {isGenerating ? '⏳ Generating...' : '✨ Generate Title'}
          </button>
        </div>

        {/* RESULTS */}
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textStrong, marginBottom: 6 }}>Ready to generate</div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>Fill in your details and generate instant, copy-ready room titles.</div>
          </div>
        ) : (
          <div style={{ marginBottom: 32, animation: 'slideIn 0.3s ease' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Generated titles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((title, idx) => (
                <div key={idx} style={{
                  background: idx === 0 ? 'rgba(99,102,241,0.06)' : C.surface,
                  border: idx === 0 ? `1px solid ${C.border}` : `1px solid rgba(99,102,241,0.08)`,
                  borderRadius: 9, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 13, color: C.textStrong, flex: 1, lineHeight: 1.4, fontWeight: idx === 0 ? 600 : 400 }}>
                    {title}
                  </span>
                  <button onClick={() => toggleFavorite(title)} style={{
                    flexShrink: 0, padding: '6px 10px', borderRadius: 6,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 16, transition: 'all 0.2s',
                    transform: favorites[title] ? 'scale(1.2)' : 'scale(1)',
                  }} onMouseEnter={(e) => { e.style.transform = 'scale(1.15)' }} onMouseLeave={(e) => { e.style.transform = favorites[title] ? 'scale(1.2)' : 'scale(1)' }}>
                    {favorites[title] ? '❤️' : '🤍'}
                  </button>
                  <button onClick={() => copyTitle(title, idx)} style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 6,
                    background: copied === idx ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.08)',
                    border: `1px solid ${copied === idx ? 'rgba(16,185,129,0.25)' : C.border}`,
                    color: copied === idx ? C.green : C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                    {copied === idx ? '✔ Copied' : '📋 Copy'}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={generate} style={{
              width: '100%', marginTop: 12, padding: '10px 16px', borderRadius: 8,
              background: 'rgba(99,102,241,0.08)', border: `1px solid ${C.border}`,
              color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }} onMouseEnter={(e) => {
              e.style.background = 'rgba(99,102,241,0.12)'
              e.style.color = C.textStrong
            }} onMouseLeave={(e) => {
              e.style.background = 'rgba(99,102,241,0.08)'
              e.style.color = C.text
            }}>
              🔄 Generate More
            </button>
          </div>
        )}

        {/* EDUCATION */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.textStrong, marginBottom: 14, letterSpacing: '-0.01em' }}>What makes titles convert</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { icon: '🎯', title: 'Specificity', desc: '"Cum 2000 tokens" beats "having fun"—40% better CTR' },
              { icon: '⏰', title: 'Urgency', desc: '"Tonight only" or "ending soon" creates action' },
              { icon: '💎', title: 'Clear rewards', desc: 'Specific actions outperform vague mentions' },
              { icon: '📏', title: 'Right length', desc: '50-70 characters ideal. Over 80 gets cut' },
              { icon: '🔥', title: 'Match your energy', desc: 'Tease titles for slow builds, hype for action' },
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                <div style={{ fontSize: 18, flexShrink: 0, marginTop: '1px' }}>{tip.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textStrong, marginBottom: 3 }}>{tip.title}</div>
                  <div style={{ fontSize: 11, color: C.text, lineHeight: 1.4 }}>{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STYLES BY VIBE */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.textStrong, marginBottom: 14, letterSpacing: '-0.01em' }}>Examples by style</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { style: 'Flirty', examples: 'you\'re making me blush | tease me softly | playful and fun' },
              { style: 'Dominant', examples: 'top tipper rules | prove yourself | serve me tokens' },
              { style: 'Submissive', examples: 'you\'re in charge | tell me what to do | your wish is my command' },
              { style: 'GFE', examples: 'intimate & personal | just for you | let\'s connect' },
              { style: 'Luxury', examples: 'exclusive experience | VIP treatment | premium show' },
              { style: 'Playful', examples: 'let\'s have fun | games & surprises | silly & hot' },
            ].map((v, i) => (
              <div key={i} style={{ padding: '11px 0', borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textStrong, marginBottom: 4 }}>{v.style}</div>
                <div style={{ fontSize: 11, color: C.text, fontStyle: 'italic', lineHeight: 1.4 }}>{v.examples}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COMMON MISTAKES */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.textStrong, marginBottom: 14, letterSpacing: '-0.01em' }}>Avoid these mistakes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { bad: 'Too generic', good: 'Specific goals with numbers', why: 'Generics get ignored in search' },
              { bad: 'Too long (80+ chars)', good: '50-70 character sweet spot', why: 'Gets cut off on mobile' },
              { bad: 'Repetitive emojis', good: '1-2 emojis max', why: 'Looks spammy' },
              { bad: 'Keyword stuffing', good: 'Natural, personality-driven', why: 'Turns viewers away' },
              { bad: 'Unclear intent', good: 'Clear action (cum, squirt, flash)', why: 'Viewers skip confusion' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '11px 0', borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                <div>
                  <div style={{ fontSize: 10, color: '#666', fontWeight: 700, marginBottom: 3 }}>❌ {m.bad}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, marginBottom: 3 }}>✓ {m.good}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SOFT CTA */}
        <div style={{ background: 'rgba(99,102,241,0.05)', border: `1px solid ${C.border}`, borderRadius: 11, padding: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textStrong, marginBottom: 8 }}>💾 Track your top-performing titles</div>
          <p style={{ fontSize: 11, color: C.text, marginBottom: 12, lineHeight: 1.6 }}>
            Create a free account to save titles, track which perform best, and get personalized suggestions based on your actual data.
          </p>
          <a href="/login" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 7, background: 'rgba(99,102,241,0.12)', color: C.accentMuted, fontSize: 11, fontWeight: 700, border: `1px solid ${C.border}`, transition: 'all 0.2s' }} onMouseEnter={(e) => {
            e.style.background = 'rgba(99,102,241,0.18)'
          }} onMouseLeave={(e) => {
            e.style.background = 'rgba(99,102,241,0.12)'
          }}>
            Create Free Account →
          </a>
        </div>

        {/* RELATED TOOLS */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textStrong, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Creator tools</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '💬', name: 'Bio Generator', desc: 'Engaging bios' },
              { icon: '🎯', name: 'Tip Menu', desc: 'Tip menus that convert' },
              { icon: '#️⃣', name: 'Hashtags', desc: 'Trending hashtags' },
              { icon: '💰', name: 'Earnings Calc', desc: 'Tokens to USD' },
              { icon: '📊', name: 'Analytics', desc: 'Track top tippers' },
              { icon: '💡', name: 'Engagement Ideas', desc: 'Stream ideas' },
            ].map((tool, i) => (
              <a key={i} href="#" style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: 12, display: 'block', transition: 'all 0.2s',
                textDecoration: 'none',
              }} onMouseEnter={(e) => {
                e.style.background = 'rgba(99,102,241,0.08)'
                e.style.borderColor = 'rgba(99,102,241,0.2)'
              }} onMouseLeave={(e) => {
                e.style.background = C.surface
                e.style.borderColor = C.border
              }}>
                <div style={{ fontSize: 16, marginBottom: 6 }}>{tool.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textStrong, marginBottom: 2 }}>{tool.name}</div>
                <div style={{ fontSize: 10, color: C.text }}>{tool.desc}</div>
              </a>
            ))}
          </div>
        </div>

        {/* BLOG/RESOURCES */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textStrong, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Creator guides</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Best Room Titles for More Clicks',
              'How to Get More Viewers on Chaturbate',
              'Viewer Retention Tips for Cam Models',
              'Common Cam Room Mistakes',
              'Best Times to Stream',
              'How to Increase Tips',
            ].map((post, i) => (
              <a key={i} href="#" style={{
                padding: '10px 0', borderBottom: `1px solid rgba(99,102,241,0.06)`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 12, color: C.text, textDecoration: 'none', transition: 'all 0.2s',
              }} onMouseEnter={(e) => {
                e.style.color = C.accentMuted
              }} onMouseLeave={(e) => {
                e.style.color = C.text
              }}>
                <span>{post}</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textStrong, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.6px' }}>FAQ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { q: 'What makes a good room title?', a: 'Specific goals, clear rewards, urgency, personality. Avoid generic or vague wording.' },
              { q: 'How often should I change titles?', a: 'Every 2-3 streams. If not working after 15 min, change mid-stream.' },
              { q: 'Do emojis help?', a: 'Yes—1-2 emojis boost clicks 15-20%. Don\'t overuse.' },
              { q: 'What word converts best?', a: '"Cum" and "squirt" are top performers (if appropriate).' },
              { q: 'How long should titles be?', a: '50-70 characters. Over 80 gets cut on mobile.' },
              { q: 'How do titles affect CTR?', a: 'Good titles can increase click-through 40-60%. Specificity matters most.' },
            ].map((faq, i) => (
              <div key={i} style={{ paddingBottom: 10, borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textStrong, marginBottom: 4 }}>Q: {faq.q}</div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '20px', textAlign: 'center', marginTop: 40 }}>
        <p style={{ fontSize: 10, color: C.text, marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Powered by CamCashGrl</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 10, color: C.text }}>
          <a href="/guides">All Tools</a>
          <a href="/blog">Blog</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </div>
  )
}
