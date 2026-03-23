"use client"
import { useState, useEffect } from "react"

// ============================================
// ELITE PRO GENERATOR (MONETIZABLE)
// ============================================

const STORAGE_KEY = "ccg_saved_titles_v2"

function scoreTitle(title) {
  let score = 0
  if (title.toLowerCase().includes("control")) score += 2
  if (title.toLowerCase().includes("tip")) score += 2
  if (title.toLowerCase().includes("tokens")) score += 2
  if (title.length < 90) score += 1
  if (/🔥|💦|😈|👑/.test(title)) score += 1
  return score
}

function buildTitles({ tokensEnabled, tokenGoal, action, interactive, toy, game, emojis }) {
  const base = [
    "Control Me",
    "You Run The Show",
    "Make Me Lose Control",
    "Tip To Vibe",
    "You Control Everything",
    "Push Me Further",
    "Let’s Get Naughty",
    "VIP Energy Only",
    "Top Tipper Gets Me",
    "Make Me React"
  ]

  const inter = [
    "Tip to Vibrate",
    "You Control My Toy",
    "Interactive ON",
    "Tip = Reaction",
    "Make Me Lose Control"
  ]

  const emojiSet = emojis ? ["🔥","💦","😈","💗","⚡","🎮","👑"] : [""]

  const results = []

  while (results.length < 25) {
    const e = emojiSet[Math.floor(Math.random() * emojiSet.length)]
    const b = base[Math.floor(Math.random() * base.length)]
    const i = interactive ? inter[Math.floor(Math.random() * inter.length)] : ""

    const goal = tokensEnabled && tokenGoal
      ? `Hit ${tokenGoal} tokens${action ? ` → ${action}` : ""}`
      : ""

    const extra = [toy, game].filter(Boolean).join(" • ")

    let title = [b, i, goal, extra].filter(Boolean).join(" • ")
    if (emojis && e) title += ` ${e}`

    if (!results.includes(title)) results.push(title)
  }

  return results.map(t => ({ text: t, score: scoreTitle(t) }))
}

export default function TitleGeneratorUI() {
  const [titles, setTitles] = useState([])
  const [selected, setSelected] = useState(null)
  const [saved, setSaved] = useState([])
  const [hashtags, setHashtags] = useState([])

  const [tokensEnabled, setTokensEnabled] = useState(false)
  const [tokenGoal, setTokenGoal] = useState(500)
  const [action, setAction] = useState("")
  const [interactive, setInteractive] = useState(false)
  const [toy, setToy] = useState("")
  const [game, setGame] = useState("")
  const [emojis, setEmojis] = useState(true)

  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) setSaved(JSON.parse(data))
  }, [])

  function persist(list) {
    setSaved(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  function generate() {
    const data = buildTitles({ tokensEnabled, tokenGoal, action, interactive, toy, game, emojis })
    setTitles(data.sort((a,b)=>b.score-a.score))
    setSelected(null)
    setHashtags([])
  }

  function regenerate() {
    generate()
  }

  function saveTitle(t) {
    if (saved.find(s => s.text === t.text)) return
    persist([{...t, used:0}, ...saved].slice(0,50))
  }

  function markUsed(t) {
    const updated = saved.map(s => s.text === t.text ? {...s, used:(s.used||0)+1} : s)
    persist(updated)
  }

  function generateHashtags() {
    if (!selected) return
    const base = ["#camgirl","#livecam","#tipmenu"]
    const extra = selected.text.includes("Control")
      ? ["#controlme","#tiptovibe","#lovense"]
      : ["#sexy","#flirty"]
    setHashtags([...base,...extra])
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">🔥 Elite AI Title Generator</h1>

      {/* INPUTS */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <label><input type="checkbox" checked={tokensEnabled} onChange={()=>setTokensEnabled(!tokensEnabled)} /> Token Goal</label>
        {tokensEnabled && (
          <>
            <input type="number" value={tokenGoal} onChange={e=>setTokenGoal(e.target.value)} className="bg-white/10 p-2 rounded" />
            <input value={action} onChange={e=>setAction(e.target.value)} placeholder="Action" className="bg-white/10 p-2 rounded" />
          </>
        )}

        <label><input type="checkbox" checked={interactive} onChange={()=>setInteractive(!interactive)} /> Interactive</label>
        {interactive && (
          <>
            <input value={toy} onChange={e=>setToy(e.target.value)} placeholder="Toy" className="bg-white/10 p-2 rounded" />
            <input value={game} onChange={e=>setGame(e.target.value)} placeholder="Game" className="bg-white/10 p-2 rounded" />
          </>
        )}

        <label><input type="checkbox" checked={emojis} onChange={()=>setEmojis(!emojis)} /> Emojis</label>
      </div>

      {/* BUTTONS */}
      <div className="flex gap-3 mb-6">
        <button onClick={generate} className="bg-pink-500 px-4 py-2 rounded">Generate</button>
        <button onClick={regenerate} className="bg-purple-500 px-4 py-2 rounded">Regenerate</button>
      </div>

      {/* TITLES */}
      <div className="grid gap-2">
        {titles.map((t,i)=>(
          <div key={i} onClick={()=>setSelected(t)} className={`p-3 rounded cursor-pointer border ${selected?.text===t.text?"border-pink-500 bg-pink-500/20":"border-white/10"}`}>
            <div className="flex justify-between">
              <span>{t.text}</span>
              <div className="flex gap-2">
                <span className="text-xs opacity-60">Score: {t.score}</span>
                <button onClick={(e)=>{e.stopPropagation();saveTitle(t)}} className="text-xs">💾</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SELECTED */}
      {selected && (
        <div className="mt-6">
          <p className="text-pink-400">{selected.text}</p>
          <button onClick={()=>{markUsed(selected);generateHashtags()}} className="mt-2 bg-blue-500 px-3 py-2 rounded">Use + Hashtags</button>
        </div>
      )}

      {/* HASHTAGS */}
      {hashtags.length>0 && (
        <div className="mt-4 text-blue-300">{hashtags.join(" ")}</div>
      )}

      {/* SAVED PERFORMANCE */}
      {saved.length>0 && (
        <div className="mt-10">
          <h2 className="text-lg mb-2">🏆 Top Performing Titles</h2>
          {saved.sort((a,b)=>(b.used||0)-(a.used||0)).map((s,i)=>(
            <div key={i} className="bg-white/5 p-2 rounded flex justify-between">
              <span>{s.text}</span>
              <span className="text-xs">Used: {s.used||0}</span>
            </div>
          ))}
        </div>
      )}

      {/* INSIGHT */}
      <div className="mt-8 p-4 bg-yellow-500/10 rounded text-sm">
        💡 Refreshing your title every 20–30 minutes increases ranking frequency and visibility by ~30–50%.
      </div>
    </div>
  )
}
