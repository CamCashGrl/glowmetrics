'use client'
import { useState, useCallback } from 'react'
import Button from '../../../components/ui/Button'

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
  gradient:  'linear-gradient(135deg, #6C5CFF, #EC4899)',
}

// ─── Title generator data ──────────────────────────────────────────────────────
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

const TITLE_TEMPLATES = [
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

const TITLE_MOOD_PHRASES = {
  tease:      ["you have to earn it 😏", "not giving it up easy 😈", "almost... tip to get me there 💋", "make me want to 💋"],
  dominant:   ["you obey 👑", "I run the show 🔥", "earn your reward 😈", "top tipper controls everything"],
  submissive: ["you control everything 🎮", "you decide 👑", "I do what you say 💦", "your wish is my command"],
  hype:       ["LET'S GO 🔥", "ENERGY IS INSANE ⚡", "WE'RE SO CLOSE 🔥", "DON'T STOP NOW ⚡"],
  mystery:    ["something unexpected 👀", "you won't believe it 😏", "tonight only 🌙", "secret show tonight 🔒"],
}

function generateTitles({ toy, tokenGoal, reward, mood, count = 5, seed = 0 }) {
  const toyName = toy || null
  const goalStr = tokenGoal ? `${tokenGoal} tokens` : null
  const rewardStr = reward?.trim() || null
  const moodPool = TITLE_MOOD_PHRASES[mood] || []
  const moodPhrase = moodPool.length ? moodPool[seed % moodPool.length] : null
  const ctx = { toy: toyName, goalStr, reward: rewardStr, moodPhrase }

  const results = []
  let idx = seed % TITLE_TEMPLATES.length
  let attempts = 0
  while (results.length < count && attempts < TITLE_TEMPLATES.length * 2) {
    try {
      const title = TITLE_TEMPLATES[idx % TITLE_TEMPLATES.length](ctx)
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
  const [toy,        setToy]        = useState('')
  const [tokenGoal,  setTokenGoal]  = useState('')
  const [reward,     setReward]     = useState('')
  const [mood,       setMood]       = useState('none')
  const [titles,     setTitles]     = useState([])
  const [copiedIdx,  setCopiedIdx]  = useState(null)
  const [seed,       setSeed]       = useState(0)

  const QUICK_GOALS   = ['200', '300', '500', '750', '1000', '1500']
  const QUICK_ACTIONS = ['squirt show', 'oil show', 'strip', 'dance', 'fingering', 'vibrator show', 'roleplay', 'feet show']

  const generate = () => {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    setTitles(generateTitles({ toy, tokenGoal: parseInt(tokenGoal) || null, reward, mood, count: 5, seed: nextSeed }))
  }

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <FieldLabel>Interactive toy</FieldLabel>
          <SelectChips options={TOY_OPTIONS} value={toy} onChange={setToy} />
        </div>
        <div>
          <FieldLabel>Vibe / mood</FieldLabel>
          <SelectChips options={MOOD_OPTIONS} value={mood} onChange={setMood} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <FieldLabel>Token goal (optional)</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {QUICK_GOALS.map(g => (
              <button key={g} onClick={() => setTokenGoal(tokenGoal === g ? '' : g)} style={{
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
              color: S.textStrong, fontSize: '16px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <FieldLabel>Reward / action</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a} onClick={() => setReward(reward === a ? '' : a)} style={{
                padding: '4px 9px', borderRadius: '5px',
                border: `1px solid ${reward === a ? S.accent : S.border}`,
                background: reward === a ? S.accentSoft : 'transparent',
                color: reward === a ? S.textStrong : S.text, fontSize: '12px', cursor: 'pointer',
              }}>{a}</button>
            ))}
          </div>
          <input value={reward} onChange={e => setReward(e.target.value)}
            placeholder="or type a custom reward"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '7px',
              border: `1px solid ${S.border}`, background: S.surface,
              color: S.textStrong, fontSize: '16px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: S.text, fontStyle: 'italic' }}>
          💡 Refresh your room title every 15–30 min to test what gets more clicks and tips.
        </p>
        <Button onClick={generate} style={{ padding: '10px 28px', fontSize: '14px', flexShrink: 0 }}>✨ {titles.length > 0 ? 'Generate more' : 'Generate titles'} →</Button>
      </div>

      {titles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: S.text, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            5 titles — click any to copy
          </div>
          {titles.map((title, i) => (
            <div key={i} onClick={() => copy(title, i)} style={{
              padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
              background: copiedIdx === i ? S.greenSoft : S.surface,
              border: `1px solid ${copiedIdx === i ? 'rgba(16,185,129,0.4)' : S.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: '13px', color: copiedIdx === i ? S.green : S.textStrong, lineHeight: 1.4 }}>
                {title}
              </span>
              <span style={{ fontSize: '11px', color: copiedIdx === i ? S.green : S.text, flexShrink: 0 }}>
                {copiedIdx === i ? '✓ Copied' : '📋'}
              </span>
            </div>
          ))}
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
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        background: S.surface, gap: 12,
      }}>
        <a href="/" style={{ textDecoration: 'none', fontWeight: 700, fontSize: '15px', color: S.textStrong, letterSpacing: '-0.2px', flexShrink: 0 }}>
          💜 CamCash
        </a>
        <nav aria-label="Breadcrumb" style={{ minWidth: 0 }}>
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
        <Button as="a" href="/landing" style={{ padding: '6px 14px', fontSize: '12px' }}>Try CamCash free →</Button>
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
