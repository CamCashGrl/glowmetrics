// Single source of truth for Live Mode coaching triggers — the server-side
// port of app/live/page.js's former getAlerts(). Exact same 9 trigger
// rules, exact same thresholds, priorities, and cooldown durations,
// reproduced verbatim so behavior doesn't silently drift from what's
// already been live and tested. Do not duplicate these thresholds anywhere
// else — import this module instead.
//
// Both the website (app/api/live/coaching/route.js) and, indirectly, the
// Chrome extension (which calls the same route) evaluate through this one
// module, so they always get identical results for the same session state
// and coaching_strategy.

// Fixed rule-evaluation order, matching the exact declaration sequence in
// the original getAlerts() — used as the tie-breaker when two triggers
// qualify with the same priority number in the same evaluation, so ties
// resolve exactly the way today's stable-sort-by-insertion-order does.
export const TRIGGER_RULE_ORDER = [
  'dead_air_critical', 'goal_push', 'dead_air_high', 'pace_below',
  'stream_fatigue', 'pace_above', 'goal_hit', 'whale_prox', 'whale_dep',
];

// type -> { category, cooldownSeconds } — cooldownSeconds doubles as the
// expires_at duration (see migration comment): one canonical number per
// trigger, not two.
export const TRIGGER_META = {
  dead_air_critical: { category: 'room_recovery',       cooldownSeconds: 3 * 60 },
  goal_push:         { category: 'goal_momentum',       cooldownSeconds: 4 * 60 },
  dead_air_high:     { category: 'room_recovery',       cooldownSeconds: 5 * 60 },
  pace_below:        { category: 'pace_management',     cooldownSeconds: 5 * 60 },
  stream_fatigue:    { category: 'room_recovery',       cooldownSeconds: 15 * 60 },
  pace_above:        { category: 'pace_management',     cooldownSeconds: 8 * 60 },
  goal_hit:          { category: 'goal_momentum',       cooldownSeconds: 10 * 60 },
  whale_prox:        { category: 'supporter_engagement', cooldownSeconds: 6 * 60 },
  whale_dep:         { category: 'supporter_engagement', cooldownSeconds: 10 * 60 },
};

// Server-side equivalent of app/live/page.js's computeState(), operating on
// live_tips rows already scoped to one session (via live_session_id) rather
// than a client-held liveEvents array. Because the tips are already
// session-scoped by the caller's query, there's no separate "history vs
// live-only" split needed here — every row passed in IS this session's live
// activity, unlike the client's 12h-hydration-window liveEvents array.
export function computeCoachingState({ tips, startedAt, goalTokens, now = Date.now() }) {
  if (!tips.length) return null;

  const startMs = new Date(startedAt).getTime();
  const elapsedMins = Math.max((now - startMs) / 60000, 0.1);

  let totalRevenue = 0;
  let totalTokens = 0;
  const tipperMap = {};
  for (const t of tips) {
    const usd = Number(t.usd) || 0;
    totalRevenue += usd;
    totalTokens += Number(t.tokens) || 0;
    tipperMap[t.username] = (tipperMap[t.username] || 0) + usd;
  }

  const sorted = [...tips].sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
  const lastTip = sorted[0];
  const timeSinceLastTip = lastTip
    ? parseFloat(((now - new Date(lastTip.received_at).getTime()) / 60000).toFixed(1))
    : null;

  const goalProgress = goalTokens > 0 ? Math.min(100, Math.round((totalTokens / goalTokens) * 100)) : 0;

  const midMs = startMs + (now - startMs) / 2;
  const firstHalf = tips.filter((t) => new Date(t.received_at).getTime() <= midMs);
  const secondHalf = tips.filter((t) => new Date(t.received_at).getTime() > midMs);
  const halfMins = elapsedMins / 2;
  const fUPM = halfMins > 0 ? firstHalf.reduce((s, t) => s + (Number(t.usd) || 0), 0) / halfMins : 0;
  const sUPM = halfMins > 0 ? secondHalf.reduce((s, t) => s + (Number(t.usd) || 0), 0) / halfMins : 0;

  let paceStatus = 'unknown';
  if (tips.length >= 3 && elapsedMins >= 5) {
    if (sUPM > fUPM * 1.15) paceStatus = 'above';
    else if (sUPM < fUPM * 0.75) paceStatus = 'below';
    else paceStatus = 'on_track';
  }

  const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0];

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalTokens,
    elapsedMins: parseFloat(elapsedMins.toFixed(1)),
    timeSinceLastTip,
    goalProgress,
    paceStatus,
    liveOnlyCount: tips.length,
    topTipper: topEntry ? { username: topEntry[0], revenue: parseFloat(topEntry[1].toFixed(2)) } : null,
  };
}

// Presentation-only metadata (icon/level for UI styling) keyed by type —
// not persisted as DB columns since they're pure display concerns, easily
// re-derived from the type string already stored on every coaching_events
// row. Kept here, not duplicated in page.js/popup.js, so both surfaces
// that want to style a prompt use the same mapping.
export const TRIGGER_ICON = {
  dead_air_critical: '🚨', goal_push: '🎯', dead_air_high: '⚠️',
  pace_below: '📉', stream_fatigue: '😴', pace_above: '🔥',
  goal_hit: '🎉', whale_prox: '🐋', whale_dep: '🐳',
};
export const TRIGGER_LEVEL = {
  dead_air_critical: 'critical', goal_push: 'critical', dead_air_high: 'warning',
  pace_below: 'warning', stream_fatigue: 'warning', pace_above: 'success',
  goal_hit: 'success', whale_prox: 'info', whale_dep: 'info',
};

// Returns every currently-qualifying trigger (not just the winner) in fixed
// rule order — the caller picks the single active one via
// selectPrimaryTrigger() below. tips must already be session-scoped.
//
// now defaults to Date.now() so real callers (route.js) behave exactly as
// before — but whale_prox's "time since this tipper's last tip" check reads
// from this same value instead of calling Date.now() itself, so it can
// never drift from the clock computeCoachingState was evaluated against,
// and both are deterministically testable together.
export function evaluateCoachingTriggers({ state, tips, strategy, now = Date.now() }) {
  if (!state) return [];
  const { timeSinceLastTip, paceStatus, goalProgress, topTipper, totalRevenue, elapsedMins, liveOnlyCount } = state;

  const deadAirCrit = strategy === 'aggressive' ? 6 : 8;
  const deadAirHigh = strategy === 'aggressive' ? 4 : 5;
  const goalPushPct = strategy === 'aggressive' || strategy === 'goal' ? 80 : 90;

  const fired = [];

  if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirCrit) {
    const context = `No tips in ${Math.round(timeSinceLastTip)} minutes`;
    const action = strategy === 'whale' && topTipper
      ? `Address ${topTipper.username} directly — call them out by name right now`
      : `Start a 2,000 token room goal and ask viewers to vote on the reward`;
    fired.push({
      type: 'dead_air_critical', priority: 1, dedupeKey: 'dead_air_critical',
      title: context, message: `${context} — ${action}`, compactMessage: action,
      icon: '🚨', level: 'critical',
    });
  }

  if (goalProgress >= goalPushPct && goalProgress < 100) {
    const context = `Goal is at ${goalProgress}% — the room is primed`;
    const action = `Announce your reward out loud right now and keep the energy high`;
    fired.push({
      type: 'goal_push', priority: 1, dedupeKey: 'goal_push',
      title: context, message: `${context} — ${action}`, compactMessage: `${goalProgress}% to goal — push NOW, announce the reward`,
      icon: '🎯', level: 'critical',
    });
  }

  if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirHigh && timeSinceLastTip < deadAirCrit) {
    const context = `${Math.round(timeSinceLastTip)} minutes since your last tip`;
    const action = strategy === 'engagement'
      ? `Drop a poll in chat — "50 tokens or 100 tokens?" restarts the tipping cycle`
      : strategy === 'retention'
      ? `Thank a viewer by name — recognition re-engages the room`
      : `Start a quick 200-token goal right now`;
    fired.push({
      type: 'dead_air_high', priority: 2, dedupeKey: 'dead_air_high',
      title: context, message: `${context} — ${action}`, compactMessage: `${Math.round(timeSinceLastTip)} min since last tip — ${action}`,
      icon: '⚠️', level: 'warning',
    });
  }

  if (paceStatus === 'below' && elapsedMins >= 8 && liveOnlyCount >= 3) {
    const context = `Revenue pace is below your normal rate`;
    const action = strategy === 'aggressive'
      ? `Announce a limited-time exclusive offer right now`
      : `Activate toy or set a micro-goal to restart momentum`;
    fired.push({
      type: 'pace_below', priority: 2, dedupeKey: 'pace_below',
      title: context, message: `${context} — ${action}`, compactMessage: `Pace dropping — ${action}`,
      icon: '📉', level: 'warning',
    });
  }

  if (elapsedMins > 75 && paceStatus === 'below' && liveOnlyCount >= 5) {
    const context = `${Math.round(elapsedMins)} minutes in and tip rate is dropping`;
    const action = `Try a new goal or content angle to reset room energy`;
    fired.push({
      type: 'stream_fatigue', priority: 2, dedupeKey: 'stream_fatigue',
      title: context, message: `${context} — ${action}`, compactMessage: `Stream fatigue — ${action}`,
      icon: '😴', level: 'warning',
    });
  }

  if (paceStatus === 'above' && elapsedMins >= 8 && liveOnlyCount >= 3) {
    const context = `Tip frequency is up — room energy is above your normal pace`;
    const action = strategy === 'aggressive'
      ? `Raise your goal amount RIGHT NOW while the room is hot`
      : `Don't break the energy — keep doing exactly what you're doing`;
    const compactMessage = strategy === 'aggressive' ? `Momentum is hot — ${action}` : `Momentum building — ${action}`;
    fired.push({
      type: 'pace_above', priority: 3, dedupeKey: 'pace_above',
      title: context, message: `${context} — ${action}`, compactMessage,
      icon: '🔥', level: 'success',
    });
  }

  if (goalProgress >= 100) {
    const context = `You just hit your room goal!`;
    const action = `Set the next goal immediately — momentum drops if there's nothing to tip toward`;
    fired.push({
      type: 'goal_hit', priority: 3, dedupeKey: 'goal_hit',
      title: context, message: `${context} ${action}`, compactMessage: `Goal hit! ${action}`,
      icon: '🎉', level: 'success',
    });
  }

  if (liveOnlyCount >= 4 && strategy !== 'engagement') {
    const tipsByUser = {};
    for (const t of tips) {
      if (!t.username) continue;
      if (!tipsByUser[t.username]) tipsByUser[t.username] = [];
      tipsByUser[t.username].push(new Date(t.received_at).getTime());
    }
    for (const [uname, times] of Object.entries(tipsByUser)) {
      if (times.length < 2) continue;
      const sortedTimes = [...times].sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sortedTimes.length; i++) gaps.push(sortedTimes[i] - sortedTimes[i - 1]);
      const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const sinceLastMs = now - sortedTimes[sortedTimes.length - 1];
      if (avgGapMs > 15 * 60 * 1000) continue;
      const ratio = sinceLastMs / avgGapMs;
      if (ratio >= 1.3 && sinceLastMs > 2 * 60 * 1000) {
        const avgMins = Math.round(avgGapMs / 60000);
        const sinceMins = Math.round(sinceLastMs / 60000);
        const context = `${uname} usually tips every ~${avgMins} minutes`;
        const action = `${sinceMins} min since their last tip — call them out right now!`;
        fired.push({
          type: 'whale_prox', priority: 3, dedupeKey: `whale_prox_${uname}`,
          title: context, message: `${context} — ${action}`,
          compactMessage: `${uname} tips every ~${avgMins} min — ${sinceMins} min since their last. Call them out!`,
          icon: '🐋', level: 'info',
          relatedTipperId: uname, relatedTipperName: uname,
        });
        break; // only the first qualifying tipper per evaluation, matching the original's `surfaced` flag
      }
    }
  }

  if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.45) {
    const pctStr = Math.round((topTipper.revenue / totalRevenue) * 100);
    const context = `${topTipper.username} is ${pctStr}% of your session revenue`;
    const action = `Give them personal attention and an exclusive offer for their next tip`;
    fired.push({
      type: 'whale_dep', priority: 4, dedupeKey: `whale_dep_${topTipper.username}`,
      title: context, message: `${context} — ${action}`,
      compactMessage: `${topTipper.username} is ${pctStr}% of revenue — give them attention`,
      icon: '🐳', level: 'info',
      relatedTipperId: topTipper.username, relatedTipperName: topTipper.username, relatedAmountUsd: topTipper.revenue,
    });
  }

  return fired;
}

// Deterministic selection: lowest priority number wins; ties broken by
// TRIGGER_RULE_ORDER (fixed source-declaration order), never by array/row
// order. Non-selected qualifying triggers are simply not returned — they
// are neither queued nor persisted; a fresh evaluation next cycle decides
// again from scratch.
export function selectPrimaryTrigger(fired) {
  if (!fired.length) return null;
  return [...fired].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return TRIGGER_RULE_ORDER.indexOf(a.type) - TRIGGER_RULE_ORDER.indexOf(b.type);
  })[0];
}
