"use client"
import { useCallback, useEffect, useState } from "react"

const C = {
  card: "rgba(10,14,32,0.82)", border: "rgba(255,255,255,0.09)",
  cyan: "#16F4FF", pink: "#FF2BAE", red: "#f87171", gold: "#FFC857",
  green: "#34d399", muted: "#8D93AA", text: "#D7D9EA", white: "#FFFFFF",
}

const STATUS_COLOR = { open: C.gold, reviewing: C.cyan, actioned: C.green, dismissed: C.muted }

function fmtTime(d) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function CollabReportsPanel() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/collab-reports")
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setReports(d.reports || [])
    } catch { setError("Failed to load collab reports.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function update(reportId, status, removePost) {
    setBusyId(reportId)
    try {
      const removalReason = removePost ? (window.prompt("Reason for removing this post? (shown internally only)") || "") : undefined
      await fetch("/api/admin/collab-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status, removePost, removalReason }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return null

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "20px 22px", marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
        Collab Board Reports {reports.length > 0 ? `(${reports.length})` : ""}
      </div>

      {error && <div style={{ color: C.red, fontSize: 12 }}>{error}</div>}

      {!error && reports.length === 0 && (
        <div style={{ color: C.muted, fontSize: 12.5 }}>No reports to review.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reports.map(r => (
          <div key={r.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                {r.status}
              </span>
              <span style={{ fontSize: 10, color: C.muted }}>{fmtTime(r.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>
              <strong style={{ color: C.white }}>{r.reason}</strong>
              {r.post && <> — post: "{r.post.title}" ({r.post.status})</>}
              {r.reported_name && <> — reported creator: {r.reported_name}</>}
            </div>
            {r.details && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{r.details}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busyId === r.id} onClick={() => update(r.id, "reviewing", false)}
                style={{ padding: "4px 10px", borderRadius: 8, background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, fontSize: 11, cursor: "pointer" }}>
                Mark Reviewing
              </button>
              <button disabled={busyId === r.id} onClick={() => update(r.id, "dismissed", false)}
                style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, cursor: "pointer" }}>
                Dismiss
              </button>
              {r.post && r.post.status !== "removed" && (
                <button disabled={busyId === r.id} onClick={() => update(r.id, "actioned", true)}
                  style={{ padding: "4px 10px", borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}44`, color: C.red, fontSize: 11, cursor: "pointer" }}>
                  Remove Post &amp; Action
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
