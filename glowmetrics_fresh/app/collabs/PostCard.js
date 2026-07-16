"use client"
import { useState } from 'react'
import { C } from './theme'
import { Pill, VerifiedBadge, Avatar, timeAgo, formatProposedDate } from './ui'
import { labelFor, COLLAB_TYPES, PLATFORMS } from '../../lib/collab/constants'
import { setPostSaved, friendlyErrorMessage } from './data'

const MODE_LABEL = { online: 'Online', in_person: 'In-Person', either: 'Online or In-Person' }

export default function PostCard({ post, userId, saved, onSavedChange, onInterest, onOpen }) {
  const [savePending, setSavePending] = useState(false)
  const author = post.author

  async function toggleSave(e) {
    e.stopPropagation()
    if (!userId || savePending) return
    setSavePending(true)
    const next = !saved
    try {
      await setPostSaved(userId, post.id, next)
      onSavedChange?.(post.id, next)
    } catch (err) {
      onSavedChange?.(post.id, saved, friendlyErrorMessage(err))
    } finally {
      setSavePending(false)
    }
  }

  const isOwnPost = userId && post.user_id === userId

  return (
    <div
      onClick={() => onOpen?.(post.id)}
      style={{
        borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', transition: 'all 0.18s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar src={author?.avatar_url} name={author?.display_name} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {author?.display_name || 'CamCash Creator'}
            </span>
            {author?.is_verified && <VerifiedBadge />}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(post.created_at)}</div>
        </div>
        <button
          onClick={toggleSave}
          disabled={!userId}
          title={saved ? 'Remove from saved' : 'Save for later'}
          style={{
            background: 'none', border: 'none', cursor: userId ? 'pointer' : 'default',
            fontSize: 17, color: saved ? C.gold : C.muted, flexShrink: 0, opacity: savePending ? 0.5 : 1,
          }}
        >
          {saved ? '★' : '☆'}
        </button>
      </div>

      <div>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: C.white, marginBottom: 6, lineHeight: 1.3 }}>{post.title}</div>
        <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {post.description}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Pill color={C.purple}>{labelFor(COLLAB_TYPES, post.collab_type)}</Pill>
        {(post.platforms || []).slice(0, 2).map(p => (
          <Pill key={p} color={C.cyan}>{labelFor(PLATFORMS, p)}</Pill>
        ))}
        {(post.platforms || []).length > 2 && <Pill color={C.cyan}>+{post.platforms.length - 2}</Pill>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11.5, color: C.muted }}>
        <span>📍 {post.city || post.state_or_region ? [post.city, post.state_or_region].filter(Boolean).join(', ') : MODE_LABEL[post.participation_mode]}</span>
        <span>🗓️ {formatProposedDate(post)}</span>
      </div>

      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {post.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 10.5, color: C.text, background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>#{t}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11.5, color: C.muted }}>
          {post.interested_count > 0 ? `${post.interested_count} interested` : 'No interest yet'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onOpen?.(post.id) }}
            style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            View Details
          </button>
          {!isOwnPost && (
            <button
              onClick={e => { e.stopPropagation(); onInterest?.(post) }}
              style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#22D3EE,#a855f7)', color: '#05070f', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              I'm Interested
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
