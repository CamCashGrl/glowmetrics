'use client'
import { useState } from 'react'

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
  Lush:             { control: 'tip to control my Lush 🎮', react: 'Lush reacts to every tip ⚡', buildup: "so close… don't stop 💦" },
  Domi:             { control: 'tip to run my Domi ⚡', react: 'Domi goes full power with every tip', buildup: 'turning it up with every tip 🔥' },
  Edge:             { control: 'tip to push me to the edge', react: 'Edge reacts instantly ⚡', buildup: 'building up with every tip 🔥' },
  Hush:             { control: 'you control my Hush 😈', react: 'wearing it — tip to activate 🔴', buildup: "getting harder to stay quiet 🤫" },
  'Interactive toy':{ control: 'tip to control my toy 🎮', react: 'toy reacts to every tip ⚡', buildup: 'building up with every tip 🔥' },
}
const MOOD_HOOKS = {
  tease:      ["let's see how far you take me", "I'm not giving it up that easy", "you have to earn it tonight", "almost… not yet"],
  dominant:   ["top tipper owns this room", "you earn what I give you", "prove you deserve it", "I decide — you tip"],
  submissive: ["I do what you say tonight", "you're in charge — tip to command me", "your wish is my reaction", "tell me what to do"],
  hype:       ["WE ARE SO CLOSE 🔥", "the energy in here is insane", "LET'S GOOO — tip to push it", "this room is on fire"],
  mystery:    ["you won't believe what happens at goal", "something big is coming… tip to find out", "I have a surprise — help me get there", "curious? tip to unlock it"],
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
  bg: '#05070f', card: 'rgba(15,20,32,0.75)', border: 'rgba(255,255,255,0.08)',
  cyan: '#22D3EE', pink: '#EC4899', gold: '#F59E0B', white: '#F1F5F9',
  muted: '#475569', text: '#94A3B8', green: '#10B981',
}

export default function TitleGeneratorClient() {
  const [tokens, setTokens] = useState('')
  const [action, setAction] = useState('')
  const [toy, setToy] = useState('None')
  const [mood, setMood] = useState('none')
  const [useEmojis, setUseEmojis] = useState(true)
  const [current, setCurrent] = useState(null)
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)

  const generate = () => {
    const title = buildTitle({ tokenGoal: tokens, action, toy, mood, useEmojis })
    if (current) setHistory(h => [current, ...h].slice(0, 5))
    setCurrent(title)
    setCopied(false)
  }

  const copyTitle = (title, idx = null) => {
    navigator.clipboard.writeText(title)
    if (idx === null) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    else { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000) }
  }

  const inp = {
    padding: '10px 14px', borderRadius: 10, fontSize: 14,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: C.white, outline: 'none', width: '100%',
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus { outline: none; border-color: rgba(34,211,238,0.5) !important; }
      `}</style>

      <nav style={{ padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 20, color: C.white, textDecoration: 'none' }}>
          Cam<span style={{ color: C.cyan }}>Cash</span>
        </a>
        <a href="/login" style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Start Free →
        </a>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '52px 24px 100px' }}>
        <nav style={{ marginBottom: 24, fontSize: 13 }}>
          <a href="/landing" style={{ color: C.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Room Title Generator</span>
        </nav>

        <h1 style={{ fontSize: 40, fontWeight: 900, color: C.white, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
          Chaturbate Room Title Generator
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', marginBottom: 40, paddingLeft: 20, borderLeft: `3px solid ${C.pink}` }}>
          Generate high-converting room titles using the viral formula: Hook + Goal + Reward + Urgency. Free, no signup required.
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, marginBottom: 24, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Token Goal (optional)</div>
              <input type="number" value={tokens} onChange={e => setTokens(e.target.value)} placeholder="e.g. 500" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Reward / Action (optional)</div>
              <input value={action} onChange={e => setAction(e.target.value)} placeholder="e.g. flash, dance, strip" style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Toy</div>
              <select value={toy} onChange={e => setToy(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {TOYS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Vibe / Mood</div>
              <select value={mood} onChange={e => setMood(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {MOODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
              <input type="checkbox" checked={useEmojis} onChange={() => setUseEmojis(v => !v)} style={{ accentColor: C.pink }} />
              Include emojis
            </label>
            <button onClick={generate} style={{ padding: '12px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #EC4899, #7C5CFF)', border: 'none', color: C.white, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 24px rgba(236,72,153,0.4)' }}>
              ✨ Generate Title
            </button>
          </div>
        </div>

        {current && (
          <div style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(124,92,255,0.08))', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 16, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your title</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.white, lineHeight: 1.4, marginBottom: 20 }}>{current}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={generate} style={{ padding: '8px 18px', borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                🔁 Try Another
              </button>
              <button onClick={() => copyTitle(current)} style={{ padding: '8px 22px', borderRadius: 9, background: copied ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #22D3EE, #EC4899)', border: copied ? '1px solid rgba(16,185,129,0.4)' : 'none', color: C.white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✔ Copied!' : '📋 Copy Title'}
              </button>
            </div>
          </div>
        )}

        {!current && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: C.muted }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 6 }}>One perfect title, every time</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Fill in your details above and hit Generate.</div>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Previous titles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.text, flex: 1, lineHeight: 1.4 }}>{h}</span>
                  <button onClick={() => copyTitle(h, i)} style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 7, background: copiedIdx === i ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copiedIdx === i ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, color: copiedIdx === i ? C.green : C.muted, fontSize: 11, cursor: 'pointer' }}>
                    {copiedIdx === i ? '✔' : '📋'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '40px 32px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', marginTop: 48 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 10 }}>Want titles personalized to YOUR data?</h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>Sign up for CamCash and get titles built around your actual peak hours, top fans, and earning patterns. Free during beta.</p>
          <a href="/login" style={{ display: 'inline-block', padding: '14px 40px', borderRadius: 12, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 0 40px rgba(34,211,238,0.25)' }}>
            Start Free →
          </a>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>
    </div>
  )
}
