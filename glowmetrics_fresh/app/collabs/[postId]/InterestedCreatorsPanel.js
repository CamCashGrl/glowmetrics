"use client"
import { useState } from 'react'
import { C } from '../theme'
import { Avatar, VerifiedBadge, Pill, timeAgo, EmptyState, InlineSpinner } from '../ui'
import { setInterestStatus, startConversation, friendlyErrorMessage } from '../data'
import { track } from '../../../lib/track'

const STATUS_COLOR = { pending: C.gold, accepted: C.green, maybe: C.cyan, declined: C.red, withdrawn: C.muted }
const STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', maybe: 'Maybe', declined: 'Declined', withdrawn: 'Withdrawn' }

export default function InterestedCreatorsPanel({ post, interests, ownerId, onChanged, onOpenConversation, onFlash }) {
  const [busyId, setBusyId] = useState(null)

  async function handleStatus(interest, status) {
    setBusyId(interest.id)
    try {
      await setInterestStatus(interest.id, status)
      if (status === 'accepted') {
        track('interest_accepted', { post_id: post.id })
        onFlash?.('success', `You accepted ${interest.author?.display_name || 'this creator'}'s interest.`)
      }
      onChanged?.()
    } catch (err) {
      onFlash?.('error', friendlyErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleStartConversation(interest) {
    setBusyId(interest.id)
    try {
      const convo = await startConversation(post.id, ownerId, interest.interested_user_id)
      track('conversation_started', { post_id: post.id })
      onOpenConversation?.(convo)
    } catch (err) {
      onFlash?.('error', friendlyErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (interests.length === 0) {
    return <EmptyState icon="👋" title="No interested creators yet" body="Once someone expresses interest in this collab, they'll show up here." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {interests.map(interest => (
        <div key={interest.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar src={interest.author?.avatar_url} name={interest.author?.display_name} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white }}>{interest.author?.display_name || 'CamCash Creator'}</span>
                {interest.author?.is_verified && <VerifiedBadge />}
                <Pill color={STATUS_COLOR[interest.status]}>{STATUS_LABEL[interest.status]}</Pill>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{timeAgo(interest.created_at)}</div>
              {interest.author?.creator_niche && <div style={{ fontSize: 11.5, color: C.text, marginTop: 4 }}>{interest.author.creator_niche}</div>}
              {interest.introduction_message && (
                <p style={{ fontSize: 12.5, color: C.text, marginTop: 8, lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8 }}>
                  {interest.introduction_message}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {interest.status === 'pending' && (
              <>
                <ActionBtn busy={busyId === interest.id} onClick={() => handleStatus(interest, 'accepted')} color={C.green}>Accept</ActionBtn>
                <ActionBtn busy={busyId === interest.id} onClick={() => handleStatus(interest, 'maybe')} color={C.cyan}>Maybe</ActionBtn>
                <ActionBtn busy={busyId === interest.id} onClick={() => handleStatus(interest, 'declined')} color={C.red}>Decline</ActionBtn>
              </>
            )}
            {interest.status === 'maybe' && (
              <>
                <ActionBtn busy={busyId === interest.id} onClick={() => handleStatus(interest, 'accepted')} color={C.green}>Accept</ActionBtn>
                <ActionBtn busy={busyId === interest.id} onClick={() => handleStatus(interest, 'declined')} color={C.red}>Decline</ActionBtn>
              </>
            )}
            <ActionBtn busy={busyId === interest.id} onClick={() => handleStartConversation(interest)} color={C.purple} filled>
              Start Conversation
            </ActionBtn>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionBtn({ children, onClick, color, busy, filled }) {
  return (
    <button onClick={onClick} disabled={busy} style={{
      padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
      border: `1px solid ${color}55`, background: filled ? `${color}22` : 'transparent', color,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {busy ? <InlineSpinner size={11} /> : children}
    </button>
  )
}
