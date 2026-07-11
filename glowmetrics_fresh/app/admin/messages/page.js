"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

const C = {
  bg:     "#050713",
  bg1:    "#080B1A",
  card:   "rgba(10,14,32,0.82)",
  border: "rgba(255,255,255,0.09)",
  cyan:   "#16F4FF",
  pink:   "#FF2BAE",
  purple: "#7C5CFF",
  gold:   "#FFC857",
  green:  "#34d399",
  white:  "#FFFFFF",
  text:   "#D7D9EA",
  muted:  "#8D93AA",
}

function fmtTime(d) {
  if (!d) return "—"
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

const PERSONA = {
  admin_personal: { label: "Daphne", color: C.pink },
  system:         { label: "CamCash", color: C.cyan },
  user:           { label: "User", color: C.muted },
}

export default function AdminMessagesPage() {
  const router = useRouter()
  const [threads, setThreads]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState("")
  const [selected, setSelected] = useState(null) // userId or "broadcast"
  const [thread,  setThread]    = useState(null)
  const [persona, setPersona]   = useState("admin_personal")
  const [subject, setSubject]   = useState("")
  const [body,    setBody]      = useState("")
  const [sending, setSending]   = useState(false)
  const [toast,   setToast]     = useState("")

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/messages")
      if (res.status === 401) { router.replace("/admin/login"); return }
      const d = await res.json()
      setThreads(d.threads || [])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!document.cookie.includes("gm_admin=")) { router.replace("/admin/login"); return }
    loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (!selected || selected === "broadcast") { setThread(null); return }
    fetch(`/api/admin/messages?userId=${selected}`)
      .then(r => r.json())
      .then(d => setThread(d))
  }, [selected])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      if (thread) {
        // reply within the open thread
        const latest = thread.thread[thread.thread.length - 1]
        const res = await fetch(`/api/admin/messages/${latest.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderType: persona, body }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Failed to send")
      } else {
        const res = await fetch("/api/admin/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selected === "broadcast" ? undefined : selected,
            broadcast: selected === "broadcast",
            senderType: persona,
            subject: subject || undefined,
            body,
          }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || "Failed to send")
        showToast(selected === "broadcast" ? `Sent to ${d.recipientCount} users` : "Message sent")
      }
      setBody("")
      setSubject("")
      loadThreads()
      if (selected && selected !== "broadcast") {
        fetch(`/api/admin/messages?userId=${selected}`).then(r => r.json()).then(setThread)
      }
    } catch (err) {
      showToast(err.message)
    } finally {
      setSending(false)
    }
  }

  const filtered = threads.filter(t => !search || t.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}`}</style>

      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bg1, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 52 }}>
          <button onClick={() => router.push("/admin")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ fontSize: 14, fontWeight: 800, background: `linear-gradient(90deg,${C.cyan},${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            User Messages
          </div>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(22,244,255,0.1)", color: C.cyan, border: `1px solid ${C.cyan}33`, fontWeight: 700, letterSpacing: "0.08em" }}>
            ADMIN ONLY
          </span>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* Thread list */}
        <div style={{ width: 300, borderRight: `1px solid ${C.border}`, background: "rgba(6,9,20,0.6)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
            <input
              placeholder="Search email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 12, outline: "none", marginBottom: 8 }}
            />
            <button
              onClick={() => { setSelected("broadcast"); setThread(null); setSubject(""); setBody("") }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: selected === "broadcast" ? `${C.purple}33` : `${C.purple}18`, border: `1px solid ${C.purple}44`, color: C.purple, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              📢 Broadcast to all users
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading && <div style={{ padding: 16, fontSize: 12, color: C.muted }}>Loading…</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 16, fontSize: 12, color: C.muted }}>No conversations yet</div>}
            {filtered.map(t => (
              <div
                key={t.userId}
                onClick={() => { setSelected(t.userId); setSubject("") }}
                style={{ padding: "12px 14px", borderBottom: `1px solid rgba(255,255,255,0.04)`, cursor: "pointer", background: selected === t.userId ? "rgba(255,255,255,0.05)" : "transparent" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: t.isTest ? C.muted : C.cyan, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{t.email}</span>
                  {t.needsResponse && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, flexShrink: 0, marginTop: 3 }} />}
                </div>
                <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.latestBody}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{fmtTime(t.latestAt)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread / compose */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!selected && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
              Select a conversation or start a broadcast
            </div>
          )}
          {selected && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                {selected === "broadcast" && (
                  <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                    Compose a message to send to every real user (test accounts excluded).
                  </div>
                )}
                {thread?.thread?.map(n => (
                  <div key={n.id} style={{ marginBottom: 16 }}>
                    <Bubble senderType={n.sender_type} body={n.subject ? `${n.subject}\n\n${n.body}` : n.body} at={n.created_at} />
                    {n.replies.map(r => <Bubble key={r.id} senderType={r.sender_type} body={r.body} at={r.created_at} />)}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {["admin_personal", "system"].map(p => (
                    <button
                      key={p}
                      onClick={() => setPersona(p)}
                      style={{
                        padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: persona === p ? `${PERSONA[p].color}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${persona === p ? PERSONA[p].color : C.border}`,
                        color: persona === p ? PERSONA[p].color : C.muted,
                      }}
                    >
                      {p === "admin_personal" ? "👤 Personal (Daphne)" : "🤖 System (CamCash)"}
                    </button>
                  ))}
                </div>
                {!thread && (
                  <input
                    placeholder="Subject (optional)"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 12, outline: "none", marginBottom: 8 }}
                  />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write a message…"
                    rows={3}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" }}
                  />
                  <button
                    onClick={send}
                    disabled={sending || !body.trim()}
                    style={{ padding: "0 20px", borderRadius: 8, background: `${C.cyan}22`, border: `1px solid ${C.cyan}44`, color: C.cyan, cursor: sending ? "default" : "pointer", fontSize: 12, fontWeight: 700, opacity: sending || !body.trim() ? 0.5 : 1 }}
                  >
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,20,32,0.95)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 20px", color: C.white, fontSize: 13, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Bubble({ senderType, body, at }) {
  const p = PERSONA[senderType] || PERSONA.user
  const isAdmin = senderType !== "user"
  return (
    <div style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start", marginBottom: 6 }}>
      <div style={{ maxWidth: "70%" }}>
        <div style={{ fontSize: 10, color: p.color, fontWeight: 700, marginBottom: 3, textAlign: isAdmin ? "right" : "left" }}>{p.label} · {fmtTime(at)}</div>
        <div style={{
          background: isAdmin ? `${p.color}18` : "rgba(255,255,255,0.05)",
          border: `1px solid ${isAdmin ? p.color + "33" : C.border}`,
          borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.text, whiteSpace: "pre-wrap",
        }}>
          {body}
        </div>
      </div>
    </div>
  )
}
