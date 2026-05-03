"use client"
import React, { useState } from "react"
import { supabase } from "../../lib/supabase"

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

export default function CSVImport({ user, onSuccess, showToast }) {
  const [uploading, setUploading] = useState(false)
  const [uploadPlatform, setUploadPlatform] = useState("")
  const [lastResult, setLastResult] = useState(null)

  const handleCSV = async (file, forcePlatform = null) => {
    if (!file || !user) return
    setUploading(true)
    setLastResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast("❌ Not logged in"); setUploading(false); return }

      const fd = new FormData()
      fd.append('file', file)
      if (forcePlatform) fd.append('platform', forcePlatform)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        showToast("❌ " + (result.error || 'Upload failed'))
        setLastResult({ success: false, error: result.error || 'Upload failed' })
        setUploading(false)
        return
      }

      const msg = result.skipped > 0
        ? `✅ Imported ${result.inserted} tips (${result.skipped} duplicates skipped)`
        : `✅ Imported ${result.inserted} tips from ${result.platform}!`

      showToast(msg)
      setLastResult({ success: true, inserted: result.inserted, skipped: result.skipped, platform: result.platform })
      if (onSuccess) onSuccess()

    } catch (err) {
      showToast("❌ " + err.message)
      setLastResult({ success: false, error: err.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV</h1>
      <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>
        Unlimited uploads during free beta • Auto-removes duplicates
      </p>

      <div style={{ ...glassCard, borderRadius: 14, padding: 32, marginBottom: 16 }}>
        {/* Platform selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, color: C.muted, textTransform: "uppercase",
            letterSpacing: 0.5, marginBottom: 8, display: "block"
          }}>
            Platform (optional — helps if auto-detect fails)
          </label>
          <select
            value={uploadPlatform}
            onChange={e => setUploadPlatform(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 9,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: C.white, fontSize: 14, outline: "none"
            }}
          >
            <option value="">Auto-detect (recommended)</option>
            <option value="Chaturbate">Chaturbate</option>
            <option value="BongaCams">BongaCams</option>
            <option value="MyFreeCams">MyFreeCams</option>
            <option value="Stripchat">Stripchat</option>
            <option value="CamSoda">CamSoda</option>
          </select>
        </div>

        {/* Upload button */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <label style={{
            display: "inline-block", padding: "14px 32px", borderRadius: 10,
            background: uploading
              ? "rgba(255,255,255,0.1)"
              : "linear-gradient(135deg, #22D3EE, #EC4899)",
            boxShadow: uploading ? "none" : "0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(236,72,153,0.3)",
            color: C.white, fontSize: 15, fontWeight: 600,
            cursor: uploading ? "not-allowed" : "pointer",
            transition: "all 0.2s"
          }}>
            {uploading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  display: "inline-block", width: 16, height: 16,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin 0.7s linear infinite"
                }} />
                Processing...
              </span>
            ) : "Choose CSV File"}
            <input
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={e => {
                if (e.target.files[0]) {
                  handleCSV(e.target.files[0], uploadPlatform || null)
                  e.target.value = "" // reset so same file can be re-uploaded
                }
              }}
              disabled={uploading}
            />
          </label>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
            Supports Chaturbate, BongaCams, MyFreeCams, Stripchat, CamSoda
          </p>
        </div>

        {/* Result banner */}
        {lastResult && (
          <div style={{
            marginTop: 20, padding: "14px 16px", borderRadius: 10,
            background: lastResult.success ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${lastResult.success ? "rgba(16,185,129,0.3)" : "rgba(248,113,113,0.3)"}`,
            fontSize: 13,
            color: lastResult.success ? C.green : C.red,
            display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{ fontSize: 18 }}>{lastResult.success ? "✅" : "❌"}</span>
            <div>
              {lastResult.success ? (
                <>
                  <div style={{ fontWeight: 700 }}>
                    {lastResult.inserted} tips imported from {lastResult.platform}
                  </div>
                  {lastResult.skipped > 0 && (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {lastResult.skipped} duplicates skipped
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontWeight: 700 }}>{lastResult.error}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tip box */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)",
        fontSize: 12, color: C.muted
      }}>
        <strong style={{ color: C.cyan }}>CSV not loading?</strong> Try selecting your platform
        from the dropdown above, then re-upload. For Chaturbate: export from Stats & Data → Token Stats.
        For BongaCams: export from Reports.
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
