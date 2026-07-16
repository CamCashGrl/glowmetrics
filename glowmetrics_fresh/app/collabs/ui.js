"use client"
import { C } from './theme'

export function Pill({ children, color = C.cyan, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
      background: `${color}1f`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

export function VerifiedBadge({ size = 12 }) {
  return (
    <span title="Verified creator" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 6, borderRadius: '50%',
      background: 'linear-gradient(135deg,#22D3EE,#a855f7)', color: '#05070f',
      fontSize: size, fontWeight: 900, flexShrink: 0,
    }}>
      ✓
    </span>
  )
}

export function Avatar({ src, name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#22D3EE,#EC4899)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800,
    }}>
      {initial}
    </div>
  )
}

export function EmptyState({ icon = '🤝', title, body, action }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 24px', borderRadius: 18,
      background: C.card, border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.white, marginBottom: 8 }}>{title}</div>
      {body && <p style={{ fontSize: 13.5, color: C.text, maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>{body}</p>}
      {action}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div style={{ borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, padding: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div className="collab-shimmer" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="collab-shimmer" style={{ width: '55%', height: 12, borderRadius: 6, marginBottom: 8 }} />
          <div className="collab-shimmer" style={{ width: '35%', height: 10, borderRadius: 6 }} />
        </div>
      </div>
      <div className="collab-shimmer" style={{ width: '80%', height: 14, borderRadius: 6, marginBottom: 10 }} />
      <div className="collab-shimmer" style={{ width: '100%', height: 10, borderRadius: 6, marginBottom: 6 }} />
      <div className="collab-shimmer" style={{ width: '90%', height: 10, borderRadius: 6, marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="collab-shimmer" style={{ width: 70, height: 22, borderRadius: 99 }} />
        <div className="collab-shimmer" style={{ width: 70, height: 22, borderRadius: 99 }} />
      </div>
      <style jsx>{`
        .collab-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 37%, rgba(255,255,255,0.05) 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
      `}</style>
    </div>
  )
}

export function InlineSpinner({ size = 14 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.25)', borderTopColor: C.cyan,
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

export function Toast({ tone = 'success', children }) {
  const color = tone === 'error' ? C.red : tone === 'info' ? C.cyan : C.green
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 400,
      background: 'rgba(10,14,26,0.95)', border: `1px solid ${color}55`, color: C.white,
      padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
      boxShadow: `0 0 24px ${color}33, 0 8px 24px rgba(0,0,0,0.4)`,
      display: 'flex', alignItems: 'center', gap: 8, maxWidth: '92vw',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      {children}
    </div>
  )
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatProposedDate(post) {
  if (post.date_is_flexible || !post.proposed_date) return 'Flexible'
  return new Date(post.proposed_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
