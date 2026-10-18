import {
  FREE_LIVE_STREAMS_PER_WEEK,
  FREE_LIVE_STREAM_SECONDS,
  isProPlan,
} from './planLimits'

export function startOfUtcWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getUTCDay() // Sun=0
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

export function buildLiveModeAllowance({ plan = 'free', sessions = [], currentSession = null, now = new Date() } = {}) {
  const pro = isProPlan(plan)
  if (pro) {
    return {
      isPro: true,
      weeklyLimit: null,
      usedThisWeek: null,
      remainingThisWeek: null,
      streamLimitSeconds: null,
      currentActiveSeconds: currentSession ? activeSecondsForSession(currentSession, now) : 0,
      currentRemainingSeconds: null,
      locked: false,
      resetAt: endOfUtcWeek(now).toISOString(),
    }
  }

  const weekStartMs = startOfUtcWeek(now).getTime()
  const weekEndMs = endOfUtcWeek(now).getTime()
  const weekly = sessions.filter((session) => {
    const started = new Date(session?.started_at).getTime()
    return Number.isFinite(started) && started >= weekStartMs && started < weekEndMs
  })
  const usedThisWeek = weekly.length
  const currentActiveSeconds = currentSession ? activeSecondsForSession(currentSession, now) : 0

  return {
    isPro: false,
    weeklyLimit: FREE_LIVE_STREAMS_PER_WEEK,
    usedThisWeek,
    remainingThisWeek: Math.max(0, FREE_LIVE_STREAMS_PER_WEEK - usedThisWeek),
    streamLimitSeconds: FREE_LIVE_STREAM_SECONDS,
    currentActiveSeconds,
    currentRemainingSeconds: currentSession
      ? Math.max(0, FREE_LIVE_STREAM_SECONDS - currentActiveSeconds)
      : FREE_LIVE_STREAM_SECONDS,
    locked: !currentSession && usedThisWeek >= FREE_LIVE_STREAMS_PER_WEEK,
    limitReached: !!currentSession && currentActiveSeconds >= FREE_LIVE_STREAM_SECONDS,
    resetAt: endOfUtcWeek(now).toISOString(),
  }
}
