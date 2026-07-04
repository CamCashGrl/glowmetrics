"use client"
import React from "react"
import { C, glassCard } from "./dashboardTheme"
import { computeRoomHealth } from "../../lib/analytics/roomHealth"
import { computeRevenueVelocity, computeLiveComparison } from "../../lib/analytics/velocity"
import { detectSessionPhase, PHASES, getRecoveryActions, getGoalStrategy } from "../../lib/analytics/sessionPhase"
import { computeOpportunityScore, computeStreamHealth } from "../../lib/analytics/opportunity"

export default function LiveTab({ sessions, tokenRates, liveActive, setLiveActive, liveStartTime, setLiveStartTime, liveEvents, setLiveEvents, liveGoalTokens, setLiveGoalTokens, livePlatform, setLivePlatform, liveTipInput, setLiveTipInput, liveTick, liveStrategy, setLiveStrategy, flashTipId, isHydratingHistory, processedTipIds, prevPhaseRef, coachingCooldowns, firedAlertsLog, phaseChangeLog, liveTipsChannelRef }) {
          // ── INLINE LIVE ENGINE (no external import needed) ────────────────

          const normalizeTip = (ev) => {
            const tokens = parseInt(ev.tokens) || 0
            const usd    = parseFloat(ev.usd) || 0
            const rate   = tokenRates[livePlatform] || 0.05
            let rev = 0, src = 'unknown', conf = 0
            if (usd > 0 && tokens > 0) {
              rev = usd; src = 'usd'; conf = 0.9
            } else if (usd > 0) {
              rev = usd; src = 'usd'; conf = 0.95
            } else if (tokens > 0) {
              rev = parseFloat((tokens * rate).toFixed(2)); src = 'tokens'; conf = 0.75
            }
            return { ...ev, normalizedRevenue: rev, sourceUsed: src, confidenceScore: conf, timestamp: ev.timestamp || new Date() }
          }

          const computeState = () => {
            if (!liveEvents.length || !liveStartTime) return null
            const nowMs   = Date.now()
            const startMs = new Date(liveStartTime).getTime()
            const elapsedMins = Math.max((nowMs - startMs) / 60000, 0.1)

            // ALL events — used for totals and the tip feed display
            let totalRevenue = 0, totalTokens = 0
            const tipperMap = {}
            liveEvents.forEach(ev => {
              totalRevenue += ev.normalizedRevenue || 0
              totalTokens  += ev.tokens || 0
              tipperMap[ev.username] = (tipperMap[ev.username] || 0) + (ev.normalizedRevenue || 0)
            })

            // LIVE-ONLY events — used for time-sensitive coaching signals
            // Historical events must NEVER trigger pace/timing alerts
            const liveOnly = liveEvents.filter(e => !e._isHistory)
            const sortedLive = [...liveOnly].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            const lastLiveTip = sortedLive[0]
            const timeSinceLast = lastLiveTip
              ? parseFloat(((nowMs - new Date(lastLiveTip.timestamp).getTime()) / 60000).toFixed(1))
              : null

            const goalProgress = liveGoalTokens > 0
              ? Math.min(100, Math.round((totalTokens / liveGoalTokens) * 100))
              : 0

            const tpm = liveOnly.length > 0
              ? parseFloat((liveOnly.length / elapsedMins).toFixed(2))
              : 0
            const avgTip = liveOnly.length > 0
              ? parseFloat((liveOnly.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / liveOnly.length).toFixed(2))
              : 0

            // Pace uses only live events split into first/second half of elapsed time
            const midMs = startMs + (nowMs - startMs) / 2
            const fh = liveOnly.filter(e => new Date(e.timestamp).getTime() <= midMs)
            const sh = liveOnly.filter(e => new Date(e.timestamp).getTime() > midMs)
            const hm = elapsedMins / 2
            const fUPM = hm > 0 ? fh.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / hm : 0
            const sUPM = hm > 0 ? sh.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / hm : 0

            let pace = 'unknown'
            if (liveOnly.length >= 3 && elapsedMins >= 5) {
              if (sUPM > fUPM * 1.15)      pace = 'above'
              else if (sUPM < fUPM * 0.75) pace = 'below'
              else                          pace = 'on_track'
            }
            const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]
            return {
              totalRevenue:    parseFloat(totalRevenue.toFixed(2)),
              totalTokens,
              elapsedMins:     parseFloat(elapsedMins.toFixed(1)),
              tipsPerMinute:   tpm,
              avgTipValue:     avgTip,
              timeSinceLastTip: timeSinceLast,
              goalProgress,
              paceStatus:      pace,
              liveOnlyCount:   liveOnly.length,
              topTipper:       topEntry ? { username: topEntry[0], revenue: parseFloat(topEntry[1].toFixed(2)) } : null,
              firstHalfUPM:    parseFloat(fUPM.toFixed(3)),
              secondHalfUPM:   parseFloat(sUPM.toFixed(3)),
              currentUPM:      parseFloat((totalRevenue / elapsedMins).toFixed(3)),
            }
          }

          // Coaching cooldown helper — returns true if this alert can fire now.
          // Each key has its own cooldown window (in milliseconds).
          const canFireAlert = (key, cooldownMs) => {
            if (isHydratingHistory.current) return false
            const last = coachingCooldowns.current[key]
            if (!last || Date.now() - last > cooldownMs) {
              coachingCooldowns.current[key] = Date.now()
              return true
            }
            return false
          }

          // PRIORITY TIERS: CRITICAL → HIGH → MEDIUM → LOW → INFO
          // Only one alert per priority tier is shown at a time.
          // Cooldowns prevent the same signal from repeating within the window.
          const getAlerts = (state) => {
            if (!state || isHydratingHistory.current) return []
            if (!liveActive) return []

            const { timeSinceLastTip, paceStatus, goalProgress, topTipper,
                    totalRevenue, elapsedMins, liveOnlyCount } = state

            // Strategy-adjusted thresholds
            const deadAirCrit = liveStrategy === 'aggressive' ? 6 : 8
            const deadAirHigh = liveStrategy === 'aggressive' ? 4 : 5
            const goalPushPct = liveStrategy === 'aggressive' || liveStrategy === 'goal' ? 80 : 90

            const alerts = []

            // Helper: push to history log when an alert fires
            const logFired = (icon, text) => {
              firedAlertsLog.current.unshift({ icon, text, ts: Date.now() })
              if (firedAlertsLog.current.length > 20) firedAlertsLog.current.length = 20
            }

            // ── CRITICAL ─────────────────────────────────────────────────────────
            if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirCrit) {
              if (canFireAlert('dead_air_critical', 3 * 60 * 1000)) {
                const text = liveStrategy === 'whale' && topTipper
                  ? `${Math.round(timeSinceLastTip)} min silence — address ${topTipper.username} directly NOW`
                  : `No tips in ${Math.round(timeSinceLastTip)} min — call out names NOW`
                alerts.push({ priority: 1, level: 'critical', icon: '🚨', text })
                logFired('🚨', text)
              }
            }
            if (goalProgress >= goalPushPct && goalProgress < 100) {
              if (canFireAlert('goal_push', 4 * 60 * 1000)) {
                const text = `${goalProgress}% to goal — push NOW, announce the reward`
                alerts.push({ priority: 1, level: 'critical', icon: '🎯', text })
                logFired('🎯', text)
              }
            }

            // ── HIGH ─────────────────────────────────────────────────────────────
            if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirHigh && timeSinceLastTip < deadAirCrit) {
              if (canFireAlert('dead_air_high', 5 * 60 * 1000)) {
                const text = liveStrategy === 'engagement'
                  ? `${Math.round(timeSinceLastTip)} min quiet — drop a question or poll in chat now`
                  : liveStrategy === 'retention'
                  ? `${Math.round(timeSinceLastTip)} min since last tip — thank a viewer by name to re-engage`
                  : `${Math.round(timeSinceLastTip)} min silence — restart with a quick goal`
                alerts.push({ priority: 2, level: 'warning', icon: '⚠️', text })
                logFired('⚠️', text)
              }
            }
            if (paceStatus === 'below' && elapsedMins >= 8 && liveOnlyCount >= 3) {
              if (canFireAlert('pace_below', 5 * 60 * 1000)) {
                const text = liveStrategy === 'aggressive'
                  ? 'Pace slow — announce a limited-time exclusive offer right now'
                  : 'Pace dropping — activate toy or set a micro-goal'
                alerts.push({ priority: 2, level: 'warning', icon: '📉', text })
                logFired('📉', text)
              }
            }

            // ── Stream Fatigue ────────────────────────────────────────────────────
            if (elapsedMins > 75 && paceStatus === 'below' && liveOnlyCount >= 5) {
              if (canFireAlert('stream_fatigue', 15 * 60 * 1000)) {
                const text = 'Stream fatigue — try a new goal or content angle to reset room energy'
                alerts.push({ priority: 2, level: 'warning', icon: '😴', text })
                logFired('😴', text)
              }
            }

            // ── MEDIUM ────────────────────────────────────────────────────────────
            if (paceStatus === 'above' && elapsedMins >= 8 && liveOnlyCount >= 3) {
              if (canFireAlert('pace_above', 8 * 60 * 1000)) {
                const text = liveStrategy === 'aggressive'
                  ? 'Momentum is hot — raise your goal amount NOW while they are tipping'
                  : "Momentum building — don't break the energy"
                alerts.push({ priority: 3, level: 'success', icon: '🔥', text })
                logFired('🔥', text)
              }
            }
            if (goalProgress >= 100) {
              if (canFireAlert('goal_hit', 10 * 60 * 1000)) {
                const text = 'Goal hit! Set the next one immediately'
                alerts.push({ priority: 3, level: 'success', icon: '🎉', text })
                logFired('🎉', text)
              }
            }

            // ── Whale Proximity — regular tipper is overdue ───────────────────────
            if (liveOnlyCount >= 4 && liveStrategy !== 'engagement') {
              const nowMs = Date.now()
              const liveOnly = liveEvents.filter(e => !e._isHistory)
              const tipsByUser = {}
              for (const e of liveOnly) {
                if (!e.username) continue
                if (!tipsByUser[e.username]) tipsByUser[e.username] = []
                tipsByUser[e.username].push(new Date(e.timestamp).getTime())
              }
              let surfaced = false
              for (const [uname, times] of Object.entries(tipsByUser)) {
                if (surfaced || times.length < 2) continue
                const sorted = [...times].sort((a, b) => a - b)
                const gaps = []
                for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1])
                const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length
                const sinceLastMs = nowMs - sorted[sorted.length - 1]
                if (avgGapMs > 15 * 60 * 1000) continue // skip infrequent tippers
                const ratio = sinceLastMs / avgGapMs
                if (ratio >= 1.3 && sinceLastMs > 2 * 60 * 1000) {
                  if (canFireAlert(`whale_prox_${uname}`, 6 * 60 * 1000)) {
                    const avgMins = Math.round(avgGapMs / 60000)
                    const sinceMins = Math.round(sinceLastMs / 60000)
                    const text = `${uname} tips every ~${avgMins} min — ${sinceMins} min since their last. Call them out!`
                    alerts.push({ priority: 3, level: 'info', icon: '🐋', text })
                    logFired('🐋', text)
                    surfaced = true
                  }
                }
              }
            }

            // ── INFO ──────────────────────────────────────────────────────────────
            if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.45) {
              const key = `whale_dep_${topTipper.username}`
              if (canFireAlert(key, 10 * 60 * 1000)) {
                const text = `${topTipper.username} is ${Math.round(topTipper.revenue / totalRevenue * 100)}% of revenue — give them attention`
                alerts.push({ priority: 4, level: 'info', icon: '🐳', text })
                logFired('🐳', text)
              }
            }
            if (liveStrategy === 'engagement' && elapsedMins >= 5 && liveOnlyCount >= 1) {
              if (canFireAlert('engagement_tip', 7 * 60 * 1000)) {
                const text = 'Engagement mode: ask viewers a direct question to boost interaction'
                alerts.push({ priority: 4, level: 'info', icon: '💬', text })
                logFired('💬', text)
              }
            }
            if (liveStrategy === 'retention' && elapsedMins >= 10 && liveOnlyCount >= 2) {
              if (canFireAlert('retention_tip', 8 * 60 * 1000)) {
                const text = 'Retention mode: welcome regulars back by name — loyalty builds tip habits'
                alerts.push({ priority: 4, level: 'info', icon: '💜', text })
                logFired('💜', text)
              }
            }

            return alerts.sort((a, b) => a.priority - b.priority).slice(0, 4)
          }

          const getNextAction = (state) => {
            if (!state || !liveActive) return { text: 'Start your stream to get live coaching' }
            if (isHydratingHistory.current) return { text: 'Loading session data…' }

            const { timeSinceLastTip, paceStatus, goalProgress, topTipper,
                    totalRevenue, elapsedMins, liveOnlyCount } = state

            if (liveOnlyCount === 0)
              return { text: 'Waiting for your first tip this stream — set a goal to get things started.' }

            // ── Goal Focus ──────────────────────────────────────────────────────
            if (liveStrategy === 'goal') {
              if (goalProgress >= 100)
                return { text: 'Goal hit! Set the next one immediately — keep the momentum alive.' }
              if (goalProgress >= 75)
                return { text: `Announce your reward out loud — goal is at ${goalProgress}%. Tell chat exactly what happens when you hit it.` }
              return { text: `Keep mentioning the goal — you're at ${goalProgress}%. Every reminder drives more tips.` }
            }

            // ── Whale Focus ─────────────────────────────────────────────────────
            if (liveStrategy === 'whale') {
              if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.3)
                return { text: `Focus on ${topTipper.username} — give them a VIP experience. That's your highest-value tipper right now.` }
              if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
                return { text: 'Address your top tipper by name. VIP treatment keeps whales coming back.' }
              return { text: 'Whale mode: every tipper is a VIP. Personal attention creates repeat tips.' }
            }

            // ── Retention Focus ─────────────────────────────────────────────────
            if (liveStrategy === 'retention') {
              if (timeSinceLastTip !== null && timeSinceLastTip >= 5)
                return { text: 'Call out 3 viewer names right now — recognition keeps people in the room.' }
              if (topTipper)
                return { text: `Show ${topTipper.username} real appreciation — loyal fans tip again when they feel seen.` }
              return { text: 'Greet every viewer by name. Retention starts with acknowledgment.' }
            }

            // ── Engagement Focus ────────────────────────────────────────────────
            if (liveStrategy === 'engagement') {
              if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
                return { text: 'Drop a poll: "50 tokens or 100 tokens?" — interaction restarts the tipping cycle.' }
              return { text: 'Ask viewers a yes/no question in chat. Engagement always leads to tips.' }
            }

            // ── Aggressive ──────────────────────────────────────────────────────
            if (liveStrategy === 'aggressive') {
              if (goalProgress >= 80)
                return { text: `${goalProgress}% to goal — announce the reward NOW. Be loud about what happens when you hit it.` }
              if (paceStatus === 'above')
                return { text: 'Momentum is high — raise your goal amount RIGHT NOW while the room is hot.' }
              if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
                return { text: 'Push mode: "Next tip in 60 sec gets [reward]" — urgency creates action.' }
              return { text: 'Stay aggressive — set visible goals, announce rewards, push every 5 minutes.' }
            }

            // ── Balanced (default) ──────────────────────────────────────────────
            if (goalProgress >= 90 && goalProgress < 100)
              return { text: `Announce your reward out loud — goal is ${goalProgress}%. Tell chat exactly what happens when you hit it.` }
            if (timeSinceLastTip !== null && timeSinceLastTip >= 6)
              return { text: 'Say 3 names in chat right now. "I see [name] — tip to control what I do next."' }
            if (paceStatus === 'below' && elapsedMins >= 8)
              return { text: 'Set a small 50-token goal right now — micro-goals restart momentum when the room slows.' }
            if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.4)
              return { text: `Thank ${topTipper.username} by name and offer them something exclusive for their next tip.` }
            if (elapsedMins < 15 && liveOnlyCount < 3)
              return { text: 'Set a 200-token opening goal and announce it. Early goals train the room to tip.' }
            return { text: 'Keep energy high — acknowledge every tipper by name. Recognition drives repeat tipping.' }
          }

          // Add tip handler
          const addTip = () => {
            const { username, tokens, usd } = liveTipInput
            if (!username && !tokens && !usd) return
            const raw = {
              username: username || 'anonymous',
              tokens: parseInt(tokens) || 0,
              usd: parseFloat(usd) || 0,
              timestamp: new Date(),
              platform: livePlatform,
            }
            const normalized = normalizeTip(raw)
            setLiveEvents(prev => [...prev, normalized])
            setLiveTipInput({ username: '', tokens: '', usd: '' })
          }

          // liveTick is referenced here so the 1-second interval drives re-renders
          // which updates elapsed time, tips/min, pace, coaching, and all alerts
          void liveTick
          const state = computeState()

          // ── INTELLIGENCE LAYER — all analytics computed here, never inline ──
          const roomHealth      = computeRoomHealth(state)
          const sessionPhase    = detectSessionPhase(state, prevPhaseRef.current)
          const opportunityScore = computeOpportunityScore(state, roomHealth)
          const streamHealth    = computeStreamHealth(state, roomHealth, sessionPhase)
          const velocity        = computeRevenueVelocity(state?.currentUPM ?? 0, sessions)
          const comparison      = computeLiveComparison(state, sessions)
          const goalStrategy    = getGoalStrategy(state, roomHealth)
          const recoveryActions = getRecoveryActions(sessionPhase)
          const phaseConfig     = PHASES[sessionPhase] || PHASES.STARTUP
          // Track phase transitions
          if (sessionPhase !== prevPhaseRef.current) {
            if (prevPhaseRef.current !== null) {
              phaseChangeLog.current.unshift({ phase: sessionPhase, prev: prevPhaseRef.current, icon: phaseConfig.icon, label: phaseConfig.label, ts: Date.now() })
              if (phaseChangeLog.current.length > 10) phaseChangeLog.current.length = 10
            }
            prevPhaseRef.current = sessionPhase
          }

          const alerts     = getAlerts(state)
          const nextAction = getNextAction(state)

          const PACE_CONFIG = {
            above:    { label: '🔥 Hot', color: C.green,  bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
            on_track: { label: '✅ On Track', color: C.cyan, bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)' },
            below:    { label: '📉 Slow', color: C.red,   bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)' },
            unknown:  { label: '⏳ Starting', color: C.muted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
          }
          const ALERT_COLORS = { critical: C.red, warning: C.orange, success: C.green, info: C.cyan }
          const pace = PACE_CONFIG[state?.paceStatus || 'unknown']
          const inp2 = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: C.white, fontSize: 13, outline: 'none', width: '100%' }

          // Build revenue history from last 8 live events for sparklines
          const revenueHistory = [...liveEvents]
            .filter(e => !e._isHistory)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-8)
            .map(e => e.normalizedRevenue || 0)

          return (
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
              <style>{`
                @keyframes cc-slide-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
                @keyframes cc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
                @keyframes cc-glow { 0%,100%{box-shadow:0 0 8px currentColor;} 50%{box-shadow:0 0 18px currentColor;} }
                @keyframes cc-bar { from{opacity:0.4;} to{opacity:1;} }
              `}</style>
              {/* ── OPERATIONAL STATUS BAR ─────────────────────────────── */}
              <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(168,85,247,0.15)', marginBottom: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Extension', ok: liveEvents.some(e => e.sourceUsed === 'extension'), okText: 'Connected', offText: 'Not detected' },
                    { label: 'Realtime', ok: !!liveTipsChannelRef?.current, okText: 'Live', offText: 'Offline' },
                    { label: 'Sync', ok: liveActive, okText: 'Active', offText: 'Standby' },
                  ].map(({ label, ok, okText, offText }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? C.green : '#374151', boxShadow: ok ? `0 0 5px ${C.green}` : 'none', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                      <span style={{ fontSize: 11, color: ok ? C.green : '#475569', fontWeight: 600 }}>{ok ? okText : offText}</span>
                    </div>
                  ))}
                  {liveActive && state && (
                    <span style={{ fontSize: 11, color: C.muted }}>
                      Session: {Math.floor(state.elapsedMins)}m {Math.round((state.elapsedMins % 1) * 60)}s
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={livePlatform} onChange={e => setLivePlatform(e.target.value)} style={{ ...inp2, width: 'auto', padding: '5px 10px', fontSize: 12 }}>
                    {['Chaturbate','BongaCams','MyFreeCams','CamSoda','Stripchat'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="number" value={liveGoalTokens || ''} onChange={e => setLiveGoalTokens(Number(e.target.value)||0)} placeholder="Token goal" style={{ ...inp2, width: 120, padding: '5px 10px', fontSize: 12 }} />
                  <select value={liveStrategy} onChange={e => setLiveStrategy(e.target.value)} style={{ ...inp2, width: 'auto', padding: '5px 10px', fontSize: 12 }}>
                    <option value="balanced">⚖️ Balanced</option>
                    <option value="aggressive">💰 Aggressive</option>
                    <option value="retention">🔄 Retention</option>
                    <option value="engagement">💬 Engagement</option>
                    <option value="whale">🐋 Whale Focus</option>
                    <option value="goal">🎯 Goal Focus</option>
                  </select>
                  {!liveActive ? (
                    <button onClick={() => { setLiveActive(true); setLiveStartTime(new Date()); setLiveEvents([]); processedTipIds.current = new Set(); coachingCooldowns.current = {} }}
                      style={{ padding: '7px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 12, cursor: 'pointer', boxShadow: '0 0 16px rgba(16,185,129,0.35)' }}>
                      ▶ Start Stream
                    </button>
                  ) : (
                    <button onClick={() => setLiveActive(false)}
                      style={{ padding: '7px 18px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      ⏹ End
                    </button>
                  )}
                </div>

                {/* Intelligence strip — Room Health · Momentum · Opportunity · Stream Health · Velocity */}
                {liveActive && state && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {/* Room Health */}
                    <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: roomHealth.bg, border: `1px solid ${roomHealth.border}` }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Room Heat</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: roomHealth.color }}>{roomHealth.emoji} {roomHealth.label}</div>
                      <div style={{ fontSize: 10, color: roomHealth.directionColor, marginTop: 2 }}>{roomHealth.directionLabel}</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{roomHealth.confidence}% confidence</div>
                    </div>

                    {/* Opportunity Score */}
                    <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Opportunity</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: opportunityScore.color }}>{opportunityScore.score}<span style={{ fontSize: 11, fontWeight: 400 }}>/100</span></div>
                      <div style={{ fontSize: 10, color: opportunityScore.color, marginTop: 2 }}>{opportunityScore.label}</div>
                    </div>

                    {/* Stream Health */}
                    <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Stream Health</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: streamHealth.grade === 'A' ? C.green : streamHealth.grade === 'B' ? C.cyan : streamHealth.grade === 'C' ? C.gold : C.red }}>{streamHealth.grade}</span>
                        <span style={{ fontSize: 13, color: C.muted }}>{streamHealth.score}/100</span>
                      </div>
                      <div style={{ fontSize: 10, color: streamHealth.trend === 'improving' ? C.green : streamHealth.trend === 'declining' ? C.red : C.muted, marginTop: 2, textTransform: 'capitalize' }}>{streamHealth.trend}</div>
                    </div>

                    {/* Revenue Velocity */}
                    <div style={{ flex: '1 1 160px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Revenue Velocity</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: velocity.color }}>${velocity.currentUPH.toFixed(2)}/hr</div>
                      <div style={{ fontSize: 10, color: velocity.color, marginTop: 2 }}>{velocity.label}</div>
                    </div>

                    {/* Live Comparison */}
                    {comparison.vsAvgPct !== null && (
                      <div style={{ flex: '1 1 140px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>vs Your Average</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: (comparison.vsAvgPct ?? 0) >= 0 ? C.green : C.red }}>
                          {(comparison.vsAvgPct ?? 0) >= 0 ? '+' : ''}{comparison.vsAvgPct}%
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>avg ${comparison.avgUPH.toFixed(2)}/hr</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Not started */}
              {!liveActive && !liveEvents.length && (
                <div style={{ ...glassCard, borderRadius: 20, padding: '64px 48px', textAlign: 'center', marginBottom: 24, background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.06), rgba(34,211,238,0.05))', backgroundSize: '300% 300%', animation: 'cc-bar 4s ease infinite alternate', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)', animation: 'cc-bar 2s ease infinite alternate' }} />
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🔴</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 10 }}>Live Command Center</div>
                  <div style={{ fontSize: 14, color: C.muted, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.75 }}>
                    Your AI coach watches the room in real time — tracking momentum, spotting opportunities, and telling you exactly what to do next to make more money.
                  </div>
                  <button onClick={() => { setLiveActive(true); setLiveStartTime(new Date()); setLiveEvents([]); processedTipIds.current = new Set(); coachingCooldowns.current = {} }}
                    style={{ padding: '13px 36px', borderRadius: 12, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 32px rgba(16,185,129,0.4)' }}>
                    ▶ Start Streaming
                  </button>
                </div>
              )}

              {(liveActive || liveEvents.length > 0) && (
                <div>

                  {/* ── ROOM STATE HERO ────────────────────────────────── */}
                  {(() => {
                    const rhKey = roomHealth.state || 'COLD'
                    const rhMap = {
                      COLD:      { from: 'rgba(15,20,35,0.97)',  to: 'rgba(20,28,48,0.97)',  glow: 'rgba(30,40,80,0.2)',    pulse: 'none' },
                      WARMING:   { from: 'rgba(14,28,55,0.97)',  to: 'rgba(20,40,70,0.97)',  glow: 'rgba(34,211,238,0.12)', pulse: '3s' },
                      ACTIVE:    { from: 'rgba(16,30,62,0.97)',  to: 'rgba(26,52,90,0.97)',  glow: 'rgba(34,211,238,0.22)', pulse: '2s' },
                      HOT:       { from: 'rgba(38,16,72,0.97)',  to: 'rgba(58,22,92,0.97)',  glow: 'rgba(168,85,247,0.32)', pulse: '1.5s' },
                      EXPLOSIVE: { from: 'rgba(60,12,28,0.98)',  to: 'rgba(88,18,38,0.98)',  glow: 'rgba(248,113,113,0.42)', pulse: '0.9s' },
                    }
                    const rg = rhMap[rhKey] || rhMap.COLD
                    return (
                      <div style={{ borderRadius: 16, padding: '22px 28px', marginBottom: 20, background: `linear-gradient(135deg, ${rg.from}, ${rg.to})`, border: `1px solid ${roomHealth.border}`, boxShadow: `0 0 48px ${rg.glow}`, position: 'relative', overflow: 'hidden', transition: 'all 1.2s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: liveActive ? C.green : C.muted, boxShadow: liveActive ? `0 0 12px ${C.green}` : 'none', animation: liveActive ? 'cc-pulse 1.2s ease-in-out infinite' : 'none', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 3 }}>Room State</div>
                              <div style={{ fontSize: 30, fontWeight: 900, color: roomHealth.color, letterSpacing: -0.5 }}>{roomHealth.emoji} {roomHealth.label}</div>
                            </div>
                            {liveActive && state && (
                              <div style={{ padding: '6px 14px', borderRadius: 20, background: phaseConfig.bg, border: `1px solid ${phaseConfig.border}`, fontSize: 12, fontWeight: 700, color: phaseConfig.color }}>
                                {phaseConfig.icon} {phaseConfig.label}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                            {[
                              { label: 'Revenue', value: `$${state?.totalRevenue?.toFixed(2) || '0.00'}`, color: C.green, size: 28 },
                              { label: 'Tokens', value: (state?.totalTokens || 0).toLocaleString(), color: C.cyan, size: 22 },
                              { label: 'Pace', value: pace.label, color: pace.color, size: 18 },
                              { label: 'Opportunity', value: `${opportunityScore.score}/100`, color: opportunityScore.color, size: 22 },
                              ...(comparison.vsAvgPct !== null ? [{ label: 'vs Avg', value: `${(comparison.vsAvgPct ?? 0) >= 0 ? '+' : ''}${comparison.vsAvgPct}%`, color: (comparison.vsAvgPct ?? 0) >= 0 ? C.green : C.red, size: 20 }] : []),
                            ].map(({ label, value, color, size }) => (
                              <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
                                <div style={{ fontSize: size, fontWeight: 900, color }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {liveActive && state && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Room momentum</span>
                              <span style={{ fontSize: 9, color: roomHealth.directionColor }}>{roomHealth.directionLabel}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${roomHealth.score || 0}%`, borderRadius: 2, background: `linear-gradient(90deg, ${roomHealth.color}, ${C.cyan})`, transition: 'width 1.5s ease' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── AI COACH CENTERPIECE ────────────────────────────── */}
                  {(() => {
                    const topAlert = alerts[0]
                    const restAlerts = alerts.slice(1)
                    const urgencyMap = {
                      critical: { bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.38)', badge: 'rgba(248,113,113,0.22)', badgeText: C.red, tag: '🚨 CRITICAL ACTION' },
                      warning:  { bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.38)',  badge: 'rgba(245,158,11,0.22)',  badgeText: C.gold, tag: '⚠️ ALERT' },
                      success:  { bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.38)',  badge: 'rgba(16,185,129,0.22)',  badgeText: C.green, tag: '🔥 MOMENTUM' },
                      info:     { bg: 'rgba(34,211,238,0.09)',  border: 'rgba(34,211,238,0.38)',  badge: 'rgba(34,211,238,0.22)',  badgeText: C.cyan, tag: '💡 INSIGHT' },
                    }
                    const uc = topAlert ? (urgencyMap[topAlert.level] || urgencyMap.info) : null
                    const defaultStyle = { bg: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(124,92,255,0.1))', border: 'rgba(168,85,247,0.3)', badge: 'rgba(236,72,153,0.2)', badgeText: C.pink, tag: '⚡ DO THIS NOW' }
                    const style = uc || defaultStyle
                    return (
                      <div style={{ borderRadius: 16, padding: '26px 28px', marginBottom: 20, background: topAlert ? style.bg : defaultStyle.bg, border: `1px solid ${topAlert ? style.border : defaultStyle.border}`, boxShadow: topAlert?.level === 'critical' ? '0 0 32px rgba(248,113,113,0.12)' : 'none', animation: topAlert?.level === 'critical' ? 'cc-glow 2.5s ease-in-out infinite' : 'none', position: 'relative', overflow: 'hidden' }}>
                        {/* Animated gradient line at top */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ec4899, #a855f7, #22d3ee)', backgroundSize: '200% 100%', animation: 'cc-bar 2s ease infinite alternate' }} />
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <div style={{ padding: '3px 10px', borderRadius: 6, background: topAlert ? style.badge : defaultStyle.badge, fontSize: 10, fontWeight: 800, color: topAlert ? style.badgeText : defaultStyle.badgeText, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                {topAlert ? style.tag : defaultStyle.tag}
                              </div>
                              <div style={{ fontSize: 10, color: C.muted }}>AI Coach · {liveStrategy} mode</div>
                            </div>
                            <div style={{ fontSize: 19, fontWeight: 700, color: C.white, lineHeight: 1.65, marginBottom: topAlert && nextAction.text !== topAlert.text ? 12 : 0 }}>
                              {topAlert ? topAlert.text : nextAction.text}
                            </div>
                            {topAlert && nextAction.text !== topAlert.text && (
                              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                                <span style={{ color: topAlert ? style.badgeText : C.pink, fontWeight: 700 }}>Next: </span>{nextAction.text}
                              </div>
                            )}
                          </div>
                          {liveActive && state && goalStrategy && (
                            <div style={{ minWidth: 170, padding: '14px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Goal Push Probability</div>
                              <div style={{ fontSize: 30, fontWeight: 900, color: goalStrategy.probability >= 70 ? C.green : goalStrategy.probability >= 40 ? C.gold : C.red, marginBottom: 6 }}>{goalStrategy.probability}%</div>
                              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
                                <div style={{ height: '100%', width: `${goalStrategy.probability}%`, borderRadius: 2, background: goalStrategy.probability >= 70 ? `linear-gradient(90deg, ${C.green}, ${C.cyan})` : `linear-gradient(90deg, ${C.gold}, ${C.orange})`, transition: 'width 0.5s ease' }} />
                              </div>
                              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{goalStrategy.suggestion}</div>
                            </div>
                          )}
                        </div>
                        {restAlerts.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                            {restAlerts.map((a, i) => (
                              <div key={i} style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 9, background: `${ALERT_COLORS[a.level]}10`, border: `1px solid ${ALERT_COLORS[a.level]}28`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                                <span style={{ fontSize: 12, color: ALERT_COLORS[a.level], fontWeight: 600, lineHeight: 1.4 }}>{a.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── MAIN GRID ─────────────────────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20, marginBottom: 20 }}>

                    {/* LEFT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                      {/* MONEY MOMENTUM — 4 stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[
                          { label: 'Revenue', value: `$${state?.totalRevenue?.toFixed(2) || '0.00'}`, color: C.green, sub: velocity.label || null, showSparkline: true },
                          { label: 'Tips/min', value: state?.tipsPerMinute?.toFixed(2) || '0.00', color: C.cyan, sub: `${state?.liveOnlyCount || 0} tips live`, showSparkline: false },
                          { label: 'Avg Tip', value: `$${state?.avgTipValue?.toFixed(2) || '0.00'}`, color: C.gold, sub: state?.topTipper ? `Top: ${state.topTipper.username}` : null, showSparkline: false },
                          { label: 'Rev/hr', value: `$${velocity.currentUPH.toFixed(0)}`, color: velocity.color, sub: comparison.vsAvgPct !== null ? `${(comparison.vsAvgPct ?? 0) >= 0 ? '+' : ''}${comparison.vsAvgPct}% vs avg` : null, showSparkline: false },
                        ].map(({ label, value, color, sub, showSparkline }) => (
                          <div key={label} style={{ ...glassCard, borderRadius: 12, padding: '18px', transition: 'box-shadow 0.2s ease', cursor: 'default' }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 20px ${color}28` }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = '' }}>
                            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                            {showSparkline && revenueHistory.length >= 2 && (() => {
                              const d = revenueHistory, w = 72, h = 28
                              const mx = Math.max(...d), mn = Math.min(...d), rng = mx - mn || 1
                              const pts = d.map((v, i) => `${(i/(d.length-1))*w},${h-((v-mn)/rng)*h}`).join(' ')
                              return <svg width={w} height={h} style={{ display:'block', overflow:'visible', marginTop: 4 }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
                            })()}
                            {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
                          </div>
                        ))}
                      </div>

                      {/* PACE + GOAL */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ borderRadius: 12, padding: '14px 18px', background: pace.bg, border: `1px solid ${pace.border}` }}>
                          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Pace</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: pace.color }}>{pace.label}</div>
                          {state?.firstHalfUPM > 0 && (
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>1st: ${state.firstHalfUPM.toFixed(2)}/m → 2nd: ${state.secondHalfUPM.toFixed(2)}/m</div>
                          )}
                        </div>
                        <div style={{ ...glassCard, borderRadius: 12, padding: '14px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Goal</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: (state?.goalProgress || 0) >= 100 ? C.green : C.white }}>{state?.goalProgress || 0}%</div>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{ height: '100%', width: `${Math.min(state?.goalProgress || 0, 100)}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`, transition: 'width 0.5s ease' }} />
                          </div>
                          {liveGoalTokens > 0 && state && <div style={{ fontSize: 10, color: C.muted }}>{state.totalTokens} / {liveGoalTokens} tokens</div>}
                        </div>
                      </div>

                      {/* TIP INPUT — collapsible */}
                      {liveActive && (
                        <details style={{ ...glassCard, borderRadius: 12 }}>
                          <summary style={{ padding: '11px 16px', cursor: 'pointer', fontSize: 12, color: C.muted, userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>＋</span> Log a tip manually
                          </summary>
                          <div style={{ padding: '0 16px 14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                              <input placeholder="Username" value={liveTipInput.username} onChange={e => setLiveTipInput(p => ({ ...p, username: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTip()} style={inp2} />
                              <input type="number" placeholder="Tokens" value={liveTipInput.tokens} onChange={e => setLiveTipInput(p => ({ ...p, tokens: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTip()} style={inp2} />
                              <input type="number" placeholder="USD" value={liveTipInput.usd} onChange={e => setLiveTipInput(p => ({ ...p, usd: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTip()} style={inp2} />
                              <button onClick={addTip} style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', border: 'none', color: C.white, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
                            </div>
                          </div>
                        </details>
                      )}

                      {/* LIVE EVENT FEED */}
                      {liveEvents.length > 0 && (
                        <div style={{ ...glassCard, borderRadius: 12, padding: 16, flex: 1 }}>
                          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                            Live Event Feed
                            <span style={{ marginLeft: 8, color: C.dim, fontWeight: 400, textTransform: 'none', fontSize: 10, letterSpacing: 0 }}>— {liveEvents.filter(e => !e._isHistory).length} live tips</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
                            {[...liveEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((ev, i) => {
                              const isFlash = ev._id && ev._id === flashTipId
                              const isNew = i === 0 && !ev._isHistory
                              const isBig = (ev.normalizedRevenue || 0) >= 5
                              return (
                                <div key={ev._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 9, background: isFlash ? 'rgba(168,85,247,0.18)' : isNew ? 'rgba(34,211,238,0.07)' : isBig ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', border: isFlash ? '1px solid rgba(168,85,247,0.5)' : isNew ? '1px solid rgba(34,211,238,0.18)' : isBig ? '1px solid rgba(245,158,11,0.18)' : '1px solid rgba(255,255,255,0.04)', boxShadow: isFlash ? '0 0 16px rgba(168,85,247,0.25)' : 'none', transition: 'all 0.35s ease', opacity: ev._isHistory ? 0.55 : 1, animation: isNew ? 'cc-slide-in 0.35s ease' : 'none' }}>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <span style={{ fontSize: 14 }}>{isBig ? '🐋' : '💰'}</span>
                                    <div>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: isFlash ? '#c084fc' : C.white }}>{ev.username}</span>
                                      {ev._isHistory && <span style={{ fontSize: 9, color: C.dim, marginLeft: 6 }}>history</span>}
                                      {isFlash && <span style={{ fontSize: 10, color: '#c084fc', marginLeft: 8, fontWeight: 800 }}>NEW ✨</span>}
                                    </div>
                                    {ev.tokens > 0 && <span style={{ fontSize: 11, color: C.cyan }}>{ev.tokens}t</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <span style={{ fontSize: 15, fontWeight: 800, color: isBig ? C.gold : C.green }}>${(ev.normalizedRevenue || 0).toFixed(2)}</span>
                                    <span style={{ fontSize: 9, color: C.muted }}>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                      {/* STREAM HEALTH */}
                      {liveActive && state && (
                        <div style={{ ...glassCard, borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Stream Health</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 26, fontWeight: 900, color: streamHealth.grade === 'A' ? C.green : streamHealth.grade === 'B' ? C.cyan : streamHealth.grade === 'C' ? C.gold : C.red }}>{streamHealth.grade}</span>
                              <span style={{ fontSize: 11, color: C.muted }}>{streamHealth.score}/100</span>
                            </div>
                          </div>
                          {[
                            { label: 'Momentum',  value: streamHealth.components.momentum,   max: 30, color: C.green },
                            { label: 'Engagement',value: streamHealth.components.engagement,  max: 30, color: C.cyan },
                            { label: 'Velocity',  value: streamHealth.components.velocity,    max: 25, color: C.gold },
                            { label: 'Recovery',  value: streamHealth.components.recovery,    max: 15, color: '#a855f7' },
                          ].map(({ label, value, max, color }) => (
                            <div key={label} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
                                <span style={{ fontSize: 10, color, fontWeight: 700 }}>{value}/{max}</span>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(value / max) * 100}%`, borderRadius: 2, background: color, transition: 'width 0.4s ease' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* RECOVERY ACTIONS */}
                      {liveActive && state && (sessionPhase === 'DECLINE' || sessionPhase === 'PLATEAU' || sessionPhase === 'RECOVERY') && (
                        <div style={{ borderRadius: 14, padding: '16px 18px', background: sessionPhase === 'DECLINE' ? 'rgba(248,113,113,0.07)' : sessionPhase === 'RECOVERY' ? 'rgba(168,85,247,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${sessionPhase === 'DECLINE' ? 'rgba(248,113,113,0.3)' : sessionPhase === 'RECOVERY' ? 'rgba(168,85,247,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                          <div style={{ fontSize: 9, color: sessionPhase === 'DECLINE' ? C.red : sessionPhase === 'RECOVERY' ? '#a855f7' : C.gold, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>
                            {sessionPhase === 'DECLINE' ? '🚨 Recovery Actions' : sessionPhase === 'RECOVERY' ? '🔄 Rebuilding' : '📊 Boost Tactics'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {recoveryActions.map((action, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: 11, color: sessionPhase === 'DECLINE' ? C.red : sessionPhase === 'RECOVERY' ? '#a855f7' : C.gold, flexShrink: 0, fontWeight: 800 }}>{i + 1}.</span>
                                <span style={{ fontSize: 11, color: C.white, lineHeight: 1.5 }}>{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* OPPORTUNITY SIGNALS */}
                      {liveActive && state && opportunityScore.signals.length > 0 && (
                        <div style={{ ...glassCard, borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Why These Alerts?</div>
                            <div style={{ padding: '2px 8px', borderRadius: 6, background: `${opportunityScore.color}18`, fontSize: 11, fontWeight: 800, color: opportunityScore.color }}>{opportunityScore.score}/100</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {opportunityScore.signals.map((sig, i) => (
                              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                <span style={{ color: opportunityScore.color, fontSize: 12, flexShrink: 0 }}>→</span>
                                <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{sig}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* EXTENSION STATUS */}
                      <div style={{ borderRadius: 12, padding: '14px 16px', background: liveEvents.some(e => e.sourceUsed === 'extension') ? 'rgba(16,185,129,0.07)' : 'rgba(124,92,255,0.07)', border: `1px solid ${liveEvents.some(e => e.sourceUsed === 'extension') ? 'rgba(16,185,129,0.22)' : 'rgba(124,92,255,0.2)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: liveEvents.some(e => e.sourceUsed === 'extension') ? C.green : C.muted, boxShadow: liveEvents.some(e => e.sourceUsed === 'extension') ? `0 0 6px ${C.green}` : 'none' }} />
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
                            {liveEvents.some(e => e.sourceUsed === 'extension') ? 'Extension Auto-Capturing' : 'Auto-capture tips'}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
                          {liveEvents.some(e => e.sourceUsed === 'extension')
                            ? `${liveEvents.filter(e => e.sourceUsed === 'extension').length} tips captured automatically`
                            : 'Install the CamCash Chrome extension — tips appear here automatically.'}
                        </div>
                        {!liveEvents.some(e => e.sourceUsed === 'extension') && (
                          <a href="/extension" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '6px 14px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>📥 Get Extension →</a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── BOTTOM PANELS ─────────────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

                    {/* SESSION TIMELINE */}
                    {liveActive && (liveEvents.length > 0 || phaseChangeLog.current.length > 0) && (() => {
                      const tipEntries = liveEvents.filter(e => !e._isHistory).map(e => ({ type: 'tip', ts: new Date(e.timestamp).getTime(), icon: (e.normalizedRevenue || 0) >= 5 ? '🐋' : '💰', text: `${e.username} — ${e.tokens > 0 ? e.tokens + 't' : ''} $${(e.normalizedRevenue || 0).toFixed(2)}`, color: (e.normalizedRevenue || 0) >= 5 ? C.gold : C.green }))
                      const phaseEntries = phaseChangeLog.current.map(p => ({ type: 'phase', ts: p.ts, icon: p.icon, text: `Phase → ${p.label}`, color: C.cyan }))
                      const alertEntries = firedAlertsLog.current.slice(0, 6).map(a => ({ type: 'alert', ts: a.ts, icon: a.icon, text: a.text, color: C.muted }))
                      const merged = [...tipEntries, ...phaseEntries, ...alertEntries].sort((a, b) => b.ts - a.ts).slice(0, 20)
                      return (
                        <div style={{ ...glassCard, borderRadius: 14, padding: 18 }}>
                          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>⏱ Session Timeline</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                            {merged.length === 0 ? (
                              <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '12px 0' }}>Events will appear here as your session unfolds</div>
                            ) : merged.map((entry, i) => (
                              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 8px', borderRadius: 7, background: i === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                                <span style={{ fontSize: 13, flexShrink: 0 }}>{entry.icon}</span>
                                <span style={{ fontSize: 11, color: entry.color, flex: 1, lineHeight: 1.4 }}>{entry.text}</span>
                                <span style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>{new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* ALERT HISTORY */}
                    {liveActive && firedAlertsLog.current.length > 0 && (
                      <div style={{ ...glassCard, borderRadius: 14, padding: 18 }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>📋 Alert History</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                          {firedAlertsLog.current.slice(0, 15).map((entry, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.02)' }}>
                              <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>{entry.icon}</span>
                              <span style={{ fontSize: 11, color: C.text, flex: 1, lineHeight: 1.4 }}>{entry.text}</span>
                              <span style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap', marginTop: 1 }}>{new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}
            </div>
          )
}
