"use client"
import { useEffect, useState } from 'react'
import { C } from './theme'
import { timeAgo } from './ui'
import { listNotifications, markNotificationRead } from './data'

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    listNotifications(userId).then(rows => { setItems(rows); setLoaded(true) }).catch(() => setLoaded(true))
  }, [userId])

  const unreadCount = items.filter(n => !n.read_at).length

  async function open_() {
    setOpen(o => !o)
  }

  async function handleClick(n) {
    if (!n.read_at) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i))
      markNotificationRead(n.id).catch(() => {})
    }
    if (n.link_url) window.location.href = n.link_url
  }

  if (!userId) return null

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={open_} aria-label="Notifications" style={{
        position: 'relative', width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.border}`,
        background: 'rgba(255,255,255,0.04)', color: C.white, fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 99,
            background: C.pink, color: '#fff', fontSize: 9.5, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px rgba(236,72,153,0.5)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
          <div style={{
            position: 'absolute', top: 46, right: 0, width: 320, maxHeight: 380, overflowY: 'auto', zIndex: 301,
            background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, fontWeight: 800, color: C.white }}>
              Notifications
            </div>
            {!loaded && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading…</div>}
            {loaded && items.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 12 }}>You're all caught up.</div>
            )}
            {items.map(n => (
              <button key={n.id} onClick={() => handleClick(n)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', cursor: 'pointer',
                background: n.read_at ? 'transparent' : 'rgba(34,211,238,0.06)', borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white, marginBottom: 3 }}>{n.subject || 'Notification'}</div>
                <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>{n.body}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{timeAgo(n.created_at)}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
