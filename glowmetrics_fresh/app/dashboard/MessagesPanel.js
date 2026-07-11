"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "../../lib/supabase"

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const PERSONA = {
  admin_personal: { label: "Daphne", color: C.pink },
  system:         { label: "CamCash", color: C.cyan },
  user:           { label: "You", color: C.muted },
}

function fmtTime(d) {
  if (!d) return "—"
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

// Renders the user's own inbox — sends/replies always go through the
// RLS-respecting client, so a user can never read or write into another
// user's thread even if this component had a bug (see replies_insert_own_thread
// and notifications_select_own policies on the notifications tables).
export default function MessagesPanel({ user, showToast, onUnreadChange }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/messages")
    if (!res.ok) { setLoading(false); return }
    const d = await res.json()
    const list = d.notifications || []
    setNotifications(list)
    setLoading(false)
    onUnreadChange?.(list.filter(n => !n.read_at).length)
  }, [onUnreadChange])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications_dash_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        showToast?.(`✉️ New message from ${PERSONA[payload.new.sender_type]?.label || "CamCash"}`)
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, load, showToast])

  const selected = notifications.find(n => n.id === selectedId)

  const openThread = async (n) => {
    setSelectedId(n.id)
    if (!n.read_at) {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: n.id }),
      })
      setNotifications(prev => {
        const next = prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)
        onUnreadChange?.(next.filter(x => !x.read_at).length)
        return next
      })
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      const res = await fetch(`/api/messages/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send reply")
      setReply("")
      await load()
    } catch (err) {
      showToast?.("❌ " + err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ color: C.text, fontSize: 13, padding: 20 }}>Loading messages…</div>

  return (
    <div style={{ display: "flex", gap: 20, minHeight: 480 }}>
      <div style={{ width: 280, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        {notifications.length === 0 && (
          <div style={{ padding: 20, fontSize: 13, color: C.text }}>No messages yet.</div>
        )}
        {notifications.map(n => {
          const persona = PERSONA[n.sender_type] || PERSONA.system
          const lastReply = n.notification_replies?.[n.notification_replies.length - 1]
          return (
            <div key={n.id} onClick={() => openThread(n)}
              style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selectedId === n.id ? C.card2 : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: persona.color }}>{persona.label}</span>
                {!n.read_at && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.pink }} />}
              </div>
              {n.subject && <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 2 }}>{n.subject}</div>}
              <div style={{ fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lastReply?.body || n.body}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{fmtTime(lastReply?.created_at || n.created_at)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, display: "flex", flexDirection: "column" }}>
        {!selected && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
            Select a message to view the conversation
          </div>
        )}
        {selected && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {selected.subject && <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 12 }}>{selected.subject}</div>}
              <Bubble senderType={selected.sender_type} body={selected.body} at={selected.created_at} />
              {selected.notification_replies?.map(r => (
                <Bubble key={r.id} senderType={r.sender_type} body={r.body} at={r.created_at} />
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: "flex", gap: 8 }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Reply…"
                rows={2}
                style={{ flex: 1, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                style={{ padding: "0 20px", borderRadius: 8, background: `${C.cyan}22`, border: `1px solid ${C.cyan}44`, color: C.cyan, cursor: sending ? "default" : "pointer", fontSize: 12, fontWeight: 700, opacity: sending || !reply.trim() ? 0.5 : 1 }}
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Bubble({ senderType, body, at }) {
  const p = PERSONA[senderType] || PERSONA.system
  const isMine = senderType === "user"
  return (
    <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: "75%" }}>
        <div style={{ fontSize: 10, color: p.color, fontWeight: 700, marginBottom: 3, textAlign: isMine ? "right" : "left" }}>{p.label} · {fmtTime(at)}</div>
        <div style={{
          background: isMine ? `${C.cyan}18` : C.card2,
          border: `1px solid ${isMine ? C.cyan + "33" : C.border}`,
          borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.white, whiteSpace: "pre-wrap",
        }}>
          {body}
        </div>
      </div>
    </div>
  )
}
