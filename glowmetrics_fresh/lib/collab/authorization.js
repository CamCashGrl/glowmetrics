// Pure permission checks for the Collab Board.
//
// These mirror (and are covered by tests for) the same rules enforced by
// Postgres RLS/triggers in the migration — UI must never rely on these alone
// to hide an action; the database is the real authority. Never pass a
// client-submitted user id here — always the id from the authenticated
// Supabase session.

export function isPostOwner(post, userId) {
  return !!post && !!userId && post.user_id === userId
}

export function canEditPost(post, userId) {
  return isPostOwner(post, userId) && post.status !== 'removed'
}

export function canDeletePost(post, userId) {
  return isPostOwner(post, userId)
}

export function canClosePost(post, userId) {
  return isPostOwner(post, userId) && ['open', 'matched'].includes(post.status)
}

export function isPostOpenForInterest(post) {
  if (!post) return false
  if (post.status !== 'open') return false
  if (post.expires_at && new Date(post.expires_at).getTime() <= Date.now()) return false
  return true
}

export function canExpressInterest(post, userId) {
  if (!post || !userId) return false
  if (isPostOwner(post, userId)) return false
  return isPostOpenForInterest(post)
}

export function hasAlreadyExpressedInterest(existingInterests, userId) {
  return (existingInterests || []).some(i => i.interested_user_id === userId && i.status !== 'withdrawn')
}

export function canViewInterest(interest, userId, post) {
  if (!interest || !userId) return false
  if (interest.interested_user_id === userId) return true
  return isPostOwner(post, userId)
}

/** Only the post owner may accept / decline / mark maybe; only the interested creator may withdraw. */
export function canSetInterestStatus(interest, userId, post, nextStatus) {
  if (!interest || !userId) return false
  if (interest.interested_user_id === userId) {
    return nextStatus === 'withdrawn'
  }
  if (isPostOwner(post, userId)) {
    return ['accepted', 'declined', 'maybe'].includes(nextStatus)
  }
  return false
}

export function isConversationParticipant(conversation, userId) {
  return !!conversation && !!userId && (conversation.owner_user_id === userId || conversation.interested_user_id === userId)
}

export function canStartConversation(post, interest, userId) {
  if (!post || !interest || !userId) return false
  return isPostOwner(post, userId) && interest.collab_post_id === post.id
}

export function canSendMessage(conversation, userId, isBlocked = false) {
  return isConversationParticipant(conversation, userId) && !isBlocked
}

export function otherParticipant(conversation, userId) {
  if (!isConversationParticipant(conversation, userId)) return null
  return conversation.owner_user_id === userId ? conversation.interested_user_id : conversation.owner_user_id
}

export function canReport(reporterUserId, targetPostId, targetUserId) {
  return !!reporterUserId && (!!targetPostId || !!targetUserId)
}

export function isSelfReport(reporterUserId, targetUserId) {
  return !!targetUserId && reporterUserId === targetUserId
}
