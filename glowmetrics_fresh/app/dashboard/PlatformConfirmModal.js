"use client"
import React, { useEffect, useRef, useState } from "react"
import Button from "../../components/ui/Button"

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM CONFIRM MODAL
//
// /api/upload never stores a tip as platform 'Unknown': when neither the
// creator's Platform menu choice, the file's contents, nor its file name
// identify the platform, the route saves nothing and returns
// code 'platform_required'. This popup turns that refusal into one question —
// "which platform is this file from?" — and the dashboard re-sends the SAME
// file with the confirmed platform. Nothing is guessed and nothing is saved
// until the creator confirms.
//
// Presentation only: no parsing, rates, or analytics live here.
// ═══════════════════════════════════════════════════════════════════════════

// Same three platforms the dashboard's Platform menu offers. Initials instead
// of logos (branding spec: no official logos unless provided).
export const CONFIRMABLE_PLATFORMS = [
  { id: "Chaturbate", initials: "CB", tile: "linear-gradient(135deg,#21E6F3,#248BFF)" },
  { id: "BongaCams",  initials: "BC", tile: "linear-gradient(135deg,#FF2FAE,#D83DFF)" },
  { id: "MyFreeCams", initials: "MFC", tile: "linear-gradient(135deg,#7C5CFF,#6C5CFF)" },
]

export const PLATFORM_CONFIRM_TITLE = "We couldn't identify this platform"
export const PLATFORM_CONFIRM_BODY = "Please confirm the platform."

export default function PlatformConfirmModal({
  open = false,
  fileName = null,
  // Platforms the Free plan can't add yet. They stay selectable: the
  // dashboard's upload handler already routes them to the existing
  // quick-preview + upgrade screen, so the popup doesn't re-implement gating.
  lockedPlatforms = [],
  onConfirm,
  onCancel,
}) {
  const [selected, setSelected] = useState(null)
  const firstCardRef = useRef(null)

  // Fresh choice every time the popup opens — never pre-select a guess.
  useEffect(() => {
    if (open) {
      setSelected(null)
      firstCardRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === "Escape") onCancel?.() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      data-testid="platform-confirm-backdrop"
      onClick={() => onCancel?.()}
      style={{ position: "fixed", inset: 0, background: "rgba(5,7,19,0.86)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1003, padding: 16 }}
    >
      {/* Gradient hairline wrapper = the CamCash glowing border */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, padding: 1, borderRadius: 26, background: "linear-gradient(135deg, rgba(33,230,243,0.85), rgba(124,92,255,0.5), rgba(255,47,174,0.85))", boxShadow: "-18px 0 60px rgba(33,230,243,0.18), 18px 0 60px rgba(255,47,174,0.18), 0 24px 70px rgba(0,0,0,0.55)" }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="platform-confirm-title"
          aria-describedby="platform-confirm-body"
          style={{ borderRadius: 25, padding: "28px 24px 24px", background: "radial-gradient(circle at 12% 0%, rgba(33,230,243,0.12), transparent 45%), radial-gradient(circle at 92% 100%, rgba(255,47,174,0.12), transparent 45%), rgba(8,11,26,0.97)", maxHeight: "90vh", overflowY: "auto" }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#21E6F3", marginBottom: 10, textAlign: "center" }}>
            Confirm platform
          </div>
          <h2 id="platform-confirm-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, color: "#FFFFFF", textAlign: "center" }}>
            {PLATFORM_CONFIRM_TITLE}
          </h2>
          <p id="platform-confirm-body" style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5, color: "#D7D9EA", textAlign: "center" }}>
            {PLATFORM_CONFIRM_BODY}
          </p>
          {fileName && (
            <p data-testid="platform-confirm-file" style={{ margin: "6px 0 0", fontSize: 12.5, color: "#8D93AA", textAlign: "center", overflowWrap: "anywhere" }}>
              {fileName}
            </p>
          )}

          <div role="radiogroup" aria-label="Platform" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 10, marginTop: 22 }}>
            {CONFIRMABLE_PLATFORMS.map((p, i) => {
              const isSel = selected === p.id
              const locked = lockedPlatforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  ref={i === 0 ? firstCardRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  data-testid={`platform-confirm-${p.id}`}
                  onClick={() => setSelected(p.id)}
                  style={{
                    position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "16px 10px 14px", borderRadius: 18, cursor: "pointer",
                    background: isSel ? "rgba(33,230,243,0.08)" : "rgba(13,17,38,0.72)",
                    border: isSel ? "1px solid rgba(33,230,243,0.95)" : "1px solid rgba(255,255,255,0.09)",
                    boxShadow: isSel ? "0 0 0 1px rgba(33,230,243,0.24), 0 0 22px rgba(33,230,243,0.22), inset 0 0 24px rgba(33,230,243,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
                    color: "#FFFFFF", transition: "all 0.15s",
                  }}
                >
                  {isSel && (
                    <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%", background: "#21E6F3", color: "#050713", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                  )}
                  <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 12, background: p.tile, display: "flex", alignItems: "center", justifyContent: "center", fontSize: p.initials.length > 2 ? 12.5 : 14, fontWeight: 900, color: "#FFFFFF" }}>
                    {p.initials}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{p.id}</span>
                  {locked && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#FF2FAE" }}>🔒 Pro</span>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
            <Button
              data-testid="platform-confirm-submit"
              disabled={!selected}
              onClick={() => selected && onConfirm?.(selected)}
              style={{ padding: "13px 26px", flex: "1 1 200px", maxWidth: 280 }}
            >
              Confirm platform
            </Button>
            <Button variant="secondary" data-testid="platform-confirm-cancel" onClick={() => onCancel?.()}>
              Cancel
            </Button>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "#8D93AA", textAlign: "center" }}>
            Nothing is saved until you confirm.
          </p>
        </div>
      </div>
    </div>
  )
}
