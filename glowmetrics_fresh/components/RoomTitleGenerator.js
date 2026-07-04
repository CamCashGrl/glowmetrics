"use client"
import { useState } from "react"
import Button from "./ui/Button"

const TOY_OPTIONS = [
  { value: '', label: 'No toy' },
  { value: 'Lush', label: 'Lush' },
  { value: 'Domi', label: 'Domi' },
  { value: 'Edge', label: 'Edge' },
  { value: 'Hush', label: 'Hush' },
  { value: 'Interactive', label: 'Interactive toy' },
]

const MOOD_OPTIONS = [
  { value: 'none',       label: 'No mood' },
  { value: 'tease',      label: 'Tease' },
  { value: 'dominant',   label: 'Dominant' },
  { value: 'submissive', label: 'Submissive' },
  { value: 'hype',       label: 'Hype' },
  { value: 'mystery',    label: 'Mystery' },
]

const TEMPLATES = [
  ({ toy, goalStr, reward, moodPhrase }) => toy && goalStr && reward ? `tip to control my ${toy} 🎮 → hit ${goalStr} = ${reward}` : null,
  ({ toy, goalStr, reward }) => toy && goalStr && reward ? `hit ${goalStr} = ${reward} 🔥 ${toy} active now` : null,
  ({ toy, goalStr, reward }) => toy && goalStr ? `${toy} on — goal: ${goalStr} → ${reward || 'surprise'} 😈` : null,
  ({ toy, goalStr, moodPhrase }) => toy && goalStr ? `${toy} reacts to every tip ⚡ | goal: ${goalStr} | ${moodPhrase || 'tip now'}` : null,
  ({ toy, reward, moodPhrase }) => toy && reward ? `${moodPhrase || 'tip to activate'} my ${toy} → win: ${reward} 👑` : null,
  ({ goalStr, reward, moodPhrase }) => goalStr && reward ? `${goalStr} = ${reward} 💋 | ${moodPhrase || 'tip to push me there'}` : null,
  ({ toy, goalStr, reward }) => goalStr && reward ? `countdown to ${reward} ⏱ | ${goalStr}${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goalStr, moodPhrase }) => toy && goalStr ? `you run the show — ${toy} + ${goalStr} goal | ${moodPhrase || 'tip now'}` : null,
  ({ toy, reward }) => toy && reward ? `${toy} on, I react to every tip 💦 | win: ${reward}` : null,
  ({ goalStr, reward, toy }) => goalStr ? `${toy ? toy + ' + ' : ''}${goalStr} → ${reward || 'something special'} 🎯 tip now` : null,
  ({ toy, goalStr, reward, moodPhrase }) => toy && goalStr ? `${moodPhrase || 'bad girl energy 😈'} ${toy} on | ${goalStr} = ${reward || 'surprise'}` : null,
  ({ goalStr, reward }) => goalStr && reward ? `help me hit ${goalStr} 🔥 | prize: ${reward} | don't stop now` : null,
  ({ toy, goalStr }) => toy && goalStr ? `${toy} vibrates for every tip 💦 | ${goalStr} goal live` : null,
  ({ goalStr, reward, moodPhrase }) => goalStr ? `${moodPhrase || "let's go"} — ${goalStr} goal → ${reward || 'you decide what happens'} ⚡` : null,
  ({ toy, moodPhrase }) => toy ? `${moodPhrase || 'interactive show'} 🎮 ${toy} responds to tips | tip to control` : null,
  ({ goalStr, reward, toy }) => goalStr && reward ? `LIVE NOW 🔴 ${toy ? toy + ' + ' : ''}${goalStr} goal → ${reward}` : null,
  ({ toy, goalStr, reward }) => goalStr && reward ? `tip ${goalStr} = unlock ${reward} 🔓${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goalStr, moodPhrase }) => toy && goalStr ? `${toy} is waiting 🎮 | ${goalStr} goal | ${moodPhrase || 'tip to activate'}` : null,
  ({ goalStr, reward }) => goalStr ? `almost there — ${goalStr} to go | ${reward || 'surprise'} waiting 👀 tip now` : null,
  ({ toy, reward, moodPhrase }) => reward ? `earn it tonight — ${moodPhrase || 'tip to decide'} | ${reward}${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goalStr, moodPhrase }) => goalStr ? `${moodPhrase || 'tip to push me'} | ${toy ? toy + ' active' : ''} ${goalStr} tokens` : null,
  ({ toy, goalStr, reward }) => toy && reward ? `you control my ${toy} 👑 | hit ${goalStr || 'the goal'} = ${reward}` : null,
  ({ goalStr, reward, moodPhrase }) => reward ? `${moodPhrase || 'tip now'} → ${goalStr ? goalStr + ' = ' : ''}${reward} 🔥 tonight only` : null,
  ({ toy, goalStr }) => toy && goalStr ? `${toy} + tips = 🔥 | ${goalStr} goal | every tip I feel it` : null,
  ({ toy, goalStr, reward, moodPhrase }) => {
    const parts = [moodPhrase, toy, goalStr ? `goal: ${goalStr}` : null, reward].filter(Boolean)
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

const HASHTAG_POOLS = {
  highTraffic: ['#CamGirl', '#CamModel', '#LiveStream', '#AdultCreator', '#CamLife', '#LiveCam', '#NSFWTwitter'],
  toy: {
    Lush:        ['#Lush', '#LushControl', '#ControlMyLush', '#LushVibrator', '#Lovense'],
    Domi:        ['#Domi', '#DomiControl', '#ControlMyDomi', '#Lovense', '#PowerVibes'],
    Edge:        ['#Edge', '#LovenseEdge', '#TipToControl', '#Lovense'],
    Hush:        ['#Hush', '#LovenseHush', '#TipToControl', '#Lovense'],
    Interactive: ['#InteractiveShow', '#TipToControl', '#ToyControl', '#LiveTips'],
    default:     ['#InteractiveShow', '#TipToControl', '#LiveShow'],
  },
  community: {
    goal:    ['#TokenGoal', '#GoalShow', '#TipMenu', '#TipToUnlock', '#AlmostThere'],
    nontip:  ['#ComeHangOut', '#ChatWithMe', '#FreeShow', '#JustVibes'],
  },
  mood: {
    tease:      ['#TeasingYou', '#SlowBurn', '#EarnIt', '#NaughtyStream'],
    dominant:   ['#BossMode', '#YouObey', '#InControl', '#BadGirl'],
    submissive: ['#YouDecide', '#YouControl', '#GoodGirl', '#YourWish'],
    hype:       ['#LiveNow', '#GoGoGo', '#HighEnergy', '#LetsGo'],
    mystery:    ['#Surprise', '#TonightOnly', '#SecretShow', '#MysteryReward'],
    default:    ['#LiveNow', '#StreamLife', '#CamModelLife'],
  },
  platform: {
    Chaturbate: ['#Chaturbate', '#CBLive', '#CB'],
    Stripchat:  ['#Stripchat', '#StripchatLive'],
    OnlyFans:   ['#OnlyFans', '#OFModel'],
    BongaCams:  ['#BongaCams', '#BongaLive'],
    MyFreeCams: ['#MyFreeCams', '#MFC'],
    default:    ['#CamModel', '#LiveStream'],
  },
}

function generateHashtags({ platform, toy, mood, hasGoal }) {
  const tags = new Set()
  const platPool = HASHTAG_POOLS.platform[platform] || HASHTAG_POOLS.platform.default
  platPool.forEach(t => tags.add(t))
  HASHTAG_POOLS.highTraffic.slice(0, 3).forEach(t => tags.add(t))
  const toyPool = toy ? (HASHTAG_POOLS.toy[toy] || HASHTAG_POOLS.toy.default) : []
  toyPool.slice(0, 4).forEach(t => tags.add(t))
  const moodPool = HASHTAG_POOLS.mood[mood] || HASHTAG_POOLS.mood.default
  moodPool.slice(0, 3).forEach(t => tags.add(t))
  const commPool = hasGoal ? HASHTAG_POOLS.community.goal : HASHTAG_POOLS.community.nontip
  commPool.slice(0, 3).forEach(t => tags.add(t))
  HASHTAG_POOLS.highTraffic.slice(3).forEach(t => { if (tags.size < 15) tags.add(t) })
  return {
    platform: platPool,
    highTraffic: HASHTAG_POOLS.highTraffic.slice(0, 4).filter(t => tags.has(t)),
    toy: toyPool.slice(0, 4),
    community: commPool.slice(0, 3),
    mood: moodPool.slice(0, 3),
  }
}

function generateTitles({ toy, tokenGoal, reward, mood, count = 5, seed = 0 }) {
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
  const [toy,        setToy]        = useState('')
  const [tokenGoal,  setTokenGoal]  = useState('')
  const [reward,     setReward]     = useState('')
  const [mood,       setMood]       = useState('none')
  const [titles,     setTitles]     = useState([])
  const [hashtags,   setHashtags]   = useState(null)
  const [copiedIdx,  setCopiedIdx]  = useState(null)
  const [copiedCat,  setCopiedCat]  = useState(null)
  const [seed,       setSeed]       = useState(0)
  const [showHash,   setShowHash]   = useState(false)

  const cyan  = C.cyan  || '#22D3EE'
  const pink  = C.pink  || '#EC4899'
  const white = C.white || '#F1F5F9'
  const text  = C.text  || '#94A3B8'
  const muted = C.muted || '#475569'

  const input = {
    width: '100%', padding: '8px 11px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, color: white, fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }
  const label = { fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'block' }
  const chip = (active) => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${active ? cyan : 'rgba(255,255,255,0.1)'}`,
    background: active ? `rgba(34,211,238,0.1)` : 'transparent',
    color: active ? cyan : text,
  })

  const generate = () => {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    setTitles(generateTitles({ toy, tokenGoal: parseInt(tokenGoal) || null, reward, mood, count: 5, seed: nextSeed }))
    if (showHash) {
      setHashtags(generateHashtags({ platform, toy, mood, hasGoal: Boolean(tokenGoal) }))
    }
  }

  const toggleHash = () => {
    const next = !showHash
    setShowHash(next)
    if (next) setHashtags(generateHashtags({ platform, toy, mood, hasGoal: Boolean(tokenGoal) }))
    else setHashtags(null)
  }

  const copyTitle = (t, i) => {
    navigator.clipboard.writeText(t).catch(() => {})
    setCopiedIdx(i)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  const copyCat = (tags, key) => {
    navigator.clipboard.writeText(tags.join(' ')).catch(() => {})
    setCopiedCat(key)
    setTimeout(() => setCopiedCat(null), 1800)
  }

  const hashCategories = hashtags ? [
    { key: 'highTraffic', label: 'High traffic',   tags: hashtags.highTraffic, color: '#6366F1' },
    { key: 'toy',         label: 'Toy / Interactive', tags: hashtags.toy,      color: cyan },
    { key: 'community',   label: 'Community',       tags: hashtags.community,  color: '#10B981' },
    { key: 'mood',        label: 'Mood',            tags: hashtags.mood,       color: pink },
    { key: 'platform',    label: 'Platform',        tags: hashtags.platform,   color: '#F59E0B' },
  ].filter(c => c.tags.length > 0) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Row 1: toy + mood */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <span style={label}>Toy</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {TOY_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setToy(o.value)} style={chip(toy === o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={label}>Mood</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {MOOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setMood(o.value)} style={chip(mood === o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: goal + reward */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <span style={label}>Token goal</span>
          <input type="number" min="0" placeholder="e.g. 500" value={tokenGoal}
            onChange={e => setTokenGoal(e.target.value)} style={input} />
        </div>
        <div>
          <span style={label}>Reward / action</span>
          <input type="text" placeholder="e.g. flash, cam off" value={reward}
            onChange={e => setReward(e.target.value)} style={input} />
        </div>
      </div>

      {/* Helper tip */}
      <p style={{ margin: 0, fontSize: 11, color: muted, fontStyle: 'italic' }}>
        💡 Refresh your room title every 15–30 min to test what gets more clicks and tips.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={generate} style={{ padding: '9px 22px', fontSize: 13 }}>
          ✨ {titles.length > 0 ? 'Generate more' : 'Generate titles'}
        </Button>
        <button onClick={toggleHash} style={{
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: showHash ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${showHash ? cyan : 'rgba(255,255,255,0.1)'}`,
          color: showHash ? cyan : text,
        }}>
          # {showHash ? 'Hide hashtags' : 'Show hashtags'}
        </button>
      </div>

      {/* Titles */}
      {titles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            5 titles — click to copy
          </span>
          {titles.map((t, i) => (
            <div key={i} onClick={() => copyTitle(t, i)} style={{
              padding: '10px 13px', borderRadius: 8, cursor: 'pointer',
              background: copiedIdx === i ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${copiedIdx === i ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              transition: 'all 0.18s',
            }}>
              <span style={{ fontSize: 13, color: copiedIdx === i ? '#10B981' : white, lineHeight: 1.4 }}>{t}</span>
              <span style={{ fontSize: 11, color: copiedIdx === i ? '#10B981' : muted, flexShrink: 0 }}>
                {copiedIdx === i ? '✓' : '📋'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hashtags by category */}
      {showHash && hashtags && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(124,92,255,0.05)', border: '1px solid rgba(124,92,255,0.15)' }}>
          {hashCategories.map(({ key, label: catLabel, tags, color }) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{catLabel}</span>
                <button onClick={() => copyCat(tags, key)} style={{
                  padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: copiedCat === key ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)',
                  color: copiedCat === key ? '#10B981' : text,
                }}>
                  {copiedCat === key ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {tags.map(tag => (
                  <span key={tag} style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: `${color}18`, border: `1px solid ${color}30`, color,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
