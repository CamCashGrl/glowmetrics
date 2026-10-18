'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../../../lib/track'

const POLL_MS = 10000

function pct(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)))
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(safe / 60)
  const s = Math.floor(safe % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function usage(allowance) {
  if (!allowance) return { used: 0, remaining: 0, limit: 0 }
  return {
    used: allowance.usedInScope ?? allowance.usedThisWeek ?? 0,
    remaining: allowance.remainingInScope ?? allowance.remainingThisWeek ?? 0,
    limit: allowance.sessionLimit ?? allowance.weeklyLimit ?? 0,
  }
}

function milestoneFor(allowance) {
  if (!allowance || allowance.isPro) return null
  const remaining = allowance.currentRemainingSeconds
  const active = allowance.currentActiveSeconds
  const scoped = usage(allowance)
  if (allowance.locked) return allowance.isTrial ? 'trial_locked' : 'weekly_locked'
  if (active > 0 && remaining <= 120) return 'two_minutes_left'
  if (active > 0 && remaining <= 300) return 'five_minutes_left'
  if (active > 0 && remaining <= 600) return 'ten_minutes_left'
  if (active >= 900) return 'halfway'
  if (scoped.used === 1 && active === 0) return allowance.isTrial ? 'one_trial_stream_left' : 'one_stream_left'
  return null
}

export default function LiveModeAllowanceBar() {
  const router = useRouter()
  const [allowance, setAllowance] = useState(null)
  const trackedRef = useRef(false)
  const milestoneRef = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    let timer
    const load = async () => {
      try {
        const res = await fetch('/api/live/usage', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && res.ok) setAllowance(data.allowance || null)
      } catch (_) {}
      if (!cancelled) timer = setTimeout(load, POLL_MS)
    }
    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!allowance || allowance.isPro || trackedRef.current) return
    trackedRef.current = true
    const scoped = usage(allowance)
    track('live_allowance_bar_impression', {
      allowance_scope: allowance.scope || 'week',
      is_trial: !!allowance.isTrial,
      used_in_scope: scoped.used,
      remaining_in_scope: scoped.remaining,
    })
  }, [allowance])

  useEffect(() => {
    const milestone = milestoneFor(allowance)
    if (!milestone || milestoneRef.current.has(milestone)) return
    milestoneRef.current.add(milestone)
    const scoped = usage(allowance)
    track('live_allowance_milestone', {
      milestone,
      allowance_scope: allowance.scope || 'week',
      is_trial: !!allowance.isTrial,
      used_in_scope: scoped.used,
      remaining_in_scope: scoped.remaining,
      current_active_seconds: allowance.currentActiveSeconds,
      current_remaining_seconds: allowance.currentRemainingSeconds,
    })
  }, [allowance])

  const prompt = useMemo(() => {
    if (!allowance || allowance.isPro) return null
    const remaining = allowance.currentRemainingSeconds
    const active = allowance.currentActiveSeconds
    const scoped = usage(allowance)

    if (allowance.locked) {
      return allowance.isTrial
        ? 'You’ve used both Live Mode sessions included in your 7-day trial.'
        : 'You’ve used both Free Live Mode streams this week.'
    }
    if (active > 0 && remaining <= 120) return '2 minutes left — paid Pro keeps coaching running without a timer.'
    if (active > 0 && remaining <= 300) return '5 minutes left — continue uninterrupted with paid Pro.'
    if (active > 0 && remaining <= 600) return '10 minutes left on this limited Live Mode stream.'
    if (active >= 900) return 'Halfway through this 30-minute stream — paid Pro removes the timer.'
    if (scoped.used === 1 && active === 0) {
      return allowance.isTrial
        ? '1 Live Mode session left in your 7-day trial.'
        : '1 Free Live Mode stream left this week.'
    }
    return allowance.isTrial
      ? 'Your 7-day trial includes 2 Live Mode sessions total, up to 30 active minutes each.'
      : 'Free includes 2 Live Mode streams per week, up to 30 active minutes each.'
  }, [allowance])

  if (!allowance) return null

  if (allowance.isPro) {
    return (
      <div style={{ margin: '14px 18px 0', padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(124,92,255,0.25)', background: 'rgba(124,92,255,0.07)', color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>
        ✦ Paid Pro · Unlimited Live Mode
      </div>
    )
  }

  const scoped = usage(allowance)
  const usedPct = pct(scoped.used, scoped.limit)
  const streamPct = allowance.currentActiveSeconds > 0
    ? pct(allowance.currentActiveSeconds, allowance.streamLimitSeconds)
    : 0

  const upgrade = () => {
    track('live_allowance_upgrade_click', {
      milestone: milestoneFor(allowance) || 'default',
      allowance_scope: allowance.scope || 'week',
      is_trial: !!allowance.isTrial,
      used_in_scope: scoped.used,
      current_active_seconds: allowance.currentActiveSeconds,
      locked: !!allowance.locked,
    })
    router.push('/pricing')
  }

  return (
    <div style={{ margin: '14px 18px 0', padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,43,174,0.24)', background: 'linear-gradient(135deg,rgba(255,43,174,0.07),rgba(124,92,255,0.08),rgba(22,244,255,0.04))', boxShadow: '0 12px 34px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
            <strong style={{ color: '#fff', fontSize: 13 }}>{allowance.isTrial ? '7-day trial · Live Mode' : 'Free Live Mode'}</strong>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>
              {allowance.isTrial ? '2 sessions total · 30 min each' : '2 streams/week · 30 min each'}
            </span>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 10 }}>{prompt}</div>

          <div style={{ display: 'grid', gridTemplateColumns: allowance.currentActiveSeconds > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
            <Progress
              label={`${scoped.remaining} of ${scoped.limit} ${allowance.isTrial ? 'trial sessions' : 'weekly streams'} remaining`}
              value={usedPct}
            />
            {allowance.currentActiveSeconds > 0 && (
              <Progress label={`${formatTime(allowance.currentRemainingSeconds)} remaining this stream`} value={streamPct} />
            )}
          </div>
          {allowance.isTrial && (
            <div style={{ color: '#7d8aa3', fontSize: 10, marginTop: 8 }}>
              Trial access is capped. <a href="/terms" style={{ color: '#16F4FF' }}>View trial terms</a>
            </div>
          )}
        </div>

        <button onClick={upgrade} style={{ border: 0, borderRadius: 999, padding: '10px 16px', cursor: 'pointer', color: '#07070b', fontWeight: 900, fontSize: 12, background: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)', boxShadow: '0 0 22px rgba(124,92,255,0.28)', whiteSpace: 'nowrap' }}>
          Unlock unlimited · $9.99/mo
        </button>
      </div>
    </div>
  )
}

function Progress({ label, value }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 10, marginBottom: 5 }}>
        <span>{label}</span><span>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)', transition: 'width .25s ease' }} />
      </div>
    </div>
  )
}
