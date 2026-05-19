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

const TITLE_TIPS = [
  { title: 'Keep it short (50-70 chars)', desc: 'Longer titles get cut off on mobile. Be concise.' },
  { title: 'Start with a hook', desc: 'First 3 words matter most. Use emojis to stand out.' },
  { title: 'Be specific, not generic', desc: '"Cum show" beats "having fun" by 40% CTR.' },
  { title: 'Change titles every 2-3 streams', desc: 'Fresh titles get algorithmic boosts on platforms.' },
  { title: 'Match your room energy', desc: 'Tease titles for slow builds, hype titles for action.' },
]

const COMMON_MISTAKES = [
  { bad: 'come chat with me', good: 'squirt show goal 2000 🔥', why: 'Specific goals drive tipping behavior' },
  { bad: 'let\'s have fun 😊', good: 'lush control 💦 tip me cum', why: 'Action-focused titles outperform vague ones' },
  { bad: 'tips appreciated ❤️❤️❤️', good: 'tip 100 → flash my ass 👑', why: 'Clear rewards increase engagement 60%' },
  { bad: 'new girl come watch', good: 'wet 💦 edge close 👀 help me cum', why: 'Emotional/physical language converts better' },
]

const RELATED_TOOLS = [
  { icon: '💬', name: 'Bio Generator', desc: 'Create engaging Chaturbate bios that get clicks' },
  { icon: '🎯', name: 'Tip Menu Generator', desc: 'Design tip menus that actually convert' },
  { icon: '#️⃣', name: 'Hashtag Generator', desc: 'Find trending hashtags for more discoverability' },
  { icon: '💰', name: 'Earnings Calculator', desc: 'Convert tokens to USD instantly' },
  { icon: '📊', name: 'Analytics Dashboard', desc: 'Track your top tippers and best hours' },
  { icon: '💡', name: 'Engagement Ideas', desc: 'Get stream ideas based on your data' },
]

const BLOG_POSTS = [
  { title: 'How to Increase Cam Tips With Data', link: '/blog/how-to-increase-cam-earnings' },
  { title: 'Best Time to Stream on Chaturbate', link: '/blog/how-to-get-views-on-chaturbate' },
  { title: 'Building Loyal Fans That Return', link: '/blog/how-to-build-loyal-fans' },
  { title: 'Common Room Title Mistakes', link: '/blog/chaturbate-title-mistakes' },
  { title: 'Room Engagement Psychology', link: '/blog/room-engagement-psychology' },
  { title: 'How Often to Change Titles', link: '/blog/title-rotation-strategy' },
]

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
        a { color: ${C.cyan}; text-decoration: none; }
        a:hover { opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 24px 80px' }}>
        
        {/* COMPACT BREADCRUMB */}
        <nav style={{ marginBottom: 16, fontSize: 13 }}>
          <a href="/">Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Room Title Generator</span>
        </nav>

        {/* COMPACT HEADER */}
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.white, lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Chaturbate Room Title Generator
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: C.text, marginBottom: 20 }}>
          Generate high-converting room titles instantly. Free, no signup required.
        </p>

        {/* ─────── GENERATOR CARD ─────── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Goal</div>
              <input type="number" value={tokens} onChange={e => setTokens(e.target.value)} placeholder="e.g. 500" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Reward</div>
              <input value={action} onChange={e => setAction(e.target.value)} placeholder="e.g. flash, dance" style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Toy</div>
              <select value={toy} onChange={e => setToy(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {TOYS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Mood</div>
              <select value={mood} onChange={e => setMood(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {MOODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.text }}>
              <input type="checkbox" checked={useEmojis} onChange={() => setUseEmojis(v => !v)} style={{ accentColor: C.pink }} />
              Include emojis
            </label>
            <button onClick={generate} style={{ padding: '10px 24px', borderRadius: 9, background: 'linear-gradient(135deg, #EC4899, #7C5CFF)', border: 'none', color: C.white, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              ✨ Generate
            </button>
          </div>
        </div>

        {/* OUTPUT */}
        {current && (
          <div style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(124,92,255,0.08))', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your title</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, lineHeight: 1.3, marginBottom: 16 }}>{current}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={generate} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                🔁 Try Another
              </button>
              <button onClick={() => copyTitle(current)} style={{ padding: '8px 16px', borderRadius: 8, background: copied ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #22D3EE, #EC4899)', border: copied ? '1px solid rgba(16,185,129,0.4)' : 'none', color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✔ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>
        )}

        {!current && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.muted }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>One perfect title, every time</div>
            <div style={{ fontSize: 12, color: C.muted }}>Fill in details and generate.</div>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Previous titles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{h}</span>
                  <button onClick={() => copyTitle(h, i)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 6, background: copiedIdx === i ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copiedIdx === i ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, color: copiedIdx === i ? C.green : C.muted, fontSize: 10, cursor: 'pointer' }}>
                    {copiedIdx === i ? '✔' : '📋'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────── EDUCATIONAL CONTENT ─────── */}
        
        {/* TITLE TIPS */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 12 }}>5 Tips for Better Room Titles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {TITLE_TIPS.map((tip, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 4 }}>{tip.title}</div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.4 }}>{tip.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BEFORE/AFTER */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 12 }}>Good vs. Weak Titles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {COMMON_MISTAKES.map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94616f', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>❌ Weak</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>{m.bad}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>✓ Strong</div>
                    <div style={{ fontSize: 11, color: C.white, fontWeight: 600 }}>{m.good}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.text, lineHeight: 1.3, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  💡 {m.why}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SOFT CONVERSION */}
        <div style={{ padding: '20px 18px', borderRadius: 12, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 6 }}>💾 Save & Track Your Titles</div>
          <p style={{ fontSize: 11, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>
            Create a free account to save your favorite titles, track which convert best, and get personalized suggestions based on your actual streaming data.
          </p>
          <a href="/login" style={{ display: 'inline-block', padding: '8px 18px', borderRadius: 8, background: 'rgba(34,211,238,0.2)', color: C.cyan, fontSize: 11, fontWeight: 700, border: `1px solid rgba(34,211,238,0.3)` }}>
            Create Free Account →
          </a>
        </div>

        {/* ─────── RELATED TOOLS ─────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 12 }}>More Free Creator Tools</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {RELATED_TOOLS.map((tool, i) => (
              <a key={i} href="#" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, textDecoration: 'none', display: 'block', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{tool.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 4 }}>{tool.name}</div>
                <div style={{ fontSize: 10, color: C.text, lineHeight: 1.3 }}>{tool.desc}</div>
              </a>
            ))}
          </div>
        </div>

        {/* ─────── BLOG/GUIDES ─────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 12 }}>Creator Resources</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BLOG_POSTS.map((post, i) => (
              <a key={i} href={post.link} style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.text }}>{post.title}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 12 }}>FAQ</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { q: 'How often should I change my title?', a: 'Try a new title every 2-3 streams. If not working after 15 mins, change mid-stream.' },
              { q: 'Do emojis help?', a: 'Yes. 1-2 emojis at the start increase clicks by 15-20%. Don\'t overdo it.' },
              { q: 'What word converts best?', a: '"Cum" and "squirt" are highest-performing on Chaturbate (if appropriate).' },
              { q: 'How long should titles be?', a: 'Aim for 50-70 characters. Over 80 gets cut off on mobile.' },
            ].map((faq, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 6 }}>Q: {faq.q}</div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.4 }}>A: {faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Powered by CamCashGrl — Free creator tools</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11 }}>
          <a href="/guides">All Tools</a>
          <a href="/blog">Blog</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </div>
  )
}
