"use client"

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { aggregateRows as runEngine } from '../analytics'
import { computeDailyBriefCore } from '../liveMode/dailyBriefCore'
import { canShowHourlyRate } from '../../app/dashboard/DashboardPreview'

// Account-level/historical overview stats (Total Earned, Estimated $/Hour,
// Best Platform, Peak Window) for a given user — the same underlying tips
// fetch + aggregateRows() + computeDailyBriefCore() pipeline the dashboard
// runs, so the numbers can never diverge between the two surfaces. Live
// Mode uses this for its top stats strip; the dashboard keeps its own
// existing fetch (it needs the full tips/analytics state for many other
// tabs already) but calls the same computeDailyBriefCore().
export function useAccountOverviewStats(userId) {
  const [state, setState] = useState({
    loading: true,
    revenue: 0,
    hourlyRate: 0,
    hourlyRateUnlocked: false,
    hourlyRateSubtext: '',
    bestPlatform: null,
    peakWindowLabel: null,
    peakEtaLabel: null,
    atPeak: false,
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const load = async () => {
      const userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
      let allData = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase.from('tips').select('*').eq('user_id', userId)
          .order('date_time', { ascending: true }).range(from, from + PAGE - 1)
        if (error || cancelled) break
        if (data?.length) allData = [...allData, ...data]
        if (!data || data.length < PAGE) break
        from += PAGE
      }
      if (cancelled || !allData.length) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
        return
      }

      let analytics = null
      try { analytics = runEngine(allData, userTz) } catch (_) { analytics = null }
      if (!analytics) { setState((s) => ({ ...s, loading: false })); return }

      const brief = computeDailyBriefCore(allData, analytics, new Date())
      const hourlyRateUnlocked = canShowHourlyRate({
        sessionCount: analytics?.hourlyRateSessionCount || 0,
        totalStreamMinutes: analytics?.hourlyRateTotalMinutes || 0,
      })
      const formatDuration = (mins) => {
        const m = Math.round(mins || 0)
        const h = Math.floor(m / 60)
        const rem = m % 60
        return h > 0 ? `${h}h ${rem}m` : `${rem}m`
      }
      const localNow = new Date().getHours()
      const hoursUntilLocal = brief?.hoursUntilPeak
      const peakEtaLabel = hoursUntilLocal === 0 ? 'NOW'
        : hoursUntilLocal === 1 ? 'in 1 hr'
        : (hoursUntilLocal > 0 && !isNaN(hoursUntilLocal)) ? `in ${hoursUntilLocal}h` : null

      if (!cancelled) {
        setState({
          loading: false,
          revenue: analytics?.totalUSD || 0,
          hourlyRate: analytics?.estimatedHourlyRate ?? 0,
          hourlyRateUnlocked,
          hourlyRateSubtext: hourlyRateUnlocked
            ? `Based on ${analytics?.hourlyRateSessionCount || 0} session${(analytics?.hourlyRateSessionCount || 0) === 1 ? '' : 's'} and ${formatDuration(analytics?.hourlyRateTotalMinutes)} tracked.`
            : 'Unlocks after 3 eligible sessions and 60 minutes tracked.',
          bestPlatform: brief?.displayPlat || (allData.length > 0 ? allData[0]?.platform : null),
          peakWindowLabel: brief?.bhLabel || null,
          peakEtaLabel,
          atPeak: !!brief?.atPeak,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  return state
}
