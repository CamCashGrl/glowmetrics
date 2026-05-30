'use client'
import { useState, useCallback } from 'react'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:        '#14171C',
  surface:   '#1C2028',
  card:      '#21262F',
  border:    'rgba(255,255,255,0.07)',
  text:      '#8B92A0',
  textMid:   '#C1C7D4',
  textStrong:'#F0F2F6',
  accent:    '#6366F1',
  accentSoft:'rgba(99,102,241,0.12)',
  green:     '#10B981',
  greenSoft: 'rgba(16,185,129,0.1)',
  gold:      '#F59E0B',
  pink:      '#EC4899',
  cyan:      '#22D3EE',
  gradient:  'linear-gradient(135deg, #6366F1, #EC4899)',
}

// ─── Title generator data ──────────────────────────────────────────────────────
const TOYS = ['None', 'Lush', 'Domi', 'Edge', 'Hush', 'Nora', 'Interactive toy']
const MOODS = [
  { value: 'none',       label: 'Auto' },
  { value: 'tease',      label: 'Tease / buildup' },
  { value: 'dominant',   label: 'Dominant' },
  { value: 'submissive', label: 'Submissive / playful' },
  { value: 'hype',       label: 'High energy' },
  { value: 'mystery',    label: 'Mystery' },
]

const TOY_PHRASES = {
  Lush:             { control: 'tip to control my Lush 🎮', react: 'Lush reacts to every tip ⚡', buildup: "so close… don't stop 💦" },
  Domi:             { control: 'tip to run my Domi ⚡',     react: 'Domi goes full power with every tip', buildup: 'turning it up with every tip 🔥' },
  Edge:             { control: 'tip to push me to the edge', react: 'Edge reacts instantly ⚡',          buildup: 'building up with every tip 🔥' },
  Hush:             { control: 'you control my Hush 😈',    react: 'wearing it — tip to activate 🔴',   buildup: "getting harder to stay quiet 🤫" },
  Nora:             { control: 'tip to control my Nora 🎮', react: 'Nora reacts to every token ⚡',     buildup: 'almost there… keep going 💦' },
  'Interactive toy':{ control: 'tip to control my toy 🎮',  react: 'toy reacts to every tip ⚡',        buildup: 'building up with every tip 🔥' },
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
  if (tokenGoal && action && hasToy)  goal = `hit ${tokenGoal} → ${action} + ${toy} reacts`
  else if (tokenGoal && action)        goal = `hit ${tokenGoal} → ${action}`
  else if (tokenGoal && hasToy)        goal = `hit ${tokenGoal} → ${toyData.react}`
  else if (tokenGoal)                  goal = `tip to reach ${tokenGoal}`
  else if (action && hasToy)           goal = `tip → ${action} + ${toyData.react}`
  else if (action)                     goal = `tip → ${action} ${e('😏')}`
  else if (hasToy)                     goal = toyData.react
  else                                 goal = pick(['tip = instant reaction', 'tip to decide what happens', 'tip to run this room'])
  const urgencies = ['tonight only', 'this hour only', 'now or never', 'live now', "don't miss it", "while I'm in this mood"]
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

// ─── Hashtag generator data ────────────────────────────────────────────────────
const HT_PLATFORMS    = ['All platforms', 'Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'Fancentro', 'OnlyFans']
const HT_NICHES       = ['General', 'Cosplay', 'Alt / Tattoo', 'Feet content', 'Gamer girl', 'Petite', 'Curvy', 'Mature', 'Latina', 'Asian', 'MILF', 'BBW']
const HT_STREAM_TYPES = ['Goal show', 'Interactive / toy', 'Tip menu', 'Free stream', 'Couples', 'Cosplay show', 'Wheel game']
const HT_GOALS        = ['No goal', 'Small goal (≤500)', 'Big goal (1000+)', 'Last hour', 'Countdown']

const HASHTAG_POOLS = {
  highTraffic: ['#CamGirl', '#CamModel', '#Chaturbate', '#LiveStream', '#NSFWTwitter', '#AdultCreator', '#MyFreeCams', '#Stripchat', '#BongaCams', '#OnlyFans', '#CamLife', '#LiveCam'],
  community: {
    'Goal show':         ['#GoalShow', '#TokenGoal', '#TipMenu', '#LiveTips', '#CamGoal', '#TipToUnlock'],
    'Interactive / toy': ['#Lovense', '#InteractiveShow', '#TipControl', '#InteractiveToy', '#LushOn', '#ToyControl'],
    'Tip menu':          ['#TipMenu', '#TipList', '#TipForShow', '#TipToPlay', '#TokenMenu'],
    'Free stream':       ['#FreeShow', '#ComeHangOut', '#ChatWithMe', '#OpenRoom'],
    'Couples':           ['#CouplesShow', '#CamCouple', '#CouplesCam', '#TwoForOne'],
    'Cosplay show':      ['#CosplayCam', '#CosplayShow', '#DressUp', '#Roleplay'],
    'Wheel game':        ['#WheelGame', '#SpinTheWheel', '#RandomShow', '#WheelOfFun'],
  },
  niche: {
    'General':      ['#CamModelLife', '#LiveCamShow', '#AdultEntertainment'],
    'Cosplay':      ['#Cosplay', '#CosplayGirl', '#AnimeCosplay', '#GamerCosplay'],
    'Alt / Tattoo': ['#AltModel', '#TattooModel', '#AltGirl', '#TattooGirl', '#GothModel'],
    'Feet content': ['#FeetContent', '#FeetLovers', '#FootFetish', '#BareFeet'],
    'Gamer girl':   ['#GamerGirl', '#GamingStream', '#GirlGamer', '#NerdyGirl'],
    'Petite':       ['#PetiteModel', '#PetiteGirl', '#TinyGirl'],
    'Curvy':        ['#CurvyModel', '#CurvyGirl', '#ThickModel', '#PlusSizeModel'],
    'Mature':       ['#MatureModel', '#MatureCam', '#MILF'],
    'Latina':       ['#LatinaModel', '#LatinaCam', '#LatinGirl'],
    'Asian':        ['#AsianModel', '#AsianCam', '#AsianGirl'],
    'MILF':         ['#MILF', '#MatureModel', '#HotMom', '#MatureCam'],
    'BBW':          ['#BBWModel', '#BBWCam', '#PlusSizeModel', '#CurvyModel'],
  },
  experimental: {
    'No goal':           ['#ChillStream', '#ComeHangOut', '#JustVibes'],
    'Small goal (≤500)': ['#SmallGoal', '#TipToGoal', '#QuickGoal'],
    'Big goal (1000+)':  ['#BigGoal', '#MegaShow', '#GoalNight'],
    'Last hour':         ['#LastHour', '#FinalPush', '#LastChance'],
    'Countdown':         ['#Countdown', '#AlmostThere', '#GoalCountdown'],
    default:             ['#CreatorLife', '#ContentCreator', '#StreamerLife'],
  },
  platform: {
    'Chaturbate':    ['#Chaturbate', '#CBCam'],
    'BongaCams':     ['#BongaCams', '#BongaModel'],
    'MyFreeCams':    ['#MyFreeCams', '#MFC'],
    'Stripchat':     ['#Stripchat', '#StripchatModel'],
    'Fancentro':     ['#Fancentro', '#FancentroModel'],
    'OnlyFans':      ['#OnlyFans', '#OFModel'],
    'All platforms': ['#CamModel', '#LiveStream'],
  },
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function buildHashtags({ platform, niche, streamType, goal }) {
  const ht      = shuffle(HASHTAG_POOLS.highTraffic).slice(0, 2)
  const platTags = HASHTAG_POOLS.platform[platform] || HASHTAG_POOLS.platform['All platforms']
  const commPool = HASHTAG_POOLS.community[streamType] || ['#LiveStream', '#CamModel', '#TipMenu']
  const comm     = shuffle(commPool).slice(0, 3)
  const nichePool= HASHTAG_POOLS.niche[niche] || HASHTAG_POOLS.niche['General']
  const nicheT   = shuffle(nichePool).slice(0, 3)
  const expPool  = HASHTAG_POOLS.experimental[goal] || HASHTAG_POOLS.experimental.default
  const exp      = shuffle(expPool).slice(0, 2)
  const all      = [...platTags.slice(0, 1), ...ht.slice(0, 1), ...comm, ...nicheT, ...exp, ...ht.slice(1), ...platTags.slice(1)]
  return [...new Set(all)].slice(0, 12).join(' ')
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────
function SelectChips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(opt => {
        const val    = typeof opt === 'object' ? opt.value : opt
        const label  = typeof opt === 'object' ? opt.label : opt
        const active = value === val
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            padding: '6px 12px', borderRadius: '7px',
            border: `1px solid ${active ? S.accent : S.border}`,
            background: active ? S.accentSoft : 'transparent',
            color: active ? S.textStrong : S.text,
            fontSize: '12px', fontWeight: active ? 700 : 400, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, color: S.text,
      textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px',
    }}>{children}</div>
  )
}

function CopyButton({ text, style: extra }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy} style={{
      padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
      fontSize: '12px', fontWeight: 700, transition: 'all 0.2s',
      background: copied ? S.green : S.gradient, color: '#fff', ...extra,
    }}>{copied ? '✓ Copied!' : 'Copy'}</button>
  )
}

function GeneratedOutput({ label, value, onNew }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '18px 20px', marginTop: '16px' }}>
      {label && <div style={{ fontSize: '11px', fontWeight: 700, color: S.text, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{label}</div>}
      <div style={{ fontSize: '14px', color: S.textStrong, lineHeight: 1.6, marginBottom: '14px', minHeight: '44px' }}>
        {value}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={onNew} style={{
          padding: '8px 16px', borderRadius: '7px', border: `1px solid ${S.border}`,
          background: 'transparent', color: S.textMid, fontSize: '12px', cursor: 'pointer',
        }}>↻ New variation</button>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Title Generator component ────────────────────────────────────────────────
function TitleGenerator() {
  const [tokenGoal, setTokenGoal] = useState('')
  const [action,    setAction]    = useState('')
  const [toy,       setToy]       = useState('None')
  const [mood,      setMood]      = useState('none')
  const [useEmojis, setUseEmojis] = useState(true)
  const [generated, setGenerated] = useState('')
  const [history,   setHistory]   = useState([])

  const generate = useCallback(() => {
    const title = buildTitle({ tokenGoal, action, toy, mood, useEmojis })
    setGenerated(title)
    setHistory(h => [title, ...h].slice(0, 4))
  }, [tokenGoal, action, toy, mood, useEmojis])

  const QUICK_ACTIONS = ['squirt show', 'oil show', 'strip', 'dance', 'fingering', 'vibrator show', 'roleplay', 'feet show']
  const QUICK_GOALS   = ['200', '300', '500', '750', '1000', '1500']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <FieldLabel>Token goal (optional)</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {QUICK_GOALS.map(g => (
              <button key={g} onClick={() => setTokenGoal(g)} style={{
                padding: '4px 9px', borderRadius: '5px',
                border: `1px solid ${tokenGoal === g ? S.accent : S.border}`,
                background: tokenGoal === g ? S.accentSoft : 'transparent',
                color: tokenGoal === g ? S.textStrong : S.text, fontSize: '12px', cursor: 'pointer',
              }}>{g}</button>
            ))}
          </div>
          <input value={tokenGoal} onChange={e => setTokenGoal(e.target.value)}
            placeholder="or type a custom amount"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '7px',
              border: `1px solid ${S.border}`, background: S.surface,
              color: S.textStrong, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <FieldLabel>Reward / action</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a} onClick={() => setAction(a)} style={{
                padding: '4px 9px', borderRadius: '5px',
                border: `1px solid ${action === a ? S.accent : S.border}`,
                background: action === a ? S.accentSoft : 'transparent',
                color: action === a ? S.textStrong : S.text, fontSize: '12px', cursor: 'pointer',
              }}>{a}</button>
            ))}
          </div>
          <input value={action} onChange={e => setAction(e.target.value)}
            placeholder="or type a custom reward"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '7px',
              border: `1px solid ${S.border}`, background: S.surface,
              color: S.textStrong, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <FieldLabel>Interactive toy</FieldLabel>
          <SelectChips options={TOYS} value={toy} onChange={setToy} />
        </div>
        <div>
          <FieldLabel>Vibe / mood</FieldLabel>
          <SelectChips options={MOODS} value={mood} onChange={v => setMood(v)} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: S.textMid }}>
          <input type="checkbox" checked={useEmojis} onChange={e => setUseEmojis(e.target.checked)} style={{ accentColor: S.accent }} />
          Include emojis
        </label>
        <button onClick={generate} style={{
          padding: '10px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: S.gradient, color: '#fff', fontSize: '14px', fontWeight: 700,
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
        }}>Generate title →</button>
      </div>

      {generated && (
        <GeneratedOutput label="Generated title" value={generated} onNew={generate} />
      )}

      {history.length > 1 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: S.text, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Recent generations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.slice(1).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', background: S.card, borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', color: S.textMid, flex: 1, lineHeight: 1.4 }}>{t}</div>
                <CopyButton text={t} style={{ flexShrink: 0, padding: '5px 10px', fontSize: '11px' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hashtag Generator component ──────────────────────────────────────────────
function HashtagGenerator() {
  const [platform,   setPlatform]   = useState('All platforms')
  const [niche,      setNiche]      = useState('General')
  const [streamType, setStreamType] = useState('Goal show')
  const [goal,       setGoal]       = useState('No goal')
  const [generated,  setGenerated]  = useState('')
  const [sets,       setSets]       = useState([])

  const generate = useCallback(() => {
    const tags = buildHashtags({ platform, niche, streamType, goal })
    setGenerated(tags)
    setSets(s => [tags, ...s].slice(0, 3))
  }, [platform, niche, streamType, goal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <FieldLabel>Platform</FieldLabel>
          <SelectChips options={HT_PLATFORMS} value={platform} onChange={setPlatform} />
        </div>
        <div>
          <FieldLabel>Your niche</FieldLabel>
          <SelectChips options={HT_NICHES} value={niche} onChange={setNiche} />
        </div>
        <div>
          <FieldLabel>Stream type</FieldLabel>
          <SelectChips options={HT_STREAM_TYPES} value={streamType} onChange={setStreamType} />
        </div>
        <div>
          <FieldLabel>Goal style</FieldLabel>
          <SelectChips options={HT_GOALS} value={goal} onChange={setGoal} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={generate} style={{
          padding: '10px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${S.green}, ${S.cyan})`,
          color: '#fff', fontSize: '14px', fontWeight: 700,
          boxShadow: '0 0 20px rgba(16,185,129,0.25)',
        }}>Generate hashtags →</button>
      </div>

      {generated && (
        <>
          <GeneratedOutput label="Your hashtag set" value={generated} onNew={generate} />
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: S.text, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Tags at a glance</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {generated.split(' ').map((tag, i) => (
                <span key={i} style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '5px', fontWeight: 600,
                  color: i < 2 ? S.accent : i < 5 ? S.green : i < 8 ? S.pink : S.gold,
                  background: i < 2 ? S.accentSoft : i < 5 ? S.greenSoft : i < 8 ? 'rgba(236,72,153,0.1)' : 'rgba(245,158,11,0.1)',
                }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', color: S.text, flexWrap: 'wrap' }}>
              <span style={{ color: S.accent }}>■ High traffic</span>
              <span style={{ color: S.green }}>■ Community</span>
              <span style={{ color: S.pink }}>■ Niche</span>
              <span style={{ color: S.gold }}>■ Experimental</span>
            </div>
          </div>
        </>
      )}

      {sets.length > 1 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: S.text, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Previous sets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sets.slice(1).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', background: S.card, borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: S.text, flex: 1, lineHeight: 1.5, wordBreak: 'break-word' }}>{s}</div>
                <CopyButton text={s} style={{ flexShrink: 0, padding: '5px 10px', fontSize: '11px' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TitleGeneratorClient() {
  const [activeTab, setActiveTab] = useState('titles')

  return (
    <div style={{ background: S.bg }}>

      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${S.border}`, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: S.surface,
      }}>
        <nav aria-label="Breadcrumb">
          <ol style={{ display: 'flex', gap: '6px', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
            {[['Home', '/'], ['Guides', '/guides'], ['Room Title Generator', null]].map(([label, href], i) => (
              <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ color: S.text, fontSize: '12px' }}>/</span>}
                {href
                  ? <a href={href} style={{ fontSize: '12px', color: S.text, textDecoration: 'none' }}>{label}</a>
                  : <span style={{ fontSize: '12px', color: S.textMid }}>{label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <a href="/landing" style={{
          padding: '6px 14px', borderRadius: '7px', textDecoration: 'none',
          background: S.gradient, color: '#fff', fontSize: '12px', fontWeight: 700,
        }}>Try CamCash free →</a>
      </div>

      {/* Hero */}
      <div style={{
        padding: 'clamp(40px, 6vw, 72px) 20px clamp(32px, 4vw, 48px)',
        textAlign: 'center',
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        borderBottom: `1px solid ${S.border}`,
      }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            color: S.accent, background: S.accentSoft, padding: '4px 12px', borderRadius: '20px',
            marginBottom: '18px',
          }}>Free Creator Tool · No Signup Required</div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: S.textStrong,
            margin: '0 0 14px', letterSpacing: '-0.04em', lineHeight: 1.15,
          }}>Cam Room Title Generator</h1>
          <p style={{
            fontSize: 'clamp(15px, 2vw, 17px)', color: S.textMid, lineHeight: 1.7,
            margin: '0 0 24px', maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto',
          }}>
            Generate room titles and hashtags designed to increase clicks, engagement, tips, and viewer interaction.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {['✓ More clicks', '✓ Better engagement', '✓ More tips', '✓ Free to use'].map((b, i) => (
              <span key={i} style={{ fontSize: '13px', color: S.green, fontWeight: 600 }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tools */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', padding: '24px 0 0', borderBottom: `1px solid ${S.border}`, marginBottom: '0' }}>
          {[
            { id: 'titles',   label: '🎯 Room Title Generator' },
            { id: 'hashtags', label: '#️⃣ Hashtag Generator' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 700,
              background: activeTab === tab.id ? S.card : 'transparent',
              color: activeTab === tab.id ? S.textStrong : S.text,
              borderBottom: activeTab === tab.id ? `2px solid ${S.accent}` : '2px solid transparent',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Tool card */}
        <div style={{
          background: S.card, border: `1px solid ${S.border}`, borderTop: 'none',
          borderRadius: '0 0 12px 12px', padding: 'clamp(20px, 4vw, 32px)', marginBottom: '0',
        }}>
          {activeTab === 'titles'   && <TitleGenerator />}
          {activeTab === 'hashtags' && <HashtagGenerator />}
        </div>

      </div>
    </div>
  )
}
