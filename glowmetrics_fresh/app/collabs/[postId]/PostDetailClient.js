"use client"
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { track } from '../../../lib/track'
import { C } from '../theme'
import { Avatar, VerifiedBadge, Pill, EmptyState, InlineSpinner, Toast, timeAgo, formatProposedDate } from '../ui'
import { labelFor, COLLAB_TYPES, PLATFORMS, EXPERIENCE_LEVELS } from '../../../lib/collab/constants'
import {
  getPost, getMyInterestForPost, getInterestsForPost, isPostSaved, setPostSaved,
  updatePost, deletePost, withdrawInterest, blockUser, friendlyErrorMessage,
} from '../data'
import { canEditPost, canDeletePost, canClosePost, canExpressInterest, isPostOwner } from '../../../lib/collab/authorization'
import CreatePostModal from '../CreatePostModal'
import ExpressInterestModal from '../ExpressInterestModal'
import ReportModal from '../ReportModal'
import InterestedCreatorsPanel from './InterestedCreatorsPanel'
import ConversationPanel from './ConversationPanel'

const MODE_LABEL = { online: 'Online', in_person: 'In-Person', either: 'Online or In-Person' }
const STATUS_LABEL = { open: 'Open', matched: 'Matched', closed: 'Closed', expired: 'Expired', removed: 'Removed' }

export default function PostDetailClient({ postId }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [post, setPost] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [myInterest, setMyInterest] = useState(null)
  const [interests, setInterests] = useState([])
  const [showInterested, setShowInterested] = useState(false)

  const [showInterestModal, setShowInterestModal] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [activeConversation, setActiveConversation] = useState(null)
  const [toast, setToast] = useState(null)
  const [busyAction, setBusyAction] = useState(false)

  const flash = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace(`/login?next=/collabs/${postId}`); return }
      setUser(u)
      setAuthChecked(true)
    })
  }, [router, postId])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const p = await getPost(postId)
      if (!p) { setNotFound(true); setLoading(false); return }
      setPost(p)
      track('post_viewed', { post_id: postId })

      const [isSaved, mine] = await Promise.all([
        isPostSaved(user.id, postId),
        getMyInterestForPost(postId, user.id),
      ])
      setSaved(isSaved)
      setMyInterest(mine)

      if (isPostOwner(p, user.id)) {
        const list = await getInterestsForPost(postId)
        setInterests(list)
      }
    } catch (err) {
      flash('error', 'Could not load this post.')
    } finally {
      setLoading(false)
    }
  }, [user, postId, flash])

  useEffect(() => { load() }, [load])

  async function handleToggleSave() {
    if (!user) return
    const next = !saved
    setSaved(next)
    try {
      await setPostSaved(user.id, postId, next)
      if (next) track('post_saved', { post_id: postId })
    } catch (err) {
      setSaved(!next)
      flash('error', friendlyErrorMessage(err))
    }
  }

  async function handleClosePost() {
    setBusyAction(true)
    try {
      const updated = await updatePost(postId, { status: 'closed' })
      setPost(updated)
      track('post_closed', { post_id: postId })
      flash('success', 'Post closed.')
    } catch (err) {
      flash('error', friendlyErrorMessage(err))
    } finally {
      setBusyAction(false)
    }
  }

  async function handleDeletePost() {
    if (!window.confirm('Delete this collaboration post? This cannot be undone.')) return
    setBusyAction(true)
    try {
      await deletePost(postId)
      router.push('/collabs')
    } catch (err) {
      flash('error', friendlyErrorMessage(err))
      setBusyAction(false)
    }
  }

  async function handleBlock() {
    if (!window.confirm(`Block ${post.author?.display_name || 'this creator'}? You won't see each other's collab posts or messages anymore.`)) return
    setBusyAction(true)
    try {
      await blockUser(user.id, post.user_id)
      flash('success', 'Creator blocked.')
      router.push('/collabs')
    } catch (err) {
      flash('error', friendlyErrorMessage(err))
      setBusyAction(false)
    }
  }

  async function handleWithdraw() {
    setBusyAction(true)
    try {
      await withdrawInterest(myInterest.id)
      flash('success', 'Interest withdrawn.')
      load()
    } catch (err) {
      flash('error', friendlyErrorMessage(err))
    } finally {
      setBusyAction(false)
    }
  }

  if (!authChecked || loading) {
    return (
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minHeight: '100vh', padding: 32, boxSizing: 'border-box' }}>
        <DetailSkeleton />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minHeight: '100vh', padding: 32, boxSizing: 'border-box' }}>
        <EmptyState icon="🔍" title="Post not found" body="This collaboration post doesn't exist or was removed." action={<BackLink />} />
      </div>
    )
  }

  const owner = isPostOwner(post, user.id)
  const isClosedState = post.status !== 'open'
  const isExpired = post.expires_at && new Date(post.expires_at).getTime() <= Date.now()

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', padding: 32, boxSizing: 'border-box', maxWidth: 900 }}>
        <BackLink />

        {(isClosedState || isExpired) && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: `1px solid ${C.red}44`, borderRadius: 12, padding: '10px 16px', fontSize: 12.5, color: C.red, marginBottom: 16, fontWeight: 600 }}>
            {post.status === 'removed' ? 'This post was removed by CamCash moderation.' : `This collaboration is ${isExpired ? 'expired' : STATUS_LABEL[post.status].toLowerCase()} and is no longer accepting interest.`}
          </div>
        )}

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar src={post.author?.avatar_url} name={post.author?.display_name} size={48} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>{post.author?.display_name || 'CamCash Creator'}</span>
                  {post.author?.is_verified && <VerifiedBadge size={13} />}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted }}>Posted {timeAgo(post.created_at)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <IconButton title={saved ? 'Remove from saved' : 'Save'} onClick={handleToggleSave} active={saved}>{saved ? '★' : '☆'}</IconButton>
              {!owner && <IconButton title="Report post" onClick={() => setShowReport(true)}>🚩</IconButton>}
              {!owner && <IconButton title="Block this creator" onClick={handleBlock}>🚫</IconButton>}
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(20px,2.6vw,26px)', fontWeight: 900, color: C.white, margin: '18px 0 10px' }}>{post.title}</h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            <Pill color={C.purple}>{labelFor(COLLAB_TYPES, post.collab_type)}</Pill>
            {(post.platforms || []).map(p => <Pill key={p} color={C.cyan}>{labelFor(PLATFORMS, p)}</Pill>)}
            <Pill color={post.status === 'open' ? C.green : C.muted}>{STATUS_LABEL[post.status]}</Pill>
          </div>

          <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, marginBottom: 18, whiteSpace: 'pre-wrap' }}>{post.description}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
            <DetailStat label="Mode" value={MODE_LABEL[post.participation_mode]} />
            <DetailStat label="Location" value={[post.city, post.state_or_region].filter(Boolean).join(', ') || 'Not shared'} />
            <DetailStat label="Proposed Date" value={formatProposedDate(post)} />
            <DetailStat label="Creator Niche" value={post.creator_niche || 'Any'} />
            <DetailStat label="Experience" value={labelFor(EXPERIENCE_LEVELS, post.experience_preference)} />
            {post.audience_size_preference && <DetailStat label="Audience Size" value={post.audience_size_preference} />}
            {post.age_requirement && <DetailStat label="Age Requirement" value={`${post.age_requirement}+`} />}
            <DetailStat label="Interested Creators" value={String(post.interested_count || 0)} />
          </div>

          {post.goals && <TextSection title="Collaboration Goals" body={post.goals} />}
          {post.requirements && <TextSection title="Requirements" body={post.requirements} />}
          {post.boundaries && <TextSection title="Boundaries" body={post.boundaries} />}

          {post.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {post.tags.map(t => <span key={t} style={{ fontSize: 11, color: C.text, background: 'rgba(255,255,255,0.04)', padding: '3px 10px', borderRadius: 7 }}>#{t}</span>)}
            </div>
          )}

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {owner ? (
              <>
                <ActionButton onClick={() => setShowEdit(true)} disabled={!canEditPost(post, user.id)}>Edit Post</ActionButton>
                <ActionButton onClick={handleClosePost} disabled={!canClosePost(post, user.id) || busyAction} tone="warn">Close Post</ActionButton>
                <ActionButton onClick={handleDeletePost} disabled={!canDeletePost(post, user.id) || busyAction} tone="danger">Delete Post</ActionButton>
                <ActionButton onClick={() => setShowInterested(true)} tone="primary">View Interested Creators ({post.interested_count || 0})</ActionButton>
              </>
            ) : (
              <>
                {myInterest && myInterest.status !== 'withdrawn' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Pill color={C.green}>You expressed interest — {myInterest.status}</Pill>
                    {myInterest.status !== 'accepted' && (
                      <button onClick={handleWithdraw} disabled={busyAction} style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
                        Withdraw interest
                      </button>
                    )}
                  </div>
                ) : (
                  <ActionButton onClick={() => setShowInterestModal(true)} disabled={!canExpressInterest(post, user.id)} tone="primary">
                    I'm Interested
                  </ActionButton>
                )}
              </>
            )}
          </div>
        </div>

        {owner && showInterested && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 12 }}>Interested Creators</div>
            <InterestedCreatorsPanel
              post={post}
              interests={interests}
              ownerId={user.id}
              onChanged={load}
              onOpenConversation={c => setActiveConversation(c)}
              onFlash={flash}
            />
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>Community safety:</strong> Never share your home address or financial information. Verify identities independently before meeting, and meet in a public place when appropriate. CamCash does not verify arrangements, payments, travel plans, or agreements made between creators, and is not responsible for private agreements.
        </div>
      </div>

      {showEdit && <CreatePostModal post={post} onClose={() => setShowEdit(false)} onCreated={updated => { setPost(updated); setShowEdit(false); flash('success', 'Post updated.') }} />}
      {showInterestModal && (
        <ExpressInterestModal
          post={post}
          userId={user.id}
          onClose={() => setShowInterestModal(false)}
          onSubmitted={() => { track('interest_submitted', { post_id: postId }); setShowInterestModal(false); flash('success', 'Your interest was sent!'); load() }}
        />
      )}
      {showReport && (
        <ReportModal
          collabPostId={postId}
          reportedUserId={post.user_id}
          label="Report this post"
          onClose={() => setShowReport(false)}
          onSubmitted={() => { track('post_reported', { post_id: postId }); setShowReport(false) }}
        />
      )}
      {activeConversation && (
        <ConversationPanel conversation={activeConversation} userId={user.id} onClose={() => setActiveConversation(null)} onFlash={flash} />
      )}
      {toast && <Toast tone={toast.tone}>{toast.message}</Toast>}
    </div>
  )
}

function BackLink() {
  return (
    <a href="/collabs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.muted, marginBottom: 18, textDecoration: 'none' }}>
      ← Back to Collab Board
    </a>
  )
}

function DetailStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function TextSection({ title, body }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{body}</p>
    </div>
  )
}

function IconButton({ children, title, onClick, active }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`,
      background: 'rgba(255,255,255,0.04)', color: active ? C.gold : C.text, fontSize: 15, cursor: 'pointer',
    }}>
      {children}
    </button>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'default' }) {
  const colors = {
    default: { border: C.border, bg: 'rgba(255,255,255,0.04)', text: C.text },
    primary: { border: 'transparent', bg: 'linear-gradient(90deg,#22D3EE,#a855f7)', text: '#05070f' },
    warn: { border: `${C.gold}55`, bg: `${C.gold}18`, text: C.gold },
    danger: { border: `${C.red}55`, bg: `${C.red}18`, text: C.red },
  }[tone]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 16px', borderRadius: 10, border: `1px solid ${colors.border}`,
      background: colors.bg, color: colors.text, fontSize: 12.5, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    }}>
      {children}
    </button>
  )
}

function DetailSkeleton() {
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ width: 140, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ width: 160, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div style={{ width: '70%', height: 22, borderRadius: 8, background: 'rgba(255,255,255,0.06)', marginBottom: 14 }} />
        <div style={{ width: '100%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
        <div style={{ width: '90%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
        <div style={{ width: '60%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <InlineSpinner /> <span style={{ color: C.muted, fontSize: 12 }}>Loading collaboration…</span>
        </div>
      </div>
    </div>
  )
}
