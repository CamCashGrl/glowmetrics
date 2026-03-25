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
