"use client"
import { useState } from "react"
import { PLATFORM_TOKEN_RATES, PLATFORM_VIEWER_RATES } from "../../lib/constants"

const PLATFORMS = Object.keys(PLATFORM_TOKEN_RATES)
const TOKEN_PRESETS = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const EARNINGS_PRESETS = [5, 10, 25, 50, 100, 250, 500]

export default function TokenCalculatorPanel({ C, glassCard }) {
  const [mode, setMode] = useState("tokens") // "tokens" | "earnings"
  const [platform, setPlatform] = useState("Chaturbate")
  const [useCustom, setUseCustom] = useState(false)
  const [customRate, setCustomRate] = useState("")
  const [tokenInput, setTokenInput] = useState("")
  const [earningsInput, setEarningsInput] = useState("")
  const [copied, setCopied] = useState(false)

  const rate = useCustom ? (parseFloat(customRate) || 0) : PLATFORM_TOKEN_RATES[platform]
  const viewer = useCustom ? null : PLATFORM_VIEWER_RATES[platform]

  const rawInput = mode === "tokens" ? tokenInput : earningsInput
  const hasInput = rawInput.trim() !== ""
  const numInput = parseFloat(rawInput)
  const isValid = hasInput && !isNaN(numInput) && numInput > 0 && rate > 0

  let primaryLabel, primaryValue, secondaryLabel, secondaryValue
  if (mode === "tokens") {
    primaryLabel = "You earn"
    primaryValue = isValid ? `$${(numInput * rate).toFixed(2)}` : null
    secondaryLabel = "Viewer spends"
    secondaryValue = isValid && viewer != null ? `$${(numInput * viewer).toFixed(2)}` : null
  } else {
    const tokensNeeded = isValid ? Math.ceil(numInput / rate) : 0
    primaryLabel = "Tokens needed"
    primaryValue = isValid ? `${tokensNeeded.toLocaleString()} tokens` : null
    secondaryLabel = "Estimated viewer spend"
    secondaryValue = isValid && viewer != null ? `$${(tokensNeeded * viewer).toFixed(2)}` : null
  }

  function setInput(v) {
    if (mode === "tokens") setTokenInput(v)
    else setEarningsInput(v)
  }

  function handleCopy() {
    if (!primaryValue) return
    navigator.clipboard?.writeText(`${primaryLabel}: ${primaryValue}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleClear() {
    setTokenInput("")
    setEarningsInput("")
  }

  const segBtn = (active) => ({
    padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none",
    cursor: "pointer", transition: "all .15s",
    background: active ? "linear-gradient(90deg,#22D3EE,#EC4899)" : "transparent",
    color: active ? "#06101A" : C.text,
  })

  const platformChip = (active) => ({
    padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: active ? "1px solid rgba(34,211,238,0.5)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.03)",
    color: active ? C.cyan : C.text,
  })

  const presetChip = (active) => ({
    padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    border: active ? "1px solid rgba(236,72,153,0.5)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(236,72,153,0.14)" : "rgba(255,255,255,0.03)",
    color: active ? C.pink : C.text,
  })

  return (
    <div style={{ ...glassCard, borderRadius: 18, padding: "24px 28px" }}>
      {/* Conversion toggle */}
      <div role="tablist" aria-label="Conversion direction" style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 22 }}>
        <button role="tab" aria-selected={mode === "tokens"} onClick={() => setMode("tokens")} style={segBtn(mode === "tokens")}>Tokens → Earnings</button>
        <button role="tab" aria-selected={mode === "earnings"} onClick={() => setMode("earnings")} style={segBtn(mode === "earnings")}>Earnings → Tokens</button>
      </div>

      {/* Platform selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Platform</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLATFORMS.map(p => (
            <button key={p} type="button" aria-pressed={platform === p && !useCustom}
              onClick={() => { setPlatform(p); setUseCustom(false) }}
              style={platformChip(platform === p && !useCustom)}>{p}</button>
          ))}
        </div>
        <button type="button" onClick={() => setUseCustom(v => !v)}
          style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontSize: 12, color: C.cyan, cursor: "pointer", textDecoration: "underline" }}>
          {useCustom ? "Use platform rate instead" : "Use custom rate"}
        </button>
        {useCustom && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>$</span>
            <input
              type="number" step="0.001" min="0"
              value={customRate}
              onChange={e => setCustomRate(e.target.value)}
              placeholder="0.050"
              aria-label="Custom rate per token"
              style={{ width: 110, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: C.white, fontSize: 13, outline: "none" }}
            />
            <span style={{ fontSize: 12, color: C.muted }}>/token</span>
          </div>
        )}
      </div>

      {/* Rate info row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {useCustom ? (
          <span>Custom rate: <strong style={{ color: C.gold }}>${(rate || 0).toFixed(4)}/token</strong></span>
        ) : (
          <>
            <span>Broadcaster rate: <strong style={{ color: C.gold }}>${rate.toFixed(4)}/token</strong></span>
            <span style={{ color: C.muted }}>·</span>
            <span>Viewer pays: <strong style={{ color: C.white }}>${viewer.toFixed(2)}/token</strong></span>
          </>
        )}
        <span
          title="Broadcaster rate is what the creator earns per token. Viewer cost is what the viewer pays per token and may vary by package."
          aria-label="Rate info"
          style={{ marginLeft: "auto", cursor: "help", color: C.muted, fontSize: 13 }}
        >ⓘ</span>
      </div>

      {/* Input */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="calc-amount-input" style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
          {mode === "tokens" ? "Token amount" : "Target earnings"}
        </label>
        <input
          id="calc-amount-input"
          type="number" min="0"
          value={rawInput}
          onChange={e => setInput(e.target.value)}
          placeholder={mode === "tokens" ? "Enter token amount" : "Enter dollar amount"}
          style={{
            width: "100%", height: 56, padding: "0 16px", borderRadius: 12, fontSize: 18, fontWeight: 700,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${hasInput && !isValid ? C.red : "rgba(255,255,255,0.12)"}`,
            color: C.white, outline: "none", boxSizing: "border-box",
          }}
        />
        {hasInput && !isValid && (
          <div role="alert" style={{ fontSize: 12, color: C.red, marginTop: 6 }}>Enter a valid positive number.</div>
        )}
      </div>

      {/* Presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
        {(mode === "tokens" ? TOKEN_PRESETS : EARNINGS_PRESETS).map(v => {
          const label = mode === "tokens" ? v.toLocaleString() : `$${v}`
          const active = parseFloat(rawInput) === v
          return (
            <button key={v} type="button" aria-pressed={active} onClick={() => setInput(String(v))} style={presetChip(active)}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Results */}
      <div aria-live="polite" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20 }}>
        {!hasInput ? (
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "18px 0" }}>Enter an amount to calculate.</div>
        ) : isValid ? (
          <div className="calc-results" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{primaryLabel}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.green, lineHeight: 1 }}>{primaryValue}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{secondaryLabel}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                {secondaryValue ?? "Viewer cost varies or is unavailable for this platform."}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        <button
          onClick={handleCopy}
          disabled={!isValid}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none",
            cursor: isValid ? "pointer" : "not-allowed",
            background: isValid ? "linear-gradient(90deg,#22D3EE,#EC4899)" : "rgba(255,255,255,0.06)",
            color: isValid ? "#06101A" : C.muted, opacity: isValid ? 1 : 0.6,
          }}
        >
          {copied ? "Copied ✓" : "Copy Result"}
        </button>
        <button
          onClick={() => setMode(m => m === "tokens" ? "earnings" : "tokens")}
          style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: "rgba(255,255,255,0.03)", color: C.text }}
        >
          ⇄ Swap Direction
        </button>
        <button
          onClick={handleClear}
          style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: "rgba(255,255,255,0.03)", color: C.text }}
        >
          Clear
        </button>
      </div>

      <style jsx>{`
        button:focus-visible, input:focus-visible { outline: 2px solid #22D3EE; outline-offset: 2px; }
        @media (max-width: 560px) {
          .calc-results { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
