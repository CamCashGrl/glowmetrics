"use client"
import React from "react"
import dynamic from "next/dynamic"
import { C, glassCard, TAB_LOADING } from "./dashboardTheme"

const ChaturbateTokenConnector = dynamic(() => import('./components/ChaturbateTokenConnector'), { ssr: false, loading: () => TAB_LOADING })

export default function UploadTab({ user, router, uploading, uploadPlatform, setUploadPlatform, handleCSV, isPro, allPlatforms, freePlatformLimitReached }) {
  return (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: freePlatformLimitReached ? 16 : 32 }}>
              {isPro ? "Unlimited platforms • Auto-removes duplicates" : freePlatformLimitReached ? `Free plan — tracking ${allPlatforms[0]}. Auto-removes duplicates.` : "Free plan tracks 1 platform. Auto-removes duplicates."}
            </p>
            {freePlatformLimitReached && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <div style={{ flex: 1, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                  You're on the free plan (1 platform). Upgrade to Pro to add BongaCams, MyFreeCams, and more.
                </div>
                <a href="/pricing" style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 9, background: "linear-gradient(135deg,#22D3EE,#a855f7,#EC4899)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Upgrade →</a>
              </div>
            )}
            <div style={{ ...glassCard, borderRadius: 14, padding: 32, marginBottom: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "block" }}>Platform (optional — helps if auto-detect fails)</label>
                <select value={uploadPlatform} onChange={e => setUploadPlatform(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.white, fontSize: 14, outline: "none" }}>
                  <option value="">Auto-detect (recommended)</option>
                  {["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"].map(p => {
                    const locked = freePlatformLimitReached && !allPlatforms.includes(p)
                    return <option key={p} value={p} disabled={locked}>{locked ? `🔒 ${p} — requires Pro` : p}</option>
                  })}
                </select>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                <label style={{ display: "inline-block", padding: "14px 32px", borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #EC4899)", boxShadow: "0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(236,72,153,0.3)", color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                  {uploading ? "Processing..." : "Choose CSV File"}
                  <input type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => handleCSV(e.target.files[0], uploadPlatform || null)} disabled={uploading} />
                </label>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Supports Chaturbate, BongaCams, MyFreeCams, Stripchat, CamSoda</p>
              </div>
            </div>

            {/* Plan explainer + subscribe CTA */}
            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Your plan
              </div>
              {isPro ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.indigo }}>✦ Subscription active</span>
                  <span style={{ fontSize: 12, color: C.text }}>— track and compare unlimited platforms</span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 16 }}>
                    The <strong style={{ color: C.white }}>free plan</strong> tracks <strong style={{ color: C.cyan }}>1 platform</strong> — import as much history as you want from it, no limits. A <strong style={{ color: C.white }}>subscription</strong> unlocks tracking <strong style={{ color: C.pink }}>multiple platforms at once</strong> and lets you compare which cam site pays you best by hour, day, and fan type.
                  </p>
                  <button onClick={() => router.push('/pricing')} style={{ padding: "12px 26px", borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #EC4899)", boxShadow: "0 0 20px rgba(34,211,238,0.35), 0 0 40px rgba(236,72,153,0.25)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    View Plans & Subscribe →
                  </button>
                </>
              )}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "20px 0 14px" }} />

              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Some insights unlock as you upload more data
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                {[
                  ["Peak earning hours", "25+ tips & 3+ sessions"],
                  ["Average $/hour", "3+ sessions & 60+ tracked minutes"],
                  ["Top fans", "10+ tips & 5+ fans"],
                  ["Whale detection", "10+ fans & $50+ earned"],
                  ["Session breakdown", "3+ sessions"],
                  ["Fan re-engagement", "20+ fans & $50+ earned"],
                  ["Earnings forecasting", "8+ sessions & $50+ earned"],
                  ["Platform comparison", isPro ? "2+ platforms imported" : "Subscription + 2+ platforms"],
                ].map(([label, req]) => (
                  <div key={label} style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ color: C.white, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>Unlocks at {req}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)", fontSize: 12, color: C.muted }}>
              <strong style={{ color: C.cyan }}>CSV not loading?</strong> Try selecting your platform from the dropdown above, then re-upload. For Chaturbate: export from Stats & Data → Token Stats. For BongaCams: export from Reports.
            </div>

            {user && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Live Tip Sync
                </div>
                <ChaturbateTokenConnector user={user} onConnected={() => { /* live sync now active */ }} />
              </div>
            )}
          </div>
  )
}
