import { supabase } from '../../lib/supabase'

// Data-access layer for the Collab Board. Every function here relies on
// Supabase RLS (see supabase/migrations/20260716_create_collab_board.sql) to
// enforce who can see/write what — this file never re-implements permission
// checks, it just shapes queries and merges author profiles onto posts.
//
// collab_public_profiles is a VIEW (not a real FK target), so PostgREST can't
// auto-embed it via `.select('*, author:collab_public_profiles(*)')`. Posts
// and authors are fetched in two round trips and merged client-side instead.

const POST_COLUMNS = '*'

export async function attachAuthors(rows, idField = 'user_id') {
  const ids = [...new Set((rows || []).map(r => r[idField]).filter(Boolean))]
  if (ids.length === 0) return (rows || []).map(r => ({ ...r, author: null }))
  const { data: authors } = await supabase
    .from('collab_public_profiles')
    .select('*')
    .in('id', ids)
  const byId = new Map((authors || []).map(a => [a.id, a]))
  return (rows || []).map(r => ({ ...r, author: byId.get(r[idField]) || null }))
}

/**
 * Server-side-pushdown filters (indexed columns); free-text search, verified
 * badge, and sort by "upcoming date" are applied client-side after fetch —
 * the board's expected row count is small enough that this trade-off keeps
 * the query simple and avoids joining through a view for filtering.
 */
export async function listOpenPosts(filters = {}) {
  let query = supabase
    .from('collab_posts')
    .select(POST_COLUMNS)
    .eq('status', 'open')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.collabType) query = query.eq('collab_type', filters.collabType)
  if (filters.participationMode) query = query.eq('participation_mode', filters.participationMode)
  if (filters.platform) query = query.contains('platforms', [filters.platform])
  if (filters.creatorNiche) query = query.ilike('creator_niche', `%${filters.creatorNiche}%`)
  if (filters.experiencePreference) query = query.eq('experience_preference', filters.experiencePreference)
  if (filters.location) {
    query = query.or(`city.ilike.%${filters.location}%,state_or_region.ilike.%${filters.location}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return attachAuthors(data)
}

export async function getPost(postId) {
  const { data, error } = await supabase.from('collab_posts').select(POST_COLUMNS).eq('id', postId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [withAuthor] = await attachAuthors([data])
  return withAuthor
}

export async function getMyPosts(userId) {
  const { data, error } = await supabase
    .from('collab_posts')
    .select(POST_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getSavedPosts(userId) {
  const { data, error } = await supabase
    .from('collab_saved_posts')
    .select('collab_post_id, created_at, collab_posts(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const posts = (data || []).map(row => row.collab_posts).filter(Boolean)
  return attachAuthors(posts)
}

export async function isPostSaved(userId, postId) {
  const { data, error } = await supabase
    .from('collab_saved_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('collab_post_id', postId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function setPostSaved(userId, postId, saved) {
  if (saved) {
    const { error } = await supabase.from('collab_saved_posts').insert({ user_id: userId, collab_post_id: postId })
    if (error && error.code !== '23505') throw error
  } else {
    const { error } = await supabase.from('collab_saved_posts').delete().eq('user_id', userId).eq('collab_post_id', postId)
    if (error) throw error
  }
}

export async function createPost(payload) {
  const { data, error } = await supabase.from('collab_posts').insert(payload).select(POST_COLUMNS).single()
  if (error) throw error
  return data
}

export async function updatePost(postId, patch) {
  const { data, error } = await supabase.from('collab_posts').update(patch).eq('id', postId).select(POST_COLUMNS).single()
  if (error) throw error
  return data
}

export async function deletePost(postId) {
  const { error } = await supabase.from('collab_posts').delete().eq('id', postId)
  if (error) throw error
}

export async function getMyInterestForPost(postId, userId) {
  const { data, error } = await supabase
    .from('collab_interests')
    .select('*')
    .eq('collab_post_id', postId)
    .eq('interested_user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createInterest(postId, userId, introductionMessage) {
  const { data, error } = await supabase
    .from('collab_interests')
    .insert({ collab_post_id: postId, interested_user_id: userId, introduction_message: introductionMessage })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function withdrawInterest(interestId) {
  const { error } = await supabase.from('collab_interests').update({ status: 'withdrawn' }).eq('id', interestId)
  if (error) throw error
}

export async function getInterestsForPost(postId) {
  const { data, error } = await supabase
    .from('collab_interests')
    .select('*')
    .eq('collab_post_id', postId)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachAuthors(data, 'interested_user_id')
}

export async function setInterestStatus(interestId, status) {
  const { data, error } = await supabase.from('collab_interests').update({ status }).eq('id', interestId).select('*').single()
  if (error) throw error
  return data
}

export async function startConversation(postId, ownerUserId, interestedUserId) {
  const { data, error } = await supabase
    .from('collab_conversations')
    .insert({ collab_post_id: postId, owner_user_id: ownerUserId, interested_user_id: interestedUserId })
    .select('*')
    .single()
  if (error && error.code === '23505') {
    const { data: existing } = await supabase
      .from('collab_conversations')
      .select('*')
      .eq('collab_post_id', postId)
      .eq('interested_user_id', interestedUserId)
      .single()
    return existing
  }
  if (error) throw error
  return data
}

export async function listConversations(userId) {
  const { data, error } = await supabase
    .from('collab_conversations')
    .select('*, collab_posts(title, id)')
    .or(`owner_user_id.eq.${userId},interested_user_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  const rows = (data || []).map(r => ({ ...r, other_user_id: r.owner_user_id === userId ? r.interested_user_id : r.owner_user_id }))
  return attachAuthors(rows, 'other_user_id')
}

export async function getConversation(conversationId) {
  const { data, error } = await supabase.from('collab_conversations').select('*, collab_posts(title, id)').eq('id', conversationId).maybeSingle()
  if (error) throw error
  return data
}

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('collab_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function sendMessage(conversationId, senderUserId, message) {
  const { data, error } = await supabase
    .from('collab_messages')
    .insert({ conversation_id: conversationId, sender_user_id: senderUserId, message })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function markMessagesRead(conversationId, userId) {
  const { error } = await supabase
    .from('collab_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

export async function createReport(payload) {
  const { error } = await supabase.from('collab_reports').insert(payload)
  if (error) throw error
}

export async function blockUser(blockerUserId, blockedUserId) {
  const { error } = await supabase.from('collab_blocks').insert({ blocker_user_id: blockerUserId, blocked_user_id: blockedUserId })
  if (error && error.code !== '23505') throw error
}

export async function unblockUser(blockerUserId, blockedUserId) {
  const { error } = await supabase.from('collab_blocks').delete().eq('blocker_user_id', blockerUserId).eq('blocked_user_id', blockedUserId)
  if (error) throw error
}

export async function listMyBlocks(userId) {
  const { data, error } = await supabase.from('collab_blocks').select('*').eq('blocker_user_id', userId)
  if (error) throw error
  return data || []
}

export async function listNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Friendly messages for the raised-in-Postgres error strings from our triggers/constraints. */
export function friendlyErrorMessage(error) {
  const msg = error?.message || ''
  if (msg.includes('rate_limit_exceeded')) return "You've hit a rate limit — please try again a bit later."
  if (msg.includes('post_not_open')) return 'This collaboration is no longer accepting interest.'
  if (msg.includes('not_allowed')) return "You don't have permission to do that."
  if (error?.code === '23505') return 'You have already done this.'
  return 'Something went wrong. Please try again.'
}
