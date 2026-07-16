"use client"
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/track'
import { C, GRADIENT_TEXT } from './theme'
import { EmptyState, CardSkeleton, Toast } from './ui'
import FilterBar, { DEFAULT_FILTERS } from './FilterBar'
import PostCard from './PostCard'
import CreatePostModal from './CreatePostModal'
import ExpressInterestModal from './ExpressInterestModal'
import NotificationBell from './NotificationBell'
import ProfileSettingsModal from './ProfileSettingsModal'
import { listOpenPosts, getMyPosts, getSavedPosts, setPostSaved } from './data'
import { canExpressInterest } from '../../lib/collab/authorization'

const VIEWS = { BOARD: 'board', MINE: 'mine', SAVED: 'saved' }

export default function CollabBoardClient() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  const [view, setView] = useState(VIEWS.BOARD)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [posts, setPosts] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [interestPost, setInterestPost] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace('/login?next=/collabs'); return }
      setUser(u)
      setAuthChecked(true)
      supabase.from('profiles').select('display_name, avatar_url, bio, creator_niche, region, experience_level, collab_visible, social_links')
        .eq('id', u.id).maybeSingle().then(({ data }) => setProfile(data))
    })
  }, [router])

  useEffect(() => {
    if (authChecked && user) track('collab_board_viewed')
  }, [authChecked, user])

  const flash = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError('')
    try {
      let rows
      if (view === VIEWS.MINE) rows = await getMyPosts(user.id)
      else if (view === VIEWS.SAVED) rows = await getSavedPosts(user.id)
      else rows = await listOpenPosts(filters)
      setPosts(rows)

      if (view === VIEWS.SAVED) {
        setSavedIds(new Set(rows.map(r => r.id)))
      } else {
        const { data: saved } = await supabase.from('collab_saved_posts').select('collab_post_id').eq('user_id', user.id)
        setSavedIds(new Set((saved || []).map(s => s.collab_post_id)))
      }
    } catch (err) {
      setLoadError('Could not load collaboration posts. Please try again.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view, filters.collabType, filters.platform, filters.participationMode, filters.creatorNiche, filters.experiencePreference, filters.location])

  useEffect(() => { load() }, [load])

  function handleFilterChange(next) {
    setFilters(next)
    const changedKey = Object.keys(next).find(k => next[k] !== filters[k])
    if (changedKey && changedKey !== 'search') {
      track('filter_selected', { filter: changedKey })
    }
  }

  useEffect(() => {
    if (filters.search) {
      const t = setTimeout(() => track('search_performed'), 500)
      return () => clearTimeout(t)
    }
  }, [filters.search])

  const visiblePosts = useMemo(() => {
    let rows = posts
    if (view === VIEWS.BOARD) {
      if (filters.verifiedOnly) rows = rows.filter(p => p.author?.is_verified)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        rows = rows.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tags || []).some(t => t.toLowerCase().includes(q))
        )
      }
      if (filters.sort === 'upcoming') {
        rows = [...rows].sort((a, b) => {
          if (!a.proposed_date && !b.proposed_date) return 0
          if (!a.proposed_date) return 1
          if (!b.proposed_date) return -1
          return new Date(a.proposed_date) - new Date(b.proposed_date)
        })
      }
    }
    return rows
  }, [posts, view, filters])

  async function handleSavedChange(postId, saved, errorMessage) {
    if (errorMessage) { flash('error', errorMessage); return }
    setSavedIds(prev => {
      const next = new Set(prev)
      if (saved) next.add(postId); else next.delete(postId)
      return next
    })
    if (view === VIEWS.SAVED && !saved) setPosts(prev => prev.filter(p => p.id !== postId))
    if (saved) track('post_saved', { post_id: postId })
  }

  function openPost(postId) {
    track('post_viewed', { post_id: postId })
    router.push(`/collabs/${postId}`)
  }

  function handleInterestClick(post) {
    if (!canExpressInterest(post, user.id)) {
      flash('error', post.status !== 'open' ? 'This collaboration is no longer open.' : "You can't express interest in your own post.")
      return
    }
    setInterestPost(post)
  }

  function handleInterestSubmitted() {
    track('interest_submitted', { post_id: interestPost.id })
    setInterestPost(null)
    flash('success', 'Your interest was sent!')
    load()
  }

  function handlePostCreated() {
    track('post_created')
    setShowCreate(false)
    setView(VIEWS.BOARD)
    setFilters(DEFAULT_FILTERS)
    load()
  }

  if (!authChecked) {
    return (
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minHeight: '100vh', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.muted, fontSize: 13 }}>Loading Collab Board…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', padding: 32, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.purple, marginBottom: 8 }}>Community</div>
            <h1 style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, margin: 0, color: C.white }}>
              Creator <span style={GRADIENT_TEXT}>Collab Board</span>
            </h1>
            <p style={{ color: C.text, fontSize: 13.5, marginTop: 8, maxWidth: 520 }}>
              Find creators for battles, streams, content, promotions, and other collaborations.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell userId={user?.id} />
            <button onClick={() => setShowProfile(true)} title="Edit my creator profile"
              style={{
                width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.04)', color: C.text, fontSize: 15, cursor: 'pointer',
              }}>
              👤
            </button>
            <button onClick={() => setView(view === VIEWS.MINE ? VIEWS.BOARD : VIEWS.MINE)}
              style={{
                padding: '10px 16px', borderRadius: 11, border: `1px solid ${view === VIEWS.MINE ? C.cyan : C.border}`,
                background: view === VIEWS.MINE ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                color: view === VIEWS.MINE ? C.cyan : C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              My Posts
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{
                padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)', color: '#05070f',
                fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap',
                boxShadow: '0 0 20px rgba(34,211,238,0.2)',
              }}>
              + Post a Collaboration
            </button>
          </div>
        </div>

        {profile && !profile.display_name && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(168,85,247,0.08)', border: `1px solid ${C.purple}44`, borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
            <span style={{ fontSize: 12.5, color: C.text }}>Set up your creator profile so other creators know who they're collaborating with.</span>
            <button onClick={() => setShowProfile(true)} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${C.purple}66`, background: 'rgba(168,85,247,0.15)', color: C.purple, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Set Up Profile
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[[VIEWS.BOARD, 'Board'], [VIEWS.SAVED, 'Saved']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '7px 14px', borderRadius: 9, border: `1px solid ${view === v ? C.cyan : C.border}`,
                background: view === v ? 'rgba(34,211,238,0.1)' : 'transparent',
                color: view === v ? C.cyan : C.muted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>

        {view === VIEWS.BOARD && <FilterBar filters={filters} onChange={handleFilterChange} />}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!loading && loadError && (
          <EmptyState icon="⚠️" title="Something went wrong" body={loadError} action={
            <button onClick={load} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.white, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Try Again</button>
          } />
        )}

        {!loading && !loadError && visiblePosts.length === 0 && view === VIEWS.BOARD && (
          <EmptyState
            icon="🤝"
            title="No collabs match your filters yet"
            body="Create a post and let other creators know what you're planning."
            action={<CreateCta onClick={() => setShowCreate(true)} />}
          />
        )}

        {!loading && !loadError && visiblePosts.length === 0 && view === VIEWS.MINE && (
          <EmptyState icon="📋" title="You haven't posted any collaborations yet" body="Post one to start connecting with other creators." action={<CreateCta onClick={() => setShowCreate(true)} />} />
        )}

        {!loading && !loadError && visiblePosts.length === 0 && view === VIEWS.SAVED && (
          <EmptyState icon="⭐" title="No saved posts yet" body="Save collaborations you're considering so you can find them later." />
        )}

        {!loading && !loadError && visiblePosts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {visiblePosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                userId={user.id}
                saved={savedIds.has(post.id)}
                onSavedChange={handleSavedChange}
                onInterest={handleInterestClick}
                onOpen={openPost}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onCreated={handlePostCreated} />}
      {interestPost && (
        <ExpressInterestModal post={interestPost} userId={user.id} onClose={() => setInterestPost(null)} onSubmitted={handleInterestSubmitted} />
      )}
      {showProfile && (
        <ProfileSettingsModal
          userId={user.id}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onSaved={updated => { setProfile(updated); setShowProfile(false); flash('success', 'Profile saved.'); load() }}
        />
      )}
      {toast && <Toast tone={toast.tone}>{toast.message}</Toast>}
    </div>
  )
}

function CreateCta({ onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 22px', borderRadius: 11, border: 'none', cursor: 'pointer',
      background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)', color: '#05070f', fontWeight: 800, fontSize: 13,
    }}>
      + Post a Collaboration
    </button>
  )
}
