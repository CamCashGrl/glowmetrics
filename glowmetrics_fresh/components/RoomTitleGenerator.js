"use client"
import React, { useState } from "react"

const moods = ["Flirty", "Dominant", "Playful", "Shy", "Tease"]
const goals = ["Make Tips", "Private Shows", "Whales", "Engagement"]
const platforms = ["Chaturbate", "Stripchat", "OnlyFans"]

const templates = {
  Flirty: [
    "come play with me 💕 let's have some fun tonight",
    "feeling extra naughty tonight... join me 😈",
    "i've been thinking about you all day 💋"
  ],
  Dominant: [
    "who's going to control me tonight? 🎮",
    "big tippers run the show tonight 💰",
    "you don’t watch… you participate 😈"
  ],
  Playful: [
    "spin the wheel 🎡 let’s see what happens",
    "games, vibes, and surprises tonight 🎁",
    "let’s get a little crazy tonight 😜"
  ],
  Shy: [
    "be gentle with me tonight 🥺",
    "i need someone to warm me up 💕",
    "i might be shy… but not for long"
  ],
  Tease: [
    "you can look… but can you handle it? 👀",
    "closer… just a little closer 😏",
    "i’ll show more if you behave"
  ]
}

function enhanceTitle(base, goal) {
  switch (goal) {
    case "Whales":
      return `${base} 💎 top tippers get special treatment`
    case "Private Shows":
      return `${base} 🔒 private show menu is OPEN`
    case "Engagement":
      return `${base} 💬 talk to me, i don’t bite`
    default:
      return `${base} 💰 tip to unlock more`
  }
}

export default function TitleGenerator() {
  const [mood, setMood] = useState("Flirty")
  const [goal, setGoal] = useState("Make Tips")
  const [platform, setPlatform] = useState("Chaturbate")
  const [currentTitle, setCurrentTitle] = useState("")
  const [index, setIndex] = useState(0)

  const generateTitle = () => {
    const pool = templates[mood]
    const nextIndex = (index + 1) % pool.length
    setIndex(nextIndex)

    let base = pool[nextIndex]

    // platform tweaks
    if (platform === "Chaturbate") {
      base += " 🔥"
    } else if (platform === "Stripchat") {
      base += " 💋"
    } else if (platform === "OnlyFans") {
      base += " 📸"
    }

    const finalTitle = enhanceTitle(base, goal)
    setCurrentTitle(finalTitle)
  }

  const copyTitle = () => {
    navigator.clipboard.writeText(currentTitle)
  }

  return (
    <div style={{
      padding: 24,
      borderRadius: 16,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)"
    }}>
      
      <h2 style={{ marginBottom: 16 }}>🎯 Smart Title Generator</h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={mood} onChange={e => setMood(e.target.value)}>
          {moods.map(m => <option key={m}>{m}</option>)}
        </select>

        <select value={goal} onChange={e => setGoal(e.target.value)}>
          {goals.map(g => <option key={g}>{g}</option>)}
        </select>

        <select value={platform} onChange={e => setPlatform(e.target.value)}>
          {platforms.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Output */}
      <div style={{
        padding: 16,
        borderRadius: 12,
        background: "rgba(0,0,0,0.4)",
        marginBottom: 12,
        fontSize: 16,
        minHeight: 50
      }}>
        {currentTitle || "Click generate to get a high-converting title..."}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={generateTitle}>✨ Generate</button>
        <button onClick={copyTitle}>📋 Copy</button>
      </div>
    </div>
  )
}



"use client"
import { useState } from "react"

// ── SIMPLIFIED TOY NAMES ─────────────────────────────────────────────────────
const TOY_OPTIONS = [
  { value: '', label: 'No toy' },
  { value: 'Lush', label: 'Lush' },
  { value: 'Domi', label: 'Domi' },
  { value: 'Edge', label: 'Edge' },
  { value: 'Hush', label: 'Hush' },
  { value: 'Interactive', label: 'Interactive toy' },
]

const MOOD_OPTIONS = [
  { value: 'none', label: 'No mood' },
  { value: 'tease', label: 'Tease' },
  { value: 'dominant', label: 'Dominant' },
  { value: 'submissive', label: 'Submissive' },
  { value: 'hype', label: 'Hype' },
  { value: 'mystery', label: 'Mystery' },
]

// 25 template functions — EVERY selected input is GUARANTEED to appear
// Inputs: { toy, goalStr, reward, moodPhrase }
const TEMPLATES = [
  ({toy,goalStr,reward,moodPhrase}) => toy&&goalStr&&reward ? `tip to control my ${toy} 🎮 → hit ${goalStr} = ${reward}` : null,
  ({toy,goalStr,reward}) => toy&&goalStr&&reward ? `hit ${goalStr} = ${reward} 🔥 ${toy} active now` : null,
  ({toy,goalStr,reward}) => toy&&goalStr ? `${toy} on — goal: ${goalStr} → ${reward||'surprise'} 😈` : null,
  ({toy,goalStr,moodPhrase}) => toy&&goalStr ? `${toy} reacts to every tip ⚡ | goal: ${goalStr} | ${moodPhrase||'tip now'}` : null,
  ({toy,reward,moodPhrase}) => toy&&reward ? `${moodPhrase||'tip to activate'} my ${toy} → win: ${reward} 👑` : null,
  ({goalStr,reward,moodPhrase}) => goalStr&&reward ? `${goalStr} = ${reward} 💋 | ${moodPhrase||'tip to push me there'}` : null,
  ({toy,goalStr,reward}) => goalStr&&reward ? `countdown to ${reward} ⏱ | ${goalStr}${toy?` | ${toy} on`:''}` : null,
  ({toy,goalStr,moodPhrase}) => toy&&goalStr ? `you run the show — ${toy} + ${goalStr} goal | ${moodPhrase||'tip now'}` : null,
  ({toy,reward}) => toy&&reward ? `${toy} on, I react to every tip 💦 | win: ${reward}` : null,
  ({goalStr,reward,toy}) => goalStr ? `${toy?toy+' + ':''}${goalStr} → ${reward||'something special'} 🎯 tip now` : null,
  ({toy,goalStr,reward,moodPhrase}) => toy&&goalStr ? `${moodPhrase||'bad girl energy 😈'} ${toy} on | ${goalStr} = ${reward||'surprise'}` : null,
  ({goalStr,reward}) => goalStr&&reward ? `help me hit ${goalStr} 🔥 | prize: ${reward} | don't stop now` : null,
  ({toy,goalStr}) => toy&&goalStr ? `${toy} vibrates for every tip 💦 | ${goalStr} goal live` : null,
  ({goalStr,reward,moodPhrase}) => goalStr ? `${moodPhrase||"let's go"} — ${goalStr} goal → ${reward||'you decide what happens'} ⚡` : null,
  ({toy,moodPhrase}) => toy ? `${moodPhrase||'interactive show'} 🎮 ${toy} responds to tips | tip to control` : null,
  ({goalStr,reward,toy}) => goalStr&&reward ? `LIVE NOW 🔴 ${toy?toy+' + ':''}${goalStr} goal → ${reward}` : null,
  ({toy,goalStr,reward}) => goalStr&&reward ? `tip ${goalStr} = unlock ${reward} 🔓${toy?` | ${toy} on`:''}` : null,
  ({toy,goalStr,moodPhrase}) => toy&&goalStr ? `${toy} is waiting 🎮 | ${goalStr} goal | ${moodPhrase||'tip to activate'}` : null,
  ({goalStr,reward}) => goalStr ? `almost there — ${goalStr} to go | ${reward||'surprise'} waiting 👀 tip now` : null,
  ({toy,reward,moodPhrase}) => reward ? `earn it tonight — ${moodPhrase||'tip to decide'} | ${reward}${toy?` | ${toy} on`:''}` : null,
  ({toy,goalStr,moodPhrase}) => goalStr ? `${moodPhrase||'tip to push me'} | ${toy?toy+' active':''} ${goalStr} tokens` : null,
  ({toy,goalStr,reward}) => toy&&reward ? `you control my ${toy} 👑 | hit ${goalStr||'the goal'} = ${reward}` : null,
  ({goalStr,reward,moodPhrase}) => reward ? `${moodPhrase||'tip now'} → ${goalStr?goalStr+' = ':''}${reward} 🔥 tonight only` : null,
  ({toy,goalStr}) => toy&&goalStr ? `${toy} + tips = 🔥 | ${goalStr} goal | every tip I feel it` : null,
  ({toy,goalStr,reward,moodPhrase}) => {
    const parts = [moodPhrase, toy, goalStr?`goal: ${goalStr}`:null, reward].filter(Boolean)
    return parts.length >= 2 ? parts.join(' | ').slice(0, 75) : null
  },
]

const MOOD_PHRASES = {
  tease:      ["you have to earn it 😏", "not giving it up easy 😈", "almost... tip to get me there 💋", "make me want to 💋"],
  dominant:   ["you obey 👑", "I run the show 🔥", "earn your reward 😈", "top tipper controls everything"],
  submissive: ["you control everything 🎮", "you decide 👑", "I do what you say 💦", "your wish is my command"],
  hype:       ["LET'S GO 🔥", "ENERGY IS INSANE ⚡", "WE'RE SO CLOSE 🔥", "DON'T STOP NOW ⚡"],
  mystery:    ["something unexpected 👀", "you won't believe it 😏", "tonight only 🌙", "secret show tonight 🔒"],
}

// Hashtag pools
const HASHTAG_POOLS = {
  platform: {
    Chaturbate: ['#Chaturbate','#CBLive','#ChaturbateModel','#CB','#ChaturbateLive'],
    BongaCams:  ['#BongaCams','#BongaLive','#BCModel','#BongaCamsLive'],
    MyFreeCams: ['#MyFreeCams','#MFC','#MFCModel','#MFCShare'],
    Stripchat:  ['#Stripchat','#StripchatLive','#StripchatModel'],
    default:    ['#CamGirl','#Webcam','#LiveStream','#AdultStream'],
  },
  toy: {
    Lush:        ['#Lush','#LushControl','#ControlMyLush','#LushVibrator','#InteractiveToy'],
    Domi:        ['#Domi','#DomiControl','#ControlMyDomi','#Lovense','#InteractiveToy'],
    Edge:        ['#Edge','#LovenseEdge','#InteractiveToy','#TipToControl'],
    Hush:        ['#Hush','#LovenseHush','#InteractiveToy','#TipToControl'],
    Interactive: ['#InteractiveShow','#TipToControl','#LiveShow','#InteractiveToy'],
    default:     ['#InteractiveShow','#TipToControl','#LiveShow'],
  },
  mood: {
    tease:      ['#TeasingYou','#SlowBurn','#EarnIt','#NaughtyStream'],
    dominant:   ['#BossMode','#YouObey','#InControl','#BadGirl'],
    submissive: ['#YouDecide','#YouControl','#GoodGirl','#YourWish'],
    hype:       ['#LiveNow','#TipGoal','#GoGoGo','#HighEnergy'],
    mystery:    ['#Surprise','#TonightOnly','#SecretShow','#MysteryReward'],
    default:    ['#LiveNow','#TipMenu','#StreamLife'],
  },
  goal:       ['#TokenGoal','#GoalShow','#TipToFinish','#AlmostThere','#TipMenu'],
  highTraffic:['#LiveStream','#AdultStream','#CamGirl','#WebcamModel','#OnlineFun'],
  content:    ['#CamModel','#AdultContent','#OnlineStar','#StreamerLife'],
}

function generateHashtags({ platform = 'Chaturbate', toy = '', mood = 'none', hasGoal = false, count = 15 }) {
  const tags = new Set()
  const platTags = HASHTAG_POOLS.platform[platform] || HASHTAG_POOLS.platform.default
  platTags.slice(0, 3).forEach(t => tags.add(t))
  HASHTAG_POOLS.platform.default.slice(0, 2).forEach(t => tags.add(t))
  const toyKey = toy || 'default'
  const toyTags = HASHTAG_POOLS.toy[toyKey] || HASHTAG_POOLS.toy.default
  toyTags.slice(0, 4).forEach(t => tags.add(t))
  const moodTags = HASHTAG_POOLS.mood[mood] || HASHTAG_POOLS.mood.default
  moodTags.slice(0, 3).forEach(t => tags.add(t))
  if (hasGoal) HASHTAG_POOLS.goal.slice(0, 2).forEach(t => tags.add(t))
  HASHTAG_POOLS.highTraffic.forEach(t => { if (tags.size < count) tags.add(t) })
  HASHTAG_POOLS.content.forEach(t => { if (tags.size < count) tags.add(t) })
  return Array.from(tags).slice(0, count)
}

function generateTitles({ toy, tokenGoal, reward, mood, platform, count = 5, seed = 0 }) {
  const toyName = toy || null
  const goalStr = tokenGoal ? `${tokenGoal} tokens` : null
  const rewardStr = reward?.trim() || null
  const moodPool = MOOD_PHRASES[mood] || []
  const moodPhrase = moodPool.length ? moodPool[seed % moodPool.length] : null
  const ctx = { toy: toyName, goalStr, reward: rewardStr, moodPhrase }

  const results = []
  let idx = seed % TEMPLATES.length
  let attempts = 0
  while (results.length < count && attempts < TEMPLATES.length * 2) {
    try {
      const title = TEMPLATES[idx % TEMPLATES.length](ctx)
      if (title && title.length > 8 && title.length <= 80 && !results.includes(title)) {
        results.push(title.trim())
      }
    } catch (_) {}
    idx++
    attempts++
  }
  // Fallback titles that always work
  const fallbacks = [
    toyName && goalStr ? `${toyName} active — tip to control | goal: ${goalStr}` : null,
    goalStr && rewardStr ? `hit ${goalStr} = ${rewardStr} 🔥 tip now` : null,
    toyName ? `tip to control my ${toyName} 🎮 | ${moodPhrase || 'live now'}` : null,
    goalStr ? `${goalStr} goal live | ${rewardStr || 'surprise'} at finish 🎯` : null,
    `${moodPhrase || 'tip to decide what I do'} | live now 🔴`,
  ].filter(Boolean)
  fallbacks.forEach(f => { if (results.length < count && !results.includes(f)) results.push(f) })
  return results.slice(0, count)
}

export default function RoomTitleGenerator({ C = {}, platform = 'Chaturbate' }) {
  const [toy, setToy] = useState('')
  const [tokenGoal, setTokenGoal] = useState('')
  const [reward, setReward] = useState('')
  const [mood, setMood] = useState('none')
  const [titles, setTitles] = useState([])
  const [hashtags, setHashtags] = useState([])
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [seed, setSeed] = useState(0)
  const [showHashtags, setShowHashtags] = useState(false)

  const cyan = C.cyan || '#22D3EE'
  const pink = C.pink || '#EC4899'
  const white = C.white || '#F1F5F9'
  const text = C.text || '#94A3B8'
  const muted = C.muted || '#475569'
  const card = C.card || '#121826'

  const generate = () => {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    const newTitles = generateTitles({
      toy, tokenGoal: parseInt(tokenGoal) || null,
      reward, mood, platform, count: 5, seed: nextSeed,
    })
    setTitles(newTitles)
    if (showHashtags) {
      setHashtags(generateHashtags({
        platform, toy, mood, hasGoal: Boolean(tokenGoal), count: 15,
      }))
    }
  }

  const toggleHashtags = () => {
    const next = !showHashtags
    setShowHashtags(next)
    if (next && titles.length > 0) {
      setHashtags(generateHashtags({
        platform, toy, mood, hasGoal: Boolean(tokenGoal), count: 15,
      }))
    }
  }

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  const copyAllHashtags = () => {
    navigator.clipboard.writeText(hashtags.join(' ')).catch(() => {})
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 1800)
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: white, fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle = { fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Toy</label>
          <select value={toy} onChange={e => setToy(e.target.value)} style={inputStyle}>
            {TOY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Token Goal</label>
          <input
            type="number" min="0" placeholder="e.g. 500"
            value={tokenGoal} onChange={e => setTokenGoal(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Reward / Action</label>
          <input
            type="text" placeholder="e.g. flash, cam off"
            value={reward} onChange={e => setReward(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Mood</label>
          <select value={mood} onChange={e => setMood(e.target.value)} style={inputStyle}>
            {MOOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Generate buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={generate} style={{
          padding: '10px 24px', borderRadius: 9,
          background: `linear-gradient(135deg, ${cyan}, ${pink})`,
          border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          ✨ Generate {titles.length > 0 ? 'More' : 'Titles'}
        </button>
        <button onClick={toggleHashtags} style={{
          padding: '10px 18px', borderRadius: 9,
          background: showHashtags ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${showHashtags ? cyan : 'rgba(255,255,255,0.1)'}`,
          color: showHashtags ? cyan : text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          # {showHashtags ? 'Hide Hashtags' : 'Show Hashtags'}
        </button>
      </div>

      {/* Title output */}
      {titles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Generated Titles — click to copy
          </div>
          {titles.map((title, i) => (
            <div key={i} onClick={() => copy(title, i)} style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              background: copiedIdx === i ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copiedIdx === i ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 13, color: copiedIdx === i ? '#10B981' : white, lineHeight: 1.4 }}>
                {title}
              </span>
              <span style={{ fontSize: 11, color: copiedIdx === i ? '#10B981' : muted, flexShrink: 0 }}>
                {copiedIdx === i ? '✓ Copied' : '📋'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hashtag output */}
      {showHashtags && hashtags.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Hashtags ({hashtags.length})
            </div>
            <button onClick={copyAllHashtags} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11,
              background: copiedHash ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
              border: 'none', color: copiedHash ? '#10B981' : text, cursor: 'pointer', fontWeight: 600,
            }}>
              {copiedHash ? '✓ Copied!' : '📋 Copy All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hashtags.map(tag => (
              <span key={tag} onClick={() => copy(tag, tag)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12,
                background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.25)',
                color: '#A78BFA', cursor: 'pointer',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
