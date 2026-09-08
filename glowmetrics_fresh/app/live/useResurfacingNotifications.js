'use client'

import { useCallback, useRef, useEffect } from 'react'
import { detectSessions } from '../../lib/analytics/sessions'
import { identifyWhales, detectResurfacing } from '../../lib/analytics'

/**
 * Pro Live Mode Resurfacing Notifications Hook
 *
 * Detects meaningful returning Whale and Regular fans during live stream.
 * Fires notifications when:
 * - A Returning Whale just tipped
 * - A Returning Regular just tipped
 *
 * Uses canonical resurfacing engine (same as Command Center).
 */
export function useResurfacingNotifications(isPro, tips, onNotification) {
  const lastProcessedCountRef = useRef(0)
  const seenResurfacingRef = useRef(new Set())

  useEffect(() => {
    if (!isPro || !tips || tips.length === 0 || !onNotification) return

    // Only process new tips added since last check
    if (tips.length <= lastProcessedCountRef.current) return

    const newTipCount = tips.length - lastProcessedCountRef.current
    const newTips = tips.slice(-newTipCount)

    // Get unique usernames from new tips
    const newTippersSet = new Set()
    newTips.forEach(t => {
      const key = `${t.platform}:${t.username}`.toLowerCase()
      newTippersSet.add(key)
    })

    if (newTippersSet.size === 0) {
      lastProcessedCountRef.current = tips.length
      return
    }

    // Detect canonical sessions and identify whales
    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions)
    const resurfacing = detectResurfacing(whales)

    // Check if any new tippers are in resurfacing list
    resurfacing.forEach(r => {
      const fanKey = `${r.platform}:${r.username}`.toLowerCase()
      if (newTippersSet.has(fanKey) && !seenResurfacingRef.current.has(fanKey)) {
        seenResurfacingRef.current.add(fanKey)

        // Fire notification with real evidence
        let title = ''
        let subtitle = ''

        if (r.tier === 'Whale') {
          title = '🐋 WHALE RETURNED'
          subtitle = `One of your highest-value fans just returned.`
        } else if (r.tier === 'Regular') {
          title = '💜 REGULAR IS BACK'
          subtitle = `One of your established regulars just returned.`
        } else {
          title = '💎 HIGH-VALUE FAN RETURNED'
          subtitle = `A meaningful fan just returned.`
        }

        onNotification({
          type: 'resurfacing',
          priority: r.tier === 'Whale' ? 'critical' : r.tier === 'Regular' ? 'high' : 'medium',
          title,
          subtitle,
          fanKey,
          fan: {
            username: r.username,
            platform: r.platform,
            tier: r.tier,
            totalUSD: r.totalUSD,
            qualifyingSessionCount: r.qualifyingSessionCount,
            dormancyDays: r.dormancyDays,
            relativeValue: r.relativeValue
          },
          action: 'View Profile',
          actionUrl: `/profile?username=${r.username}&platform=${r.platform}`,
          timestamp: Date.now(),
          id: `resurfacing_${fanKey}_${Date.now()}`
        })
      }
    })

    lastProcessedCountRef.current = tips.length
  }, [isPro, tips, onNotification])

  // Reset seen resurfacing when stream ends
  useEffect(() => {
    if (!tips || tips.length === 0) {
      seenResurfacingRef.current.clear()
      lastProcessedCountRef.current = 0
    }
  }, [tips])
}
