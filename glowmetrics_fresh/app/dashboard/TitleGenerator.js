"use client"
import { useState, useCallback } from "react"

// ============================================================
// ROOM TITLE ENGINE — ONE TITLE AT A TIME
// Formula: HOOK + TARGET + ACTION + REWARD + URGENCY
// ============================================================

// ── TOY CATEGORY LIBRARY ────────────────────────────────────────────────────
// Each category has its own language — sensation, power, intensity, etc.
// Extend by adding new keys. Matched by detecting keywords in toy name.
const TOY_CATEGORIES = {
  lush: {
    sensation: ["I feel every tip inside me", "every vibration takes me higher", "I feel it deep with every tip"],
    control:   ["you control what I feel", "tip to decide my intensity", "you're inside my head right now"],
    buildup:   ["so close… keep going", "don't stop — I'm almost there", "one more tip and I lose it"],
  },
  domi: {
    sensation: ["the power hits different with every tip", "Domi doesn't hold back", "full intensity on command"],
    control:   ["you set the power level", "tip to push it harder", "Domi obeys you"],
    buildup:   ["turning it up with every tip", "building to max — don't stop", "almost at full power"],
  },
  edge: {
    sensation: ["edging myself with every tip", "tip to push me further", "so close to the edge"],
    control:   ["you decide when I fall", "tip to keep me on the edge", "you control the limit"],
    buildup:   ["closer… and closer…", "don't let me fall yet", "holding on as long as you tip"],
  },
  hush: {
    sensation: ["wearing it in public… tip to activate", "you have no idea what this does to me", "shh… I feel every one"],
    control:   ["secret control in your hands", "tip and watch my reaction", "nobody knows but you"],
    buildup:   ["getting harder to stay quiet", "one more tip and I can't hide it", "you're making this impossible"],
  },
  // Generic fallback for any other toy
  default: {
    sensation: ["I feel every tip", "tip = instant reaction", "every one hits harder"],
    control:   ["you decide what happens", "you run this room", "tip to take control"],
    buildup:   ["getting closer with every tip", "almost there — keep going", "don't stop now"],
  }
}

function getToyCategory(toyName) {
  if (!toyName) return null
  const t = toyName.toLowerCase()
  if (t.includes("lush"))  return TOY_CATEGORIES.lush
  if (t.includes("domi"))  return TOY_CATEGORIES.domi
  if (t.includes("edge"))  return TOY_CATEGORIES.edge
  if (t.includes("hush"))  return TOY_CATEGORIES.hush
  return TOY_CATEGORIES.default
}

// ── MOOD LIBRARY ─────────────────────────────────────────────────────────────
// Mood shapes the emotional tone of hooks and closers
const MOOD_HOOKS = {
  tease: [
    "let's see how far you take me",
    "I'm not giving it up that easy",
    "you have to earn it tonight",
    "almost… not yet",
    "make me want to",
  ],
  dominant: [
    "top tipper owns this room",
    "you earn what I give you",
    "prove you deserve it",
    "this is my show — tip to play",
    "I decide — you tip",
  ],
  submissive: [
    "I do what you say tonight",
    "you're in charge — tip to command me",
    "whatever you want, tip for it",
    "your wish is my reaction",
    "tell me what to do",
  ],
  hype: [
    "WE ARE SO CLOSE",
    "the energy in here is insane right now",
    "LET'S GOOO — tip to push it",
    "this room is on fire",
    "we're making history tonight",
  ],
  mystery: [
    "you won't believe what happens at goal",
    "something big is coming… tip to find out",
    "I have a surprise — help me get there",
    "you're not ready for what's next",
    "curious? tip to unlock it",
  ],
}

function buildOneTitle(ctx) {
  const {
    isPeakNow, peakSoon, bestHourLabel, hoursUntilPeak,
    hasWhales, topWhaleName, whaleCount,
    hasReturners, returningPct,
    lowActivity, todayIsBestDay, todayDay,
    tokenGoal, action, toy, mood,
    useEmojis, avgSessionUSD,
  } = ctx

  const e = (emoji) => useEmojis ? emoji : ""
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

  const hasToy  = Boolean(toy && toy.trim())
  const hasMood = Boolean(mood && mood !== "none")
  const toyLib  = getToyCategory(toy)

  // ── HOOKS ─────────────────────────────────────────────────────────────────
  // Priority: mood hooks > toy hooks > data hooks > evergreen
  const moodHooks   = hasMood ? (MOOD_HOOKS[mood] || []) : []
  const toyHooks    = hasToy ? [
    `tip to control my ${toy} ${e("🎮")}`,
    `you control my ${toy} ${e("⚡")}`,
    `my ${toy} is on — you decide ${e("😈")}`,
    `${toy} is live and waiting`,
    toyLib ? pick(toyLib.control) : `tip to run my ${toy}`,
  ] : []

  const dataHooks = [
    ...(isPeakNow      ? [`live right now ${e("🔴")}`, `going live this second`] : []),
    ...(peakSoon       ? [`going live in ${hoursUntilPeak}h — don't miss it`] : []),
    ...(lowActivity    ? [`miss me? ${e("👀")}`, `been a minute ${e("💭")}`] : []),
    ...(todayIsBestDay ? [`${todayDay}s hit different ${e("🔥")}`] : []),
    ...(hasWhales      ? [`VIPs run the show tonight ${e("💎")}`] : []),
  ]

  const evergreen = [
    `you decide what I do ${e("👑")}`,
    `top tipper controls everything`,
    `feeling dangerous tonight ${e("😈")}`,
    `not holding back tonight ${e("🔥")}`,
    `bad girl energy ${e("😈")}`,
    `catching me in a mood ${e("🌙")}`,
    `prove you want it ${e("👀")}`,
    `make me ${e("😏")}`,
  ]

  // Weight: if mood+toy both set, 50% mood, 50% toy; otherwise bias toward what's set
  let hookPool
  if (moodHooks.length && toyHooks.length) {
    hookPool = Math.random() < 0.5 ? moodHooks : toyHooks
  } else if (moodHooks.length) {
    hookPool = [...moodHooks, ...dataHooks, ...evergreen.slice(0, 4)]
  } else if (toyHooks.length) {
    hookPool = [...toyHooks, ...dataHooks.slice(0, 2), ...evergreen.slice(0, 3)]
  } else {
    hookPool = [...dataHooks, ...evergreen]
  }

  // ── GOAL TEXT ─────────────────────────────────────────────────────────────
  let goalText
  if (hasToy && tokenGoal && action) {
    goalText = pick([
      `hit ${tokenGoal} → ${action} + ${toy} reacts`,
      `${tokenGoal} tokens = ${action} & full ${toy} control`,
      `tip to reach ${tokenGoal} — ${toy} goes wild & you get ${action}`,
    ])
  } else if (hasToy && tokenGoal) {
    goalText = pick([
      `hit ${tokenGoal} → my ${toy} reacts`,
      `${tokenGoal} = full ${toy} control`,
      `tip to ${tokenGoal} — ${toy} goes crazy`,
      `get me to ${tokenGoal} and feel what happens`,
    ])
  } else if (hasToy && action) {
    goalText = pick([
      `tip → ${action} + ${toy} control`,
      `tip = ${action} & ${toy} reaction`,
      `unlock ${action} — ${toy} goes with it`,
    ])
  } else if (hasToy) {
    // Toy only — use toy library sensations
    goalText = toyLib
      ? pick([...toyLib.sensation, ...toyLib.control])
      : pick([`tip to control my ${toy}`, `tip = ${toy} reacts`, `tip to push my ${toy}`])
  } else if (tokenGoal && action) {
    goalText = pick([
      `hit ${tokenGoal} → ${action}`,
      `${tokenGoal} tokens = ${action}`,
      `tip to reach ${tokenGoal} & get ${action}`,
      `${tokenGoal} gets you ${action}`,
    ])
  } else if (tokenGoal) {
    goalText = pick([
      `help me hit ${tokenGoal}`,
      `tip to reach ${tokenGoal}`,
      `${tokenGoal} is the goal — push me there`,
      `so close to ${tokenGoal} — don't stop`,
    ])
  } else if (action) {
    goalText = pick([
      `tip → ${action}`,
      `tip = ${action}`,
      `unlock ${action}`,
      `tip and I ${action}`,
    ])
  } else if (hasMood) {
    // Mood only — use buildup or mystery phrasing
    goalText = pick([
      "tip to decide what happens next",
      "tip to take this further",
      "tip = reaction",
      "tip and see what I do",
    ])
  } else {
    goalText = pick([
      "tip to take control",
      "tip = instant reaction",
      "tip to decide what happens",
      "tip to run this room",
    ])
  }

  // ── REWARDS ───────────────────────────────────────────────────────────────
  // Toy → sensation rewards; Mood → mood-matched rewards; fallback → general
  let rewards
  if (hasToy && toyLib) {
    rewards = [
      ...toyLib.sensation,
      ...toyLib.buildup,
      `${toy} goes full power ${e("⚡")}`,
      `full ${toy} control ${e("👑")}`,
      ...(action ? [`${action} + ${toy} reaction`] : []),
    ]
  } else if (hasMood && mood === "tease") {
    rewards = [
      `and maybe I give you what you want ${e("😏")}`,
      `but you have to earn it first`,
      `if you're lucky tonight ${e("👀")}`,
      `I might just let go ${e("💋")}`,
    ]
  } else if (hasMood && mood === "dominant") {
    rewards = [
      `you earn your reward ${e("👑")}`,
      `top earner gets access ${e("🔒")}`,
      `I reward the ones who prove it`,
      `exclusive access for top tipper`,
    ]
  } else if (hasMood && mood === "hype") {
    rewards = [
      `something HUGE happens at goal ${e("🔥")}`,
      `biggest reaction of the night ${e("⚡")}`,
      `I go all out ${e("🔥")}`,
    ]
  } else {
    rewards = [
      ...(action ? [`${action} ${e("😏")}`, `you get ${action}`] : []),
      `special reaction ${e("🔥")}`,
      `private show ${e("💎")}`,
      `you choose everything ${e("👑")}`,
      `I react to every tip ${e("⚡")}`,
      `exclusive content ${e("🔒")}`,
      `big surprise ${e("🎁")}`,
    ]
  }

  // ── URGENCY ───────────────────────────────────────────────────────────────
  const urgencies = [
    ...(isPeakNow ? ["live now", "happening right now"] : []),
    ...(peakSoon  ? [`${hoursUntilPeak}h left`, "starting soon"] : []),
    "tonight only",
    "this hour only",
    "now or never",
    "before I log off",
    "don't miss it",
    "limited time",
    "while I'm in this mood",
    "live now",
  ]

  const hook    = pick(hookPool)
  const reward  = pick(rewards)
  const urgency = pick(urgencies)

  // ── 9 DISTINCT STRUCTURES — varied rhythm, length, tone ──────────────────
  // Includes short punchy, mid-length emotional, and longer descriptive forms
  const n = Math.floor(Math.random() * 9)
  let title

  if (n === 0) {
    // Classic formula — mid length
    title = `${hook} ${e("💦")} ${goalText} → ${reward} (${urgency})`
  } else if (n === 1) {
    // Reward-first — payoff leads
    title = `${reward} ${e("🔥")} — ${goalText} • ${urgency}`
  } else if (n === 2) {
    // Short punchy — goal = reward only
    title = `${goalText} = ${reward} ${e("🔥")} • ${urgency}`
  } else if (n === 3) {
    // Mystery — hook leads with curiosity gap
    title = `${hook}… ${goalText} (${urgency}) ${e("👀")}`
  } else if (n === 4) {
    // FOMO urgency first — time pressure leads
    title = `${urgency.toUpperCase()} ${e("⚡")} ${hook} — ${goalText}`
  } else if (n === 5) {
    // Power dynamic — three-beat structure
    title = `${hook} • ${goalText} • ${reward} (${urgency})`
  } else if (n === 6) {
    // Clean CTA — minimal noise
    title = `${goalText} ${e("→")} ${reward} ${e("💋")} ${urgency}`
  } else if (n === 7) {
    // Emotional / tease — conversational, no formula markers
    title = `${hook}… ${reward} ${e("😈")} (${urgency})`
  } else {
    // Buildup — toyLib.buildup or mood closer if available
    const closer = hasToy && toyLib ? pick(toyLib.buildup) : (hasMood ? pick(MOOD_HOOKS[mood] || [reward]) : reward)
    title = `${hook} ${e("💦")} ${goalText} — ${closer} (${urgency})`
  }

  // Sanitize
  title = title.replace(/\s{2,}/g, " ").replace(/→\s*→/g, "→").trim()
  if (title.length > 100) title = title.slice(0, 97) + "..."

  // ── DRIVERS ───────────────────────────────────────────────────────────────
  const drivers = []
  if (isPeakNow || peakSoon) drivers.push("peak hour timing")
  if (hasWhales)             drivers.push(`${whaleCount} VIP fans`)
  if (todayIsBestDay)        drivers.push(`${todayDay} is your best day`)
  if (lowActivity)           drivers.push("low recent activity")
  if (tokenGoal)             drivers.push(`${tokenGoal} token goal`)
  if (hasToy)                drivers.push(`${toy} (${getToyCategory(toy) === TOY_CATEGORIES.lush ? "wearable" : toy.toLowerCase().includes("domi") ? "wand" : "toy"})`)
  if (hasMood && mood !== "none") drivers.push(`${mood} mood`)
  if (action)                drivers.push(`reward: ${action}`)
  if (hasReturners)          drivers.push(`${returningPct}% returning fans`)
  if (drivers.length === 0)  drivers.push("general engagement")

  return { title, drivers }
}

// ============================================================
// HASHTAG GENERATOR — standalone component
// ============================================================
const HASHTAG_POOLS_HG = {
  platform: {
    Chaturbate:  ['#Chaturbate','#CBLive','#ChaturbateModel','#CB','#ChaturbateLive','#ChaturbateGirl'],
    BongaCams:   ['#BongaCams','#BongaLive','#BCModel','#BongaCamsLive','#BongaCamsGirl'],
    MyFreeCams:  ['#MyFreeCams','#MFC','#MFCModel','#MFCShare','#MyFreeCamsModel'],
    Stripchat:   ['#Stripchat','#StripchatLive','#StripchatModel','#StripchatGirl'],
    CamSoda:     ['#CamSoda','#CamSodaLive','#CamSodaModel'],
    Any:         ['#CamGirl','#Webcam','#LiveStream','#AdultStream','#LiveCam'],
  },
  toy: {
    Lush:        ['#Lush','#LushControl','#ControlMyLush','#LushVibrator','#InteractiveToy','#TipToControl'],
    Domi:        ['#Domi','#DomiControl','#ControlMyDomi','#Lovense','#InteractiveToy','#TipToControl'],
    Edge:        ['#Edge','#LovenseEdge','#InteractiveToy','#TipToControl','#Lovense'],
    Hush:        ['#Hush','#LovenseHush','#InteractiveToy','#TipToControl','#Lovense'],
    Interactive: ['#InteractiveShow','#TipToControl','#LiveShow','#InteractiveToy','#Lovense'],
    None:        ['#TipMenu','#GoalShow','#LiveNow','#TipToDecide'],
  },
  vibe: {
    tease:       ['#TeasingYou','#SlowBurn','#EarnIt','#NaughtyStream','#BadGirl'],
    dominant:    ['#BossMode','#YouObey','#InControl','#BadGirl','#DominantVibes'],
    submissive:  ['#YouDecide','#YouControl','#GoodGirl','#YourWish','#SubVibes'],
    hype:        ['#LiveNow','#TipGoal','#GoGoGo','#HighEnergy','#LetsDo'],
    mystery:     ['#Surprise','#TonightOnly','#SecretShow','#MysteryReward','#FindOut'],
    none:        ['#LiveNow','#TipMenu','#StreamLife','#OnlineNow'],
  },
  goal:        ['#TokenGoal','#GoalShow','#TipToFinish','#AlmostThere','#TipMenu','#HelpMeHitGoal'],
  highTraffic: ['#CamGirl','#LiveStream','#AdultStream','#WebcamModel','#OnlineFun','#NSFW','#AdultContent'],
  content:     ['#CamModel','#OnlineStar','#StreamerLife','#LiveEntertainment','#CamLife'],
}

function generateHashtagsHG({ platform, toy, mood, hasGoal, count = 15 }) {
  const tags = new Set()
  const platTags = HASHTAG_POOLS_HG.platform[platform] || HASHTAG_POOLS_HG.platform.Any
  platTags.slice(0, 3).forEach(t => tags.add(t))
  HASHTAG_POOLS_HG.platform.Any.slice(0, 2).forEach(t => tags.add(t))
  const toyTags = HASHTAG_POOLS_HG.toy[toy] || HASHTAG_POOLS_HG.toy.None
  toyTags.slice(0, 4).forEach(t => tags.add(t))
  const vibeTags = HASHTAG_POOLS_HG.vibe[mood] || HASHTAG_POOLS_HG.vibe.none
  vibeTags.slice(0, 3).forEach(t => tags.add(t))
  if (hasGoal) HASHTAG_POOLS_HG.goal.slice(0, 2).forEach(t => tags.add(t))
  HASHTAG_POOLS_HG.highTraffic.forEach(t => { if (tags.size < count) tags.add(t) })
  HASHTAG_POOLS_HG.content.forEach(t => { if (tags.size < count) tags.add(t) })
  return Array.from(tags).slice(0, count)
}

function HashtagGenerator({ C, glassCard, defaultPlatform = "Chaturbate" }) {
  const [platform, setPlatform] = useState(defaultPlatform)
  const [toy, setToy] = useState("None")
  const [mood, setMood] = useState("none")
  const [hasGoal, setHasGoal] = useState(false)
  const [count, setCount] = useState(15)
  const [hashtags, setHashtags] = useState([])
  const [copied, setCopied] = useState(false)
  const [copiedTag, setCopiedTag] = useState(null)

  const generate = () => {
    const tags = generateHashtagsHG({ platform, toy, mood, hasGoal, count })
    setHashtags(tags)
  }

  const copyAll = () => {
    navigator.clipboard.writeText(hashtags.join(' ')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyOne = (tag) => {
    navigator.clipboard.writeText(tag).catch(() => {})
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 1500)
  }

  const inp = {
    padding: '8px 12px', borderRadius: 8, fontSize: 13,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: C.white, outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const lbl = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 4 }}># Hashtag Generator</div>
        <div style={{ fontSize: 13, color: C.muted }}>Platform-specific hashtags for your stream — mix of high-traffic and niche</div>
      </div>

      <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={lbl}>Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={inp}>
              {['Chaturbate','BongaCams','MyFreeCams','Stripchat','CamSoda','Any'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Toy</label>
            <select value={toy} onChange={e => setToy(e.target.value)} style={inp}>
              {['None','Lush','Domi','Edge','Hush','Interactive'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Mood / Vibe</label>
            <select value={mood} onChange={e => setMood(e.target.value)} style={inp}>
              {[['none','No mood'],['tease','Tease'],['dominant','Dominant'],['submissive','Submissive'],['hype','Hype'],['mystery','Mystery']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>How many</label>
            <select value={count} onChange={e => setCount(parseInt(e.target.value))} style={inp}>
              {[10,12,15,18,20].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={hasGoal} onChange={e => setHasGoal(e.target.checked)} style={{ accentColor: C.cyan }} />
            Include token goal hashtags
          </label>
        </div>

        <button onClick={generate} style={{
          padding: '10px 28px', borderRadius: 9,
          background: 'linear-gradient(135deg, #22D3EE, #EC4899)',
          border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          # Generate Hashtags
        </button>
      </div>

      {hashtags.length > 0 && (
        <div style={{ ...glassCard, borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>
              {hashtags.length} hashtags generated
            </div>
            <button onClick={copyAll} style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(34,211,238,0.3)'}`,
              color: copied ? '#10B981' : C.cyan, cursor: 'pointer',
            }}>
              {copied ? '✓ Copied All!' : '📋 Copy All'}
            </button>
          </div>

          {/* Tag cloud */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {hashtags.map(tag => (
              <button key={tag} onClick={() => copyOne(tag)} style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                background: copiedTag === tag ? 'rgba(16,185,129,0.15)' : 'rgba(124,92,255,0.1)',
                border: `1px solid ${copiedTag === tag ? 'rgba(16,185,129,0.4)' : 'rgba(124,92,255,0.25)'}`,
                color: copiedTag === tag ? '#10B981' : '#A78BFA',
                fontWeight: 500, transition: 'all 0.15s',
              }}>
                {copiedTag === tag ? '✓' : ''}{tag}
              </button>
            ))}
          </div>

          {/* Full text for easy copy-paste */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: C.muted, lineHeight: 1.7, wordBreak: 'break-all' }}>
            {hashtags.join(' ')}
          </div>
        </div>
      )}
    </div>
  )
}


function scoreTitle(title, ctx) {
  let score = 0
  const t = title.toLowerCase()
  // Length: 45-80 chars is ideal
  const len = title.length
  if (len >= 45 && len <= 80)      score += 20
  else if (len >= 30 && len < 45)  score += 12
  else if (len > 80 && len <= 100) score += 10
  else                             score += 4
  // Urgency
  if (/tonight|live now|right now|\d+h left|now or never|this hour|before i|don't miss|limited|starting soon/i.test(t)) score += 25
  else if (/tonight|live|now|only|soon|miss/i.test(t)) score += 14
  else score += 5
  // Token/goal clarity
  if (ctx.tokenGoal && title.includes(String(ctx.tokenGoal))) score += 25
  else if (/\d{2,}/.test(title))   score += 14
  else if (/goal|hit|reach/i.test(t)) score += 8
  // Action/reward clarity
  if (ctx.action && t.includes(ctx.action.toLowerCase())) score += 25
  else if (/tip|control|unlock|react|win|earn|reward/i.test(t)) score += 14
  else score += 5
  // Emoji
  if (/\p{Emoji_Presentation}/u.test(title)) score += 5
  return Math.min(score, 100)
}

// Game-based title generation engine
function buildGameTitles(game, { mood = 'none', tokenGoal = 0, toy = '' }) {
  const ENGINES = {
    'Spin the Wheel': {
      short: 'wheel', verb: 'Spin',
      tags: ['#spinthewheel', '#wheelgame', '#chatdecides', '#interactive', '#live'],
      hooks: ['Spin it and see', 'The wheel is waiting', 'Let the wheel decide', 'Spin for it', 'Chat spins next', 'Wheel goes tonight'],
    },
    'Roll the Dice': {
      short: 'dice', verb: 'Roll',
      tags: ['#rolldice', '#dicegame', '#chatdecides', '#interactive', '#live'],
      hooks: ['Dice decide', 'Roll it. Risk it.', 'Your roll', 'Feeling lucky?', 'Roll for it', 'Dice night'],
    },
    'Truth or Dare': {
      short: 'dare', verb: 'Dare',
      tags: ['#truthordare', '#dare', '#chatdecides', '#interactive', '#live'],
      hooks: ['Truth or dare?', 'I dare you', 'Make me choose', 'Your dare', 'Dare me', 'Come closer'],
    },
  }
  const MOOD_MAP = {
    none: { adj: '', cap: '' }, tease: { adj: 'teasing', cap: 'Teasing' },
    dominant: { adj: 'dominant', cap: 'Dominant' }, submissive: { adj: 'soft', cap: 'Soft' },
    hype: { adj: 'chaotic', cap: 'Chaotic' }, mystery: { adj: 'mysterious', cap: 'Mystery' },
  }
  const g = ENGINES[game]; if (!g) return []
  const m = MOOD_MAP[mood] || MOOD_MAP.none
  const hasMood = mood !== 'none', hasGoal = tokenGoal > 0, hasToy = !!toy
  const toyName = toy ? toy.toLowerCase() : ''
  const results = []; const used = new Set()
  const rand = arr => arr[Math.floor(Math.random() * arr.length)]
  const hook = rand(g.hooks)
  const hook2 = g.hooks.find(h => h !== hook) || g.hooks[0]

  const add = (title, hashtags, why) => {
    if (used.has(title) || title.length > 150 || title.length < 4) return
    used.add(title)
    const len = title.length
    const lengthLabel = len < 45 ? 'Punchy' : len <= 70 ? 'Sweet Spot' : 'Long'
    results.push({ title, charCount: len, lengthLabel, hashtags: hashtags.slice(0, 5), whyItWorks: why })
  }

  // Punchy combos
  if (!hasMood && !hasGoal && !hasToy) {
    add(hook, g.tags, 'Short, curious, and action-based.')
    add(hook2, g.tags, 'Makes the game feel like something viewers can enter.')
  }
  if (hasGoal && !hasMood && !hasToy) {
    add(`Goal unlocks the ${g.short}`, [...g.tags.slice(0,3), '#goal', '#unlock'], 'Clearly connects the goal to the reward.')
    add(`Hit ${tokenGoal}, ${g.short === 'dare' ? 'dare starts' : g.short === 'dice' ? 'dice roll' : `spin the ${g.short}`}`, [...g.tags.slice(0,2), '#goalpush', '#unlock', '#tips'], 'Direct and easy to understand fast.')
  }
  if (hasMood && !hasGoal && !hasToy) {
    add(`${m.cap} ${g.short} night`, [...g.tags.slice(0,2), `#${m.adj}`, '#gamenight', '#live'], 'Gives the room a clear fun event identity.')
    add(`${m.cap} ${g.short === 'dare' ? 'dares' : g.short === 'dice' ? 'rolls' : 'spins'} only`, [...g.tags.slice(0,2), `#${m.adj}`, '#flirtyvibes', '#live'], 'Combines mood and game without getting too long.')
  }
  if (hasToy && !hasMood && !hasGoal) {
    add(`${g.verb} for toy mode`, [...g.tags.slice(0,2), '#toy', '#chatfun', '#live'], 'Makes the game feel directly connected to the toy.')
    add(`${g.short.charAt(0).toUpperCase() + g.short.slice(1)} decides the toy`, [...g.tags.slice(0,2), '#toy', '#tipactivated', '#interactive'], `Makes the ${g.short} outcome feel meaningful.`)
  }
  if (hasGoal && hasMood && !hasToy) {
    add(`${m.cap} ${g.short} goal`, [...g.tags.slice(0,2), `#${m.adj}`, '#goalpush', '#unlock'], 'Short but specific — mood, game, and goal in one.')
    add(`Goal unlocks lucky ${g.short}`, [...g.tags.slice(0,2), '#goal', '#unlock', '#live'], 'Adds mood and payoff in a compact way.')
  }
  if (hasGoal && hasToy && !hasMood) {
    add(`${g.short.charAt(0).toUpperCase() + g.short.slice(1)} unlocks toy mode`, [...g.tags.slice(0,2), '#toy', '#goal', '#unlock'], 'Connects tipping, toy, and game in one hook.')
    add(`Toy ${g.short} round at goal`, [...g.tags.slice(0,2), '#toygoal', '#goalpush', '#interactive'], 'Ties the toy reward directly to the goal.')
  }
  if (hasMood && hasToy && !hasGoal) {
    add(`${m.cap} toy ${g.short}`, [...g.tags.slice(0,2), '#toy', `#${m.adj}`, '#live'], 'Compact, clear, and multi-layered.')
    add(`${m.cap} toy ${g.short === 'dare' ? 'dares' : g.short === 'dice' ? 'rolls' : 'spins'} tonight`, [...g.tags.slice(0,2), '#toy', '#interactive', '#live'], 'Blends vibe, toy, and game in a readable way.')
  }
  if (hasGoal && hasMood && hasToy) {
    add(`${m.cap} toy ${g.short} goal`, [...g.tags.slice(0,2), '#toygoal', '#unlock', '#live'], 'All selected options while staying short.')
    add(`Goal unlocks the ${m.adj} toy ${g.short}`, [...g.tags.slice(0,2), '#goal', '#toy', '#unlock'], 'Clearly shows the reward without overexplaining.')
  }
  if (results.length === 0) {
    add(hook, g.tags, 'Short, curious, and action-based.')
    add(hook2, g.tags, 'Makes the game feel like something viewers can enter.')
  }

  // Sweet Spot combos (45–70 chars)
  if (!hasGoal && !hasMood && !hasToy) {
    add(`Don't just watch — chat decides with the ${g.short}`, [...g.tags.slice(0,3), '#chatgame', '#joinme'], 'Invites participation and makes the game feel viewer-driven.')
    add(`${hook} — next round starts when you tip`, [...g.tags.slice(0,3), '#tips', '#gamenight'], 'Creates a tip incentive tied directly to the game.')
  } else if (hasGoal && !hasMood && !hasToy) {
    add(`Chat decides — ${g.short} unlocks at ${tokenGoal} tokens`, [...g.tags.slice(0,3), '#goal', '#chatdecides'], 'Makes the goal feel tied to a specific rewarding event.')
    add(`${hook} — ${g.short} starts when goal drops`, [...g.tags.slice(0,2), '#goalpush', '#gamenight', '#interactive'], 'Creates a clear before-and-after event.')
  } else if (hasMood && !hasGoal && !hasToy) {
    add(`Feeling ${m.adj} — ${g.short === 'dare' ? 'truth or dare' : `${g.short}s`} decide tonight`, [...g.tags.slice(0,3), '#chatfun', '#interactive'], 'Adds mood and a sense of player control.')
    add(`${m.cap} ${g.short} vibes — chat chooses the next round`, [...g.tags.slice(0,3), '#chatdecides', '#live'], 'Sets a mood and invites the audience in.')
  } else if (hasToy && !hasMood && !hasGoal) {
    add(`${g.short.charAt(0).toUpperCase() + g.short.slice(1)} decides the toy — one tip changes it`, [...g.tags.slice(0,2), '#toy', '#chatcontrol', '#tipactivated'], 'Makes tips feel directly tied to an interactive outcome.')
    add(`Toy activated — ${g.short} decides the next move`, [...g.tags.slice(0,2), '#toy', '#interactive', '#tipactivated'], 'Creates curiosity about what comes next.')
  } else {
    const ctx = [hasMood ? `${m.adj} vibes` : null, hasToy ? `${toyName} on` : null, hasGoal ? `goal: ${tokenGoal}` : null].filter(Boolean)
    add(`${hook} — ${ctx.join(', ')}`, [...g.tags.slice(0,3), hasGoal ? '#unlock' : '#live', hasToy ? '#toy' : '#chatfun'].slice(0,5), 'Stacks all selected inputs in a scannable hook.')
    add(`Chat decides with ${g.short}${hasToy ? ` + ${toyName}` : ''}${hasGoal ? ` — goal: ${tokenGoal}` : ''}`, [...g.tags.slice(0,3), hasGoal ? '#goal' : '#interactive', hasToy ? '#toy' : '#live'].slice(0,5), 'Communicates all features without sounding stuffed.')
  }

  // Long title (only if under 5 results and fits 71–150)
  if (results.length < 5) {
    const longParts = [hook, hasMood ? `${m.adj} energy` : null, hasToy ? `${toyName} activated` : null, hasGoal ? `goal: ${tokenGoal} tokens` : null, `${g.short} decides`].filter(Boolean)
    const longTitle = longParts.join(' — ')
    if (longTitle.length >= 71 && longTitle.length <= 150) add(longTitle, g.tags, "Full description of the room's interactive setup.")
  }
  return results.slice(0, 5)
}

function TitleGenerator({ C, glassCard, analytics, tips, sessions, whales }) {
  const [innerTab,  setInnerTab]  = useState("quick")

  // Quick tab state
  const [qMood,     setQMood]     = useState("none")
  const [qGoal,     setQGoal]     = useState("")
  const [qToy,      setQToy]      = useState("")          // replaces qPlatform
  const [qTitle,    setQTitle]    = useState(null)
  const [qCopied,   setQCopied]   = useState(false)
  const [qCopyAnim, setQCopyAnim] = useState(false)

  // Heart / liked
  const [likedTitles, setLikedTitles] = useState([])
  const [hearts,      setHearts]      = useState([])
  const [qLiked,      setQLiked]      = useState(false)

  // Settings panel
  const [show5Mode,  setShow5Mode]  = useState(false)
  const [showLiked,  setShowLiked]  = useState(false)

  // Advanced tab state
  const [titles,      setTitles]      = useState([])
  const [gameTitles,  setGameTitles]  = useState([])
  const [copied,      setCopied]      = useState(null)
  const [copiedHtags, setCopiedHtags] = useState(null)
  const [likedGame,   setLikedGame]   = useState(new Set())
  const [tokenGoal,   setTokenGoal]   = useState(0)
  const [action,      setAction]      = useState("")
  const [toy,         setToy]         = useState("")
  const [mood,        setMood]        = useState("none")
  const [gameType,    setGameType]    = useState("none")
  const [useEmojis,   setUseEmojis]   = useState(true)

  const buildCtx = (overrides = {}) => {
    const now = new Date()
    const currentHour = now.getHours() // local hour, not UTC
    const todayDay = now.toLocaleDateString("en-US", { weekday: "long" })
    const _analyticsBestHourCtx = analytics?.bestHour || null
    let bestHour = null
    if (_analyticsBestHourCtx) {
      bestHour = parseInt(_analyticsBestHourCtx.hour) // already local from analytics.js toLocalHour
    } else {
      const hourUSD = {}; const hourCount = {}
      ;(sessions || []).forEach(s => {
        const h = new Date(s.startTime).getHours() // local hour
        hourUSD[h] = (hourUSD[h] || 0) + s.totalUSD
        hourCount[h] = (hourCount[h] || 0) + 1
      })
      const bestHourEntry = Object.entries(hourUSD).map(([h, usd]) => [h, usd / (hourCount[h] || 1)]).sort((a,b) => b[1]-a[1])[0]
      bestHour = bestHourEntry ? parseInt(bestHourEntry[0]) : null
    }
    // bestHour is already a local hour — format directly, no offset needed
    const fmtLocalHour = h => h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`
    const bestHourLabel = (bestHour === null || isNaN(bestHour)) ? null : fmtLocalHour(bestHour)
    const hoursUntilPeak = bestHour !== null ? (bestHour - currentHour + 24) % 24 : 99
    const isPeakNow = hoursUntilPeak <= 1
    const peakSoon = hoursUntilPeak <= 3 && !isPeakNow
    const avgSessionUSD = sessions?.length ? sessions.reduce((s,x) => s + x.totalUSD, 0) / sessions.length : 0
    return {
      isPeakNow, peakSoon, bestHour, bestHourLabel, hoursUntilPeak,
      tokenGoal: overrides.tokenGoal !== undefined ? overrides.tokenGoal : tokenGoal,
      action:    overrides.action    !== undefined ? overrides.action    : action,
      toy:       overrides.toy       !== undefined ? overrides.toy       : toy,
      mood:      overrides.mood      !== undefined ? overrides.mood      : mood,
      useEmojis: overrides.useEmojis !== undefined ? overrides.useEmojis : useEmojis,
      avgSessionUSD,
    }
  }

  const generateQuick = () => {
    const ctx = buildCtx({ mood: qMood, tokenGoal: parseInt(qGoal) || 0, action: "", toy: qToy })
    setQTitle(buildOneTitle(ctx))
    setQCopied(false); setQCopyAnim(false); setQLiked(false)
  }

  const copyQuick = () => {
    if (!qTitle) return
    navigator.clipboard.writeText(qTitle.title).catch(() => {})
    setQCopied(true); setQCopyAnim(true)
    setTimeout(() => { setQCopied(false); setQCopyAnim(false) }, 1800)
  }

  const likeQuick = () => {
    if (!qTitle || qLiked) return
    setQLiked(true)
    setLikedTitles(prev => prev.find(t => t.title === qTitle.title) ? prev : [{ title: qTitle.title, drivers: qTitle.drivers, likedAt: Date.now() }, ...prev])
    const newHearts = Array.from({ length: 6 }, (_, i) => ({ id: Date.now() + i, x: 30 + Math.random() * 40, delay: i * 80 }))
    setHearts(h => [...h, ...newHearts])
    setTimeout(() => setHearts(h => h.filter(hh => !newHearts.find(n => n.id === hh.id))), 1600)
  }

  const generateAdvanced = useCallback(() => {
    if (gameType !== "none") {
      setGameTitles(buildGameTitles(gameType, { mood, tokenGoal, toy }))
      setCopied(null); setCopiedHtags(null)
      return
    }
    const ctx = buildCtx()
    const results = []
    let attempts = 0
    while (results.length < 5 && attempts < 25) {
      const { title, drivers } = buildOneTitle(ctx)
      if (!results.find(r => r.title === title)) results.push({ title, drivers, score: scoreTitle(title, ctx) })
      attempts++
    }
    results.sort((a, b) => b.score - a.score)
    setTitles(results); setCopied(null)
  }, [tokenGoal, action, toy, mood, gameType, useEmojis, analytics, tips, sessions, whales])

  const copyGameTitle = (title, i) => {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(i); setTimeout(() => setCopied(null), 1800)
  }
  const copyGameHashtags = (tags, i) => {
    navigator.clipboard.writeText(tags.join(' ')).catch(() => {})
    setCopiedHtags(i); setTimeout(() => setCopiedHtags(null), 1800)
  }
  const copyGameBoth = (title, tags) => {
    navigator.clipboard.writeText(`${title}\n${tags.join(' ')}`).catch(() => {})
  }
  const likeGameTitle = (title, i) => {
    setLikedGame(prev => { const next = new Set(prev); next.add(i); return next })
    setLikedTitles(prev => prev.find(t => t.title === title) ? prev : [{ title, drivers: [], likedAt: Date.now() }, ...prev])
    const newHearts = Array.from({ length: 4 }, (_, j) => ({ id: Date.now() + j, x: 20 + Math.random() * 60, delay: j * 100 }))
    setHearts(h => [...h, ...newHearts])
    setTimeout(() => setHearts(h => h.filter(hh => !newHearts.find(n => n.id === hh.id))), 1600)
  }
  const copyAdv = (title, i) => {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(i); setTimeout(() => setCopied(null), 1800)
  }

  // Stats chips — peak timing (data) + static stats
  const ctx0 = buildCtx()
  const chips = []
  if (ctx0.isPeakNow && ctx0.bestHourLabel)     chips.push({ label: `🔴 Peak NOW (${ctx0.bestHourLabel})`, color: C.orange })
  else if (ctx0.peakSoon && ctx0.bestHourLabel) chips.push({ label: `⏳ Peak in ${ctx0.hoursUntilPeak}h (${ctx0.bestHourLabel})`, color: C.gold })
  chips.push({ label: `✍️ 3,000+ titles generated`, color: C.cyan })
  chips.push({ label: `📈 ~30% more tips rotating titles`, color: C.green })

  const optStyle = { background: "#1a1f2e", color: "#f0f2f6" }
  const inp = {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    padding: "8px 10px", borderRadius: 9, color: C.white, outline: "none",
    fontSize: 13, boxSizing: "border-box", width: "100%",
  }
  const lbl = { fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }
  const tabBtn = (id) => ({
    padding: "7px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
    background: innerTab === id ? "rgba(255,255,255,0.07)" : "transparent",
    color: innerTab === id ? C.white : C.muted,
    borderBottom: innerTab === id ? `2px solid ${C.pink}` : "2px solid transparent",
  })

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 32, height: 18, borderRadius: 9, cursor: "pointer", position: "relative", flexShrink: 0, background: on ? C.pink : "rgba(255,255,255,0.12)", transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 3, left: on ? 16 : 3, width: 12, height: 12, borderRadius: "50%", background: C.white, transition: "left 0.2s" }} />
    </div>
  )

  const lenColor = (label) => label === 'Punchy' ? C.green : label === 'Sweet Spot' ? C.gold : C.orange

  return (
    <div style={{ paddingTop: 0 }}>
      <style>{`
        @keyframes floatHeart { 0% { transform: translateY(0) scale(1); opacity: 1; } 60% { opacity: 1; } 100% { transform: translateY(-80px) scale(1.4); opacity: 0; } }
        @keyframes copyPop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @keyframes heartPop { 0% { transform: scale(1); } 30% { transform: scale(1.35); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }
      `}</style>

      {/* HEADER + SETTINGS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>🎬 Room Title Generator</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 600, color: c.color, padding: "2px 8px", borderRadius: 20, background: `${c.color}12`, border: `1px solid ${c.color}24` }}>{c.label}</span>
            ))}
          </div>
        </div>
        <div style={{ flexShrink: 0, minWidth: 160, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Settings</div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.text }}>Generate 5 titles</span>
            <Toggle on={show5Mode} onToggle={() => setShow5Mode(v => !v)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ fontSize: 11, color: C.text }}>Liked ({likedTitles.length})</span>
            <Toggle on={showLiked} onToggle={() => setShowLiked(v => !v)} />
          </label>
        </div>
      </div>

      {/* LIKED TITLES PANEL */}
      {showLiked && (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.18)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.pink, marginBottom: 6 }}>❤️ Liked Titles</div>
          {likedTitles.length === 0 ? (
            <div style={{ fontSize: 11, color: C.muted }}>No liked titles yet — hit ❤️ on any title to save it.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {likedTitles.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ flex: 1, fontSize: 12, color: C.white, lineHeight: 1.4 }}>{t.title}</div>
                  <button onClick={() => navigator.clipboard.writeText(t.title).catch(() => {})} style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted }}>📋</button>
                  <button onClick={() => setLikedTitles(prev => prev.filter((_, j) => j !== i))} style={{ flexShrink: 0, padding: "4px 7px", borderRadius: 6, fontSize: 10, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#ef4444" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB BAR */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
        <button style={tabBtn("quick")}    onClick={() => setInnerTab("quick")}>⚡ Quick</button>
        <button style={tabBtn("advanced")} onClick={() => setInnerTab("advanced")}>⚙️ Advanced</button>
        <button style={tabBtn("hashtags")} onClick={() => setInnerTab("hashtags")}># Hashtags</button>
      </div>

      {/* ── QUICK TAB ── */}
      {innerTab === "quick" && (
        <div>
          {/* 3 controls: Mood | Goal | Toy */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={lbl}>Mood</div>
              <select value={qMood} onChange={e => setQMood(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="none" style={optStyle}>Auto</option>
                <option value="tease" style={optStyle}>Tease</option>
                <option value="dominant" style={optStyle}>Dominant</option>
                <option value="submissive" style={optStyle}>Submissive</option>
                <option value="hype" style={optStyle}>Hype</option>
                <option value="mystery" style={optStyle}>Mystery</option>
              </select>
            </div>
            <div>
              <div style={lbl}>Token goal</div>
              <input type="number" value={qGoal} onChange={e => setQGoal(e.target.value)} style={inp} placeholder="e.g. 500" />
            </div>
            <div>
              <div style={lbl}>Toy</div>
              <select value={qToy} onChange={e => setQToy(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="" style={optStyle}>No toy</option>
                <option value="Lush" style={optStyle}>Lush</option>
                <option value="Domi" style={optStyle}>Domi</option>
                <option value="Edge" style={optStyle}>Edge</option>
                <option value="Hush" style={optStyle}>Hush</option>
                <option value="interactive toy" style={optStyle}>Interactive</option>
              </select>
            </div>
          </div>

          <Button onClick={generateQuick} style={{ width: "100%", marginBottom: 10 }}>
            ✨ Generate Title →
          </Button>

          {/* OUTPUT — above fold */}
          {qTitle ? (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", pointerEvents: "none", overflow: "hidden" }}>
                {hearts.map(h => (
                  <div key={h.id} style={{ position: "absolute", bottom: 20, left: `${h.x}%`, fontSize: 20, animation: `floatHeart 1.4s ease-out ${h.delay}ms forwards` }}>❤️</div>
                ))}
              </div>
              <div style={{ ...glassCard, borderRadius: 12, padding: "14px 14px", border: "1px solid rgba(236,72,153,0.28)", background: "linear-gradient(135deg, rgba(236,72,153,0.07), rgba(124,92,255,0.07))" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Generated Title</div>
                  <div style={{ fontSize: 9, color: lenColor(qTitle.lengthLabel || 'Punchy'), fontWeight: 700 }}>
                    {qTitle.title.length} chars · {qTitle.lengthLabel || (qTitle.title.length < 45 ? 'Punchy' : qTitle.title.length <= 70 ? 'Sweet Spot' : 'Long')}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.white, lineHeight: 1.4, marginBottom: 10 }}>{qTitle.title}</div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(qTitle.drivers || []).map((d, i) => (
                      <span key={i} style={{ fontSize: 9, color: C.cyan, padding: "2px 6px", borderRadius: 20, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)" }}>{d}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={generateQuick} style={{ padding: "6px 11px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted }}>↻</button>
                    <button onClick={copyQuick} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: qCopied ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #22D3EE, #EC4899)", border: qCopied ? "1px solid rgba(16,185,129,0.4)" : "none", color: C.white, animation: qCopyAnim ? "copyPop 0.3s ease" : "none" }}>
                      {qCopied ? "✔ Copied!" : "📋 Copy"}
                    </button>
                    <button onClick={likeQuick} style={{ padding: "6px 11px", borderRadius: 8, fontSize: 14, cursor: qLiked ? "default" : "pointer", background: qLiked ? "rgba(236,72,153,0.18)" : "rgba(255,255,255,0.06)", border: `1px solid ${qLiked ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.12)"}`, animation: qLiked ? "heartPop 0.4s ease" : "none", opacity: qLiked ? 0.8 : 1 }}>
                      {qLiked ? "❤️" : "🤍"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "22px 20px", color: C.muted, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 24, marginBottom: 5 }}>🎬</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Your title will appear here</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>Pick a mood and hit Generate</div>
            </div>
          )}

          {/* 5-title mode when toggled */}
          {show5Mode && (
            <div style={{ marginTop: 14 }}>
              <Button onClick={generateAdvanced} style={{ width: "100%", padding: "10px 0", fontSize: 13, marginBottom: 10 }}>✨ Generate 5 Titles</Button>
              {titles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {titles.map((t, i) => {
                    const scoreColor = t.score >= 85 ? C.green : t.score >= 70 ? C.gold : C.orange
                    const tLen = t.title.length
                    const tLabel = tLen < 45 ? 'Punchy' : tLen <= 70 ? 'Sweet Spot' : 'Long'
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, background: copied === i ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${copied === i ? "rgba(16,185,129,0.28)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.18s" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: copied === i ? C.green : C.white, lineHeight: 1.4, wordBreak: "break-word", marginBottom: 2 }}>{t.title}</div>
                          <div style={{ fontSize: 9, color: lenColor(tLabel) }}>{tLen} chars · {tLabel}</div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0, minWidth: 36 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor }}>{t.score}</div>
                          <div style={{ fontSize: 8, color: C.muted }}>/100</div>
                        </div>
                        <button onClick={() => copyAdv(t.title, i)} style={{ flexShrink: 0, padding: "6px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", background: copied === i ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied === i ? "rgba(16,185,129,0.38)" : "rgba(255,255,255,0.1)"}`, color: copied === i ? C.green : C.muted }}>
                          {copied === i ? "✓" : "📋"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIRAL FORMULA — below fold, always there */}
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6366F1", marginBottom: 6 }}>⚡ Viral Room Title Formula</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 10 }}>Hook + Control + Urgency</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Hook', desc: 'Makes them stop scrolling', examples: ['"Don\'t just watch"', '"Only if you can keep up"', '"Feeling dangerous"', '"Your move"'] },
                { label: 'Control', desc: 'Makes them feel involved', examples: ['"chat decides"', '"spin the wheel"', '"roll the dice"', '"one tip changes it"'] },
                { label: 'Urgency', desc: 'Reason to click now', examples: ['"almost unlocked"', '"goal is close"', '"wheel is waiting"', '"tonight only"'] },
              ].map((col, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", marginBottom: 4 }}>{col.label}</div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{col.desc}</div>
                  {col.examples.map((ex, j) => (
                    <div key={j} style={{ fontSize: 10, color: C.text, marginBottom: 2 }}>{ex}</div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                '"Don\'t just watch — chat decides tonight"',
                '"Spin it and see — goal is almost unlocked"',
                '"Your move — dice decide the next round"',
                '"Only if you can keep up — wheel starts at goal"',
              ].map((ex, i) => (
                <div key={i} style={{ fontSize: 11, color: C.textMid || C.text, padding: "5px 8px", borderRadius: 7, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", fontStyle: "italic" }}>{ex}</div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
              💡 <strong style={{ color: C.text }}>Rotate your title every 20–30 min</strong> — platforms rank active streams higher on the top page when titles change frequently.
            </div>
          </div>
        </div>
      )}

      {/* ── ADVANCED TAB ── */}
      {innerTab === "advanced" && (
        <div>
          {/* Row 1: Goal | Reward | Mood */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={lbl}>Token goal</div>
              <input type="number" value={tokenGoal || ""} onChange={e => setTokenGoal(Number(e.target.value) || 0)} style={inp} placeholder="e.g. 500" />
            </div>
            <div>
              <div style={lbl}>Reward</div>
              <input value={action} onChange={e => setAction(e.target.value)} style={inp} placeholder="flash, strip…" />
            </div>
            <div>
              <div style={lbl}>Mood</div>
              <select value={mood} onChange={e => setMood(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="none" style={optStyle}>Auto</option>
                <option value="tease" style={optStyle}>Tease</option>
                <option value="dominant" style={optStyle}>Dominant</option>
                <option value="submissive" style={optStyle}>Submissive</option>
                <option value="hype" style={optStyle}>Hype</option>
                <option value="mystery" style={optStyle}>Mystery</option>
              </select>
            </div>
          </div>
          {/* Row 2: Toy | Game/Event | Emojis */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <div style={lbl}>Toy</div>
              <select value={toy} onChange={e => setToy(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="" style={optStyle}>No toy</option>
                <option value="Lush" style={optStyle}>Lush</option>
                <option value="Domi" style={optStyle}>Domi</option>
                <option value="Edge" style={optStyle}>Edge</option>
                <option value="Hush" style={optStyle}>Hush</option>
                <option value="interactive toy" style={optStyle}>Interactive</option>
              </select>
            </div>
            <div>
              <div style={lbl}>Game / Event</div>
              <select value={gameType} onChange={e => { setGameType(e.target.value); setGameTitles([]) }} style={{ ...inp, cursor: "pointer" }}>
                <option value="none" style={optStyle}>None</option>
                <option value="Spin the Wheel" style={optStyle}>Spin the Wheel</option>
                <option value="Roll the Dice" style={optStyle}>Roll the Dice</option>
                <option value="Truth or Dare" style={optStyle}>Truth or Dare</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: C.text }}>
                <input type="checkbox" checked={useEmojis} onChange={() => setUseEmojis(v => !v)} style={{ accentColor: C.pink }} />
                Include emojis
              </label>
            </div>
          </div>

          <Button onClick={generateAdvanced} style={{ width: "100%", padding: "11px 0", marginBottom: 12 }}>
            {gameType !== "none" ? `🎲 Generate ${gameType} Titles` : "✨ Generate 5 Titles"}
          </Button>

          {/* GAME TITLES OUTPUT */}
          {gameType !== "none" && gameTitles.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                {gameType}{toy ? ` + ${toy}` : ''}{tokenGoal > 0 ? ` + Goal: ${tokenGoal}` : ''}{mood !== 'none' ? ` + ${mood.charAt(0).toUpperCase() + mood.slice(1)}` : ''}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                {gameTitles.map((t, i) => (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Title + char info */}
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.white, lineHeight: 1.45, marginBottom: 4 }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: lenColor(t.lengthLabel), fontWeight: 700 }}>{t.charCount} chars · {t.lengthLabel}</span>
                      <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>"{t.whyItWorks}"</span>
                    </div>
                    {/* Hashtags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {t.hashtags.map((tag, j) => (
                        <span key={j} style={{ fontSize: 10, color: "#6366F1", padding: "2px 6px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>{tag}</span>
                      ))}
                    </div>
                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => copyGameTitle(t.title, i)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: copied === i ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied === i ? "rgba(16,185,129,0.38)" : "rgba(255,255,255,0.12)"}`, color: copied === i ? C.green : C.muted }}>
                        {copied === i ? "✓ Copied" : "📋 Copy Title"}
                      </button>
                      <button onClick={() => copyGameHashtags(t.hashtags, i)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: copiedHtags === i ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${copiedHtags === i ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.12)"}`, color: copiedHtags === i ? "#6366F1" : C.muted }}>
                        {copiedHtags === i ? "✓ Copied" : "# Copy Tags"}
                      </button>
                      <button onClick={() => copyGameBoth(t.title, t.hashtags)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted }}>
                        📋 Copy Both
                      </button>
                      <button onClick={() => likeGameTitle(t.title, i)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: likedGame.has(i) ? "default" : "pointer", background: likedGame.has(i) ? "rgba(236,72,153,0.18)" : "rgba(255,255,255,0.07)", border: `1px solid ${likedGame.has(i) ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.12)"}`, animation: likedGame.has(i) ? "heartPop 0.4s ease" : "none" }}>
                        {likedGame.has(i) ? "❤️" : "🤍"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Floating hearts for game likes */}
              <div style={{ position: "relative", height: 0, overflow: "visible", pointerEvents: "none" }}>
                {hearts.map(h => (
                  <div key={h.id} style={{ position: "absolute", bottom: 0, left: `${h.x}%`, fontSize: 18, animation: `floatHeart 1.4s ease-out ${h.delay}ms forwards` }}>❤️</div>
                ))}
              </div>
            </div>
          )}

          {/* REGULAR 5-TITLE OUTPUT (when no game selected) */}
          {gameType === "none" && titles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
              {titles.map((t, i) => {
                const scoreColor = t.score >= 85 ? C.green : t.score >= 70 ? C.gold : C.orange
                const tLen = t.title.length
                const tLabel = tLen < 45 ? 'Punchy' : tLen <= 70 ? 'Sweet Spot' : 'Long'
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, background: copied === i ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${copied === i ? "rgba(16,185,129,0.28)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.18s" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: copied === i ? C.green : C.white, lineHeight: 1.4, wordBreak: "break-word", marginBottom: 2 }}>{t.title}</div>
                      <div style={{ fontSize: 9, color: lenColor(tLabel) }}>{tLen} chars · {tLabel}</div>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 36 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor }}>{t.score}</div>
                      <div style={{ fontSize: 8, color: C.muted }}>/100</div>
                    </div>
                    <button onClick={() => copyAdv(t.title, i)} style={{ flexShrink: 0, padding: "6px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", background: copied === i ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied === i ? "rgba(16,185,129,0.38)" : "rgba(255,255,255,0.1)"}`, color: copied === i ? C.green : C.muted }}>
                      {copied === i ? "✓" : "📋"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 9 }}>
            <div style={{ fontSize: 11, color: C.gold }}>💡 Rotate your title every 20–30 min — platforms rank active streams higher on the top page when titles change frequently.</div>
          </div>
        </div>
      )}

      {/* ── HASHTAGS TAB ── */}
      {innerTab === "hashtags" && (
        <HashtagGenerator C={C} glassCard={glassCard} defaultPlatform="Chaturbate" />
      )}
    </div>
  )
}


export default TitleGenerator
