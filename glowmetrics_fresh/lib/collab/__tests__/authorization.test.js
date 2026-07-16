import { describe, it, expect } from 'vitest'
import {
  isPostOwner,
  canEditPost,
  canDeletePost,
  canClosePost,
  isPostOpenForInterest,
  canExpressInterest,
  hasAlreadyExpressedInterest,
  canViewInterest,
  canSetInterestStatus,
  isConversationParticipant,
  canStartConversation,
  canSendMessage,
  otherParticipant,
  canReport,
  isSelfReport,
} from '../authorization'

const OWNER = 'owner-uuid'
const OTHER = 'other-uuid'
const STRANGER = 'stranger-uuid'

function makePost(overrides = {}) {
  return { id: 'post-1', user_id: OWNER, status: 'open', expires_at: null, ...overrides }
}

describe('post ownership', () => {
  it('recognizes the owner and rejects everyone else', () => {
    const post = makePost()
    expect(isPostOwner(post, OWNER)).toBe(true)
    expect(isPostOwner(post, OTHER)).toBe(false)
    expect(isPostOwner(null, OWNER)).toBe(false)
  })

  it('never trusts a missing/undefined user id', () => {
    const post = makePost()
    expect(isPostOwner(post, undefined)).toBe(false)
    expect(isPostOwner(post, null)).toBe(false)
  })

  it('only the owner can edit, delete, or close their post', () => {
    const post = makePost()
    expect(canEditPost(post, OWNER)).toBe(true)
    expect(canEditPost(post, OTHER)).toBe(false)
    expect(canDeletePost(post, OWNER)).toBe(true)
    expect(canDeletePost(post, OTHER)).toBe(false)
    expect(canClosePost(post, OWNER)).toBe(true)
    expect(canClosePost(post, OTHER)).toBe(false)
  })

  it('cannot edit a post an admin has removed', () => {
    const post = makePost({ status: 'removed' })
    expect(canEditPost(post, OWNER)).toBe(false)
  })

  it('cannot close an already-closed or expired post', () => {
    expect(canClosePost(makePost({ status: 'closed' }), OWNER)).toBe(false)
    expect(canClosePost(makePost({ status: 'expired' }), OWNER)).toBe(false)
  })
})

describe('expressing interest', () => {
  it('is only allowed on open, non-expired posts', () => {
    expect(isPostOpenForInterest(makePost())).toBe(true)
    expect(isPostOpenForInterest(makePost({ status: 'closed' }))).toBe(false)
    expect(isPostOpenForInterest(makePost({ expires_at: new Date(Date.now() - 1000).toISOString() }))).toBe(false)
    expect(isPostOpenForInterest(makePost({ expires_at: new Date(Date.now() + 100000).toISOString() }))).toBe(true)
  })

  it('blocks the post owner from expressing interest in their own post', () => {
    const post = makePost()
    expect(canExpressInterest(post, OWNER)).toBe(false)
    expect(canExpressInterest(post, OTHER)).toBe(true)
  })

  it('blocks interest on a closed post even for a non-owner', () => {
    const post = makePost({ status: 'closed' })
    expect(canExpressInterest(post, OTHER)).toBe(false)
  })

  it('detects an existing (non-withdrawn) interest to prevent duplicates', () => {
    const interests = [{ interested_user_id: OTHER, status: 'pending' }]
    expect(hasAlreadyExpressedInterest(interests, OTHER)).toBe(true)
    expect(hasAlreadyExpressedInterest(interests, STRANGER)).toBe(false)
  })

  it('allows re-expressing interest after a prior withdrawal', () => {
    const interests = [{ interested_user_id: OTHER, status: 'withdrawn' }]
    expect(hasAlreadyExpressedInterest(interests, OTHER)).toBe(false)
  })
})

describe('viewing and updating interests', () => {
  const post = makePost()
  const interest = { collab_post_id: 'post-1', interested_user_id: OTHER, status: 'pending' }

  it('is visible to the interested creator and the post owner only', () => {
    expect(canViewInterest(interest, OTHER, post)).toBe(true)
    expect(canViewInterest(interest, OWNER, post)).toBe(true)
    expect(canViewInterest(interest, STRANGER, post)).toBe(false)
  })

  it('lets only the post owner accept/decline/mark-maybe', () => {
    expect(canSetInterestStatus(interest, OWNER, post, 'accepted')).toBe(true)
    expect(canSetInterestStatus(interest, OWNER, post, 'declined')).toBe(true)
    expect(canSetInterestStatus(interest, OWNER, post, 'maybe')).toBe(true)
    expect(canSetInterestStatus(interest, OWNER, post, 'withdrawn')).toBe(false)
  })

  it('lets only the interested creator withdraw', () => {
    expect(canSetInterestStatus(interest, OTHER, post, 'withdrawn')).toBe(true)
    expect(canSetInterestStatus(interest, OTHER, post, 'accepted')).toBe(false)
  })

  it('denies a stranger any status change', () => {
    expect(canSetInterestStatus(interest, STRANGER, post, 'accepted')).toBe(false)
    expect(canSetInterestStatus(interest, STRANGER, post, 'withdrawn')).toBe(false)
  })
})

describe('conversations and messaging', () => {
  const conversation = { owner_user_id: OWNER, interested_user_id: OTHER }

  it('only recognizes the two participants', () => {
    expect(isConversationParticipant(conversation, OWNER)).toBe(true)
    expect(isConversationParticipant(conversation, OTHER)).toBe(true)
    expect(isConversationParticipant(conversation, STRANGER)).toBe(false)
  })

  it('only the post owner can start a conversation, and only with someone who expressed interest', () => {
    const post = makePost()
    const interest = { collab_post_id: 'post-1', interested_user_id: OTHER }
    expect(canStartConversation(post, interest, OWNER)).toBe(true)
    expect(canStartConversation(post, interest, OTHER)).toBe(false)
    const mismatchedInterest = { collab_post_id: 'other-post', interested_user_id: OTHER }
    expect(canStartConversation(post, mismatchedInterest, OWNER)).toBe(false)
  })

  it('blocks messaging for a blocked pair even if they are participants', () => {
    expect(canSendMessage(conversation, OWNER, false)).toBe(true)
    expect(canSendMessage(conversation, OWNER, true)).toBe(false)
    expect(canSendMessage(conversation, STRANGER, false)).toBe(false)
  })

  it('resolves the other participant correctly', () => {
    expect(otherParticipant(conversation, OWNER)).toBe(OTHER)
    expect(otherParticipant(conversation, OTHER)).toBe(OWNER)
    expect(otherParticipant(conversation, STRANGER)).toBeNull()
  })
})

describe('reporting', () => {
  it('requires a target post or user', () => {
    expect(canReport(OTHER, 'post-1', null)).toBe(true)
    expect(canReport(OTHER, null, OWNER)).toBe(true)
    expect(canReport(OTHER, null, null)).toBe(false)
  })

  it('flags a self-report', () => {
    expect(isSelfReport(OTHER, OTHER)).toBe(true)
    expect(isSelfReport(OTHER, OWNER)).toBe(false)
  })
})
