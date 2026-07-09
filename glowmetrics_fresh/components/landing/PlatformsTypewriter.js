"use client"
import { useEffect, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────
// PlatformsTypewriter — PURE MARKETING VISUAL for the landing page.
//
// Types out "Platforms we support" followed by each supported platform
// name, one letter at a time, building up a row of chips. Platform names
// mirror the list already used in the "What is CamCash?" section of
// app/landing/LandingClient.js ("Built for" row) — MOCK/DEMO presentation
// only, no live integration status or real per-platform data implied.
// ─────────────────────────────────────────────────────────────────────────

const T = {
  cyan: "#16F4FF",
  cyanSoft: "#48E9FF",
  purple: "#7C5CFF",
  pink: "#FF2BAE",
  gold: "#FFC857",
  textFaint: "#5E647C",
}

// MOCK/DEMO DATA — display order + accent color per chip, purely visual.
const PLATFORMS = [
  { name: "Chaturbate", color: T.cyan },
  { name: "BongaCams", color: T.pink },
  { name: "MyFreeCams", color: T.gold },
  { name: "CamSoda", color: T.purple },
  { name: "Stripchat", color: T.cyanSoft },
]

const TYPE_MS = 55
const CHIP_PAUSE_MS = 500
const LOOP_PAUSE_MS = 2400

export default function PlatformsTypewriter() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [platformIdx, setPlatformIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [completed, setCompleted] = useState([])

  useEffect(() => {
    setReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const current = PLATFORMS[platformIdx]
    if (!current) return
    if (charIdx < current.name.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), TYPE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setCompleted(prev => [...prev, platformIdx])
      setCharIdx(0)
      setPlatformIdx(i => i + 1)
    }, CHIP_PAUSE_MS)
    return () => clearTimeout(t)
  }, [charIdx, platformIdx, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    if (platformIdx < PLATFORMS.length) return
    const t = setTimeout(() => {
      setCompleted([])
      setPlatformIdx(0)
      setCharIdx(0)
    }, LOOP_PAUSE_MS)
    return () => clearTimeout(t)
  }, [platformIdx, reducedMotion])

  const activePlatform = PLATFORMS[platformIdx]
  const showTyping = !reducedMotion && activePlatform

  return (
    <div className="cc-ptw-wrap">
      <div className="cc-ptw-label">Platforms we support</div>
      <div className="cc-ptw-row">
        {reducedMotion
          ? PLATFORMS.map(p => (
              <span key={p.name} className="cc-ptw-chip" style={{ borderColor: `${p.color}55`, color: p.color }}>
                {p.name}
              </span>
            ))
          : (
            <>
              {completed.map(i => (
                <span key={PLATFORMS[i].name} className="cc-ptw-chip" style={{ borderColor: `${PLATFORMS[i].color}55`, color: PLATFORMS[i].color }}>
                  {PLATFORMS[i].name}
                </span>
              ))}
              {showTyping && (
                <span className="cc-ptw-chip cc-ptw-chip-typing" style={{ borderColor: `${activePlatform.color}55`, color: activePlatform.color }}>
                  {activePlatform.name.slice(0, charIdx)}
                  <span className="cc-ptw-cursor" style={{ background: activePlatform.color }} />
                </span>
              )}
            </>
          )}
      </div>

      <style jsx>{`
        .cc-ptw-wrap {
          text-align: center;
        }

        .cc-ptw-label {
          font-size: 10px;
          font-weight: 700;
          color: ${T.textFaint};
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 14px;
        }

        .cc-ptw-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          min-height: 32px;
        }

        .cc-ptw-chip {
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid;
          background: rgba(255,255,255,0.03);
          white-space: nowrap;
        }

        .cc-ptw-chip-typing {
          min-width: 1px;
        }

        .cc-ptw-cursor {
          display: inline-block;
          width: 2px;
          height: 13px;
          margin-left: 2px;
          animation: cc-ptw-blink 0.9s step-end infinite;
        }

        @keyframes cc-ptw-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
