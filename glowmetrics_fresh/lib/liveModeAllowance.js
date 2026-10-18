import {
  FREE_LIVE_STREAMS_PER_WEEK,
  FREE_LIVE_STREAM_SECONDS,
  TRIAL_DAYS,
  TRIAL_LIVE_STREAMS_TOTAL,
  TRIAL_LIVE_STREAM_MINUTES,
  hasPaidProAccess,
  isTrialStatus,
} from './planLimits'

export function startOfUtcWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d
}

export function endOfUtcWeek(date = new Date()) {
  const start = startOfUtcWeek(date)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return end
}

export function trialWindowStart(trialEndsAt, trialDays = TRIAL_DAYS) {
  const end = new Date(trialEndsAt)
  if (!Number.isFinite(end.getTime())) return null
  return new Date(end.getTime() - trialDays * 24 * 60 * 60 * 1000)
}

export function activeSecondsForSession(session, now = new Date()) {
  if (!session?.started_at) return 0
  const startMs = new Date(session.started_at).getTime()
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0

  let pausedSeconds = Math.max(0, Number(session.total_paused_seconds) || 0)
  if (!session.ended_at && session.live_substate === 'paused' && session.paused_at) {
    const pausedAtMs = new Date(session.paused_at).getTime()
    if (Number.isFinite(pausedAtMs) && endMs > pausedAtMs) {
      pausedSeconds += (endMs - pausedAtMs) / 1000
    }
  }

  return Math.max(0, Math.floor((endMs - startMs) / 1000 - pausedSeconds))
}

export function buildLiveModeAllowance({
  plan = 'free',
  subscriptionStatus = 'none',
  trialEndsAt = null,
  sessions = [],
  currentSession = null,
  now = new Date(),
} = {}) {
  const paidPro = hasPaidProAccess({ plan, subscriptionStatus })
  const trialing = isTrialStatus(subscriptionStatus, trialEndsAt, now)
  const currentActiveSeconds = currentSession ? activeSecondsForSession(currentSession, now) : 0

  if (paidPro) {
    return {
      isPro: true,
      isTrial: false,
      scope: 'unlimited',
      sessionLimit: null,
      usedInScope: null,
      remainingInScope: null,
      weeklyLimit: null,
      usedThisWeek: null,
      remainingThisWeek: null,
      streamLimitSeconds: null,
      currentActiveSeconds,
      currentRemainingSeconds: null,
      locked: false,
      limitReached: false,
      resetAt: null,
    }
  }

  let scope = 'week'
  let scopeStartMs = startOfUtcWeek(now).getTime()
  let scopeEndMs = endOfUtcWeek(now).getTime()
  let sessionLimit = FREE_LIVE_STREAMS_PER_WEEK
  let streamLimitSeconds = FREE_LIVE_STREAM_SECONDS
  let resetAt = endOfUtcWeek(now).toISOString()

  if (trialing) {
    const trialStart = trialWindowStart(trialEndsAt)
    const trialEnd = new Date(trialEndsAt)
    scope = 'trial'
    scopeStartMs = trialStart?.getTime() ?? now.getTime()
    scopeEndMs = trialEnd.getTime()
    sessionLimit = TRIAL_LIVE_STREAMS_TOTAL
    streamLimitSeconds = TRIAL_LIVE_STREAM_MINUTES * 60
    resetAt = trialEnd.toISOString()
  }

  const inScope = sessions.filter((session) => {
    const started = new Date(session?.started_at).getTime()
    return Number.isFinite(started) && started >= scopeStartMs && started < scopeEndMs
  })
  const usedInScope = inScope.length
  const remainingInScope = Math.max(0, sessionLimit - usedInScope)

  return {
    isPro: false,
    isTrial: trialing,
    scope,
    sessionLimit,
    usedInScope,
    remainingInScope,
    // Backward-compatible week fields for older clients. Trial clients should
    // use the generic scope fields so they never imply a weekly reset.
    weeklyLimit: scope === 'week' ? sessionLimit : null,
    usedThisWeek: scope === 'week' ? usedInScope : null,
    remainingThisWeek: scope === 'week' ? remainingInScope : null,
    streamLimitSeconds,
    currentActiveSeconds,
    currentRemainingSeconds: currentSession
      ? Math.max(0, streamLimitSeconds - currentActiveSeconds)
      : streamLimitSeconds,
    locked: !currentSession && usedInScope >= sessionLimit,
    limitReached: !!currentSession && currentActiveSeconds >= streamLimitSeconds,
    resetAt,
  }
}
