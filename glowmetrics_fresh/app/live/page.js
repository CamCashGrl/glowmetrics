'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeRoomHealth } from '../../lib/analytics/roomHealth';
import { computeRevenueVelocity, computeLiveComparison } from '../../lib/analytics/velocity';
import { computeCoachingState } from '../../lib/coaching/triggers';
import { detectSessions } from '../../lib/analytics/sessions';
import { tokenRate } from '../../lib/constants';
import FeedbackWidget from '../components/FeedbackWidget';
import SiteFooter from '../components/SiteFooter';
import EventsSync from './EventsSync';
import Button from '../../components/ui/Button';
import { useLiveSessionEngine } from './useLiveSessionEngine';
import { useAccountOverviewStats } from '../../lib/hooks/useAccountOverviewStats';
import TopStatsStrip from '../../components/dashboard/TopStatsStrip';
import { LM } from '../../components/live/theme';
import LiveHeader from '../../components/live/LiveHeader';
import SessionSummary from '../../components/live/SessionSummary';
import EarningsMomentumPanel from '../../components/live/EarningsMomentumPanel';
import CoachingPromptCard from '../../components/live/CoachingPromptCard';
import QuickActionsPanel from '../../components/live/QuickActionsPanel';
import RecentEventsPanel from '../../components/live/RecentEventsPanel';
import LiveInsightsPanel from '../../components/live/LiveInsightsPanel';
import PreviousPromptsPanel from '../../components/live/PreviousPromptsPanel';
import ContextualTipBar from '../../components/live/ContextualTipBar';

const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
};

export default function LivePage() {
  const [user, setUser]               = useState(null);
  const [authStatus, setAuthStatus]   = useState('connecting');
  const [liveActive, setLiveActive]   = useState(false);
  const [liveStartTime, setLiveStartTime] = useState(null);
  const [liveEvents, setLiveEvents]   = useState([]);
  const [liveStrategy, setLiveStrategy] = useState('balanced');
  const [liveGoalTokens, setLiveGoalTokens] = useState(0);
  // The single canonical coaching prompt, fetched from the shared
  // server-persisted engine (GET /api/live/coaching) — never computed
  // locally. null when nothing is currently active.
  const [coachingPrompt, setCoachingPrompt] = useState(null);
  const [livePlatform, setLivePlatform] = useState('Chaturbate');
  const [liveTipInput, setLiveTipInput] = useState({ username: '', tokens: '', usd: '' });
  const [liveTick, setLiveTick]       = useState(0);
  const [sessions, setSessions]       = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // ── UI CHROME STATE ───────────────────────────────────────────────────
  const [showDemoPreview, setShowDemoPreview] = useState(false);
  const [showExtModal, setShowExtModal]   = useState(false);
  const [extStep, setExtStep]             = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode]           = useState('signin');
  const [authEmail, setAuthEmail]         = useState('');
  const [authPassword, setAuthPassword]   = useState('');
  const [authError, setAuthError]         = useState('');
  const [authLoading, setAuthLoading]     = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [showLogTip, setShowLogTip]       = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  // Client-only — pauses the coaching poll/display without touching the
  // session or its persisted history. Distinct from engine.pause(), which
  // pauses the whole session's duration tracking.
  const [promptsPaused, setPromptsPaused] = useState(false);

  // Resolution card ("still live?"): local-only UI state for the "Choose
  // End Time" option, which needs a picker before it can submit — the other
  // 4 resolution choices submit immediately via engine.resolve().
  const [resolveShowEndTimePicker, setResolveShowEndTimePicker] = useState(false);
  const [resolveEndTimeInput, setResolveEndTimeInput]           = useState('');

  // Timezone used to display the V2 engine's session start/end clock times
  // (the duration itself is timezone-independent and unaffected by this).
  const [liveTimezone, setLiveTimezone] = useState(() => {
    if (typeof window === 'undefined') return 'UTC';
    return localStorage.getItem('cc_live_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('cc_live_timezone', liveTimezone);
  }, [liveTimezone]);

  const processedTipIds   = useRef(new Set());
  const isHydratingHistory = useRef(false);
  // The session id we ourselves just created and pushed liveStrategy/
  // liveGoalTokens to — tells the pull-from-server effect further down not
  // to immediately read that same session back.
  const justStartedSessionId = useRef(null);
  const liveTipsChannelRef = useRef(null);
  const liveTickerRef     = useRef(null);

  // V2 Live Mode session engine. Its own restore/heartbeat/lifecycle,
  // entirely independent of the legacy state above. engineMode is locked
  // once inside the hook and never re-evaluated for this mount.
  const engine = useLiveSessionEngine();

  // Mirror the real engine state into the legacy liveActive/liveStartTime
  // state that the rest of this component (computeState, summary cards,
  // coaching, tip feed) reads. No-ops for legacy users.
  useEffect(() => {
    if (engine.engineMode !== 'v2') return;
    const status = engine.serverSession?.status;
    setLiveActive(status === 'active' || status === 'paused');
    setLiveStartTime(engine.serverSession?.started_at ? new Date(engine.serverSession.started_at) : null);
  }, [engine.engineMode, engine.serverSession?.status, engine.serverSession?.started_at]);

  // "Clear Feed" never deletes rows — it sets tips_cleared_at on the session.
  // This engine poll picks that up within ~15s and prunes the already-loaded
  // liveEvents array once so every downstream computation reflects it.
  useEffect(() => {
    const clearedAt = engine.serverSession?.tips_cleared_at;
    if (engine.engineMode !== 'v2' || !clearedAt) return;
    const clearedAtMs = new Date(clearedAt).getTime();
    const sessionId = engine.serverSession?.id;
    setLiveEvents(prev => prev.filter(e => {
      if (e.live_session_id !== sessionId) return true;
      return new Date(e.timestamp).getTime() > clearedAtMs;
    }));
  }, [engine.engineMode, engine.serverSession?.tips_cleared_at, engine.serverSession?.id]);

  // 1-second ticker drives coaching + elapsed time
  useEffect(() => {
    liveTickerRef.current = setInterval(() => setLiveTick(t => t + 1), 1000);
    return () => clearInterval(liveTickerRef.current);
  }, []);

  const normalizeTip = useCallback((ev) => {
    const tokens = parseInt(ev.tokens) || 0;
    const usd    = parseFloat(ev.usd) || 0;
    const rate   = tokenRate(livePlatform);
    let rev = 0, src = 'unknown', conf = 0;
    if (usd > 0 && tokens > 0)      { rev = usd; src = 'usd'; conf = 0.9; }
    else if (usd > 0)                { rev = usd; src = 'usd'; conf = 0.95; }
    else if (tokens > 0)             { rev = parseFloat((tokens * rate).toFixed(2)); src = 'tokens'; conf = 0.75; }
    return { ...ev, normalizedRevenue: rev, sourceUsed: src, confidenceScore: conf,
      timestamp: ev.timestamp || ev.received_at || new Date() };
  }, [livePlatform]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { setAuthStatus('live'); return; }
      setUser(u);
      setAuthStatus('live');

      // Load last 12h of tips as history
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      supabase.from('live_tips').select('*').eq('user_id', u.id).gte('received_at', since)
        .order('received_at', { ascending: true })
        .then(({ data }) => {
          if (data?.length) {
            isHydratingHistory.current = true;
            const normalized = data.map(t => ({
              ...normalizeTip({ ...t, tokens: t.tokens || 0, usd: t.usd || 0,
                username: t.username || 'anon', platform: t.source || 'extension', timestamp: t.received_at }),
              _id: t.id, _isHistory: true, sourceUsed: 'extension',
            }));
            normalized.forEach(e => processedTipIds.current.add(e._id));
            setLiveEvents(normalized);
            setTimeout(() => { isHydratingHistory.current = false; }, 200);
          }
        });

      // Realtime subscription
      const ch = supabase.channel(`live_page_${u.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_tips',
          filter: `user_id=eq.${u.id}` }, (payload) => {
          const t = payload.new;
          if (processedTipIds.current.has(t.id)) return;
          processedTipIds.current.add(t.id);
          const ev = {
            ...normalizeTip({ ...t, tokens: t.tokens || 0, usd: t.usd || 0,
              username: t.username || 'anon', platform: t.source || 'extension', timestamp: t.received_at }),
            _id: t.id, _isHistory: false, sourceUsed: 'extension',
          };
          setLiveEvents(prev => [...prev, ev]);
        }).subscribe();
      liveTipsChannelRef.current = ch;

      // Recent tip history for Personal Best / Peak Hour / Revenue Velocity
      // comparison. Scoped to the last 90 days (lightweight, real-time page).
      const sessionsSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      supabase.from('tips').select('username, platform, tokens, usd, date_time')
        .eq('user_id', u.id).gte('date_time', sessionsSince)
        .order('date_time', { ascending: true })
        .then(({ data }) => { if (data) setSessions(detectSessions(data)); });
    });

    return () => { if (liveTipsChannelRef.current) supabase.removeChannel(liveTipsChannelRef.current); };
  }, [normalizeTip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Account-level/historical stats for the top strip — shares the exact
  // same tips → aggregateRows → computeDailyBriefCore pipeline the
  // dashboard uses (lib/liveMode/dailyBriefCore.js), so these numbers never
  // diverge from the dashboard's Total Earned / Peak Window / Platform.
  const overview = useAccountOverviewStats(user?.id);

  // ── SESSION DB HANDLERS (legacy engine fallback) ───────────────────────

  const handleStartStream = async () => {
    const startTime = new Date();
    setLiveActive(true);
    setLiveStartTime(startTime);
    setLiveEvents([]);
    processedTipIds.current = new Set();
    if (user) {
      const { data: session } = await supabase
        .from('stream_sessions')
        .insert({
          user_id: user.id, platform: livePlatform,
          start_time: startTime.toISOString(), end_time: startTime.toISOString(),
          hours_streamed: 0,
        })
        .select().single();
      if (session) setCurrentSessionId(session.id);
    }
  };

  const handleStopStream = async () => {
    setLiveActive(false);
    if (user && currentSessionId && liveStartTime) {
      const endTime = new Date();
      const hoursStreamed = (endTime - new Date(liveStartTime)) / 1000 / 60 / 60;
      const sessionTips = liveEvents.filter(e => !e._isHistory);
      const totalUsd    = sessionTips.reduce((sum, t) => sum + (t.normalizedRevenue || t.usd || 0), 0);
      const totalTokens = sessionTips.reduce((sum, t) => sum + (t.tokens || 0), 0);
      await supabase.from('stream_sessions').update({
        end_time: endTime.toISOString(), hours_streamed: parseFloat(hoursStreamed.toFixed(4)),
        usd: parseFloat(totalUsd.toFixed(2)), tokens: totalTokens, tip_count: sessionTips.length,
      }).eq('id', currentSessionId);
      setCurrentSessionId(null);
    }
  };

  // ── SESSION-SCOPED INTELLIGENCE ENGINE ─────────────────────────────────

  const computeState = () => {
    const events = engine.engineMode === 'v2'
      ? liveEvents.filter(e => e.live_session_id === engine.serverSession?.id)
      : liveEvents;
    if (!events.length || !liveStartTime) return null;
    const nowMs   = Date.now();
    const startMs = new Date(liveStartTime).getTime();
    const elapsedMins = Math.max((nowMs - startMs) / 60000, 0.1);
    let totalRevenue = 0, totalTokens = 0;
    const tipperMap = {};
    events.forEach(ev => {
      totalRevenue += ev.normalizedRevenue || 0;
      totalTokens  += ev.tokens || 0;
      tipperMap[ev.username] = (tipperMap[ev.username] || 0) + (ev.normalizedRevenue || 0);
    });
    const liveOnly = events.filter(e => !e._isHistory);
    const sortedLive = [...liveOnly].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastLiveTip = sortedLive[0];
    const timeSinceLast = lastLiveTip
      ? parseFloat(((nowMs - new Date(lastLiveTip.timestamp).getTime()) / 60000).toFixed(1))
      : null;
    const goalProgress = liveGoalTokens > 0 ? Math.min(100, Math.round((totalTokens / liveGoalTokens) * 100)) : 0;
    const tpm   = liveOnly.length > 0 ? parseFloat((liveOnly.length / elapsedMins).toFixed(2)) : 0;
    const avgTip = liveOnly.length > 0
      ? parseFloat((liveOnly.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / liveOnly.length).toFixed(2)) : 0;
    const midMs = startMs + (nowMs - startMs) / 2;
    const fh = liveOnly.filter(e => new Date(e.timestamp).getTime() <= midMs);
    const sh = liveOnly.filter(e => new Date(e.timestamp).getTime() > midMs);
    const hm = elapsedMins / 2;
    const fUPM = hm > 0 ? fh.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / hm : 0;
    const sUPM = hm > 0 ? sh.reduce((s, e) => s + (e.normalizedRevenue||0), 0) / hm : 0;
    let pace = 'unknown';
    if (liveOnly.length >= 3 && elapsedMins >= 5) {
      if (sUPM > fUPM * 1.15)      pace = 'above';
      else if (sUPM < fUPM * 0.75) pace = 'below';
      else                          pace = 'on_track';
    }
    const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0];
    return {
      totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
      totalTokens,
      elapsedMins:      parseFloat(elapsedMins.toFixed(1)),
      tipsPerMinute:    tpm,
      avgTipValue:      avgTip,
      timeSinceLastTip: timeSinceLast,
      goalProgress,
      paceStatus:       pace,
      liveOnlyCount:    liveOnly.length,
      topTipper:        topEntry ? { username: topEntry[0], revenue: parseFloat(topEntry[1].toFixed(2)) } : null,
      firstHalfUPM:     parseFloat(fUPM.toFixed(3)),
      secondHalfUPM:    parseFloat(sUPM.toFixed(3)),
      currentUPM:       parseFloat((totalRevenue / elapsedMins).toFixed(3)),
      tipperMap,
      events, liveOnly,
    };
  };

  // Shared coaching-prompt poll — the one place the website fetches the
  // canonical persisted prompt (never computes its own). Paused entirely
  // (no network calls) while promptsPaused is set from Quick Actions.
  useEffect(() => {
    if (engine.engineMode !== 'v2' || !engine.serverSession || promptsPaused) { if (!promptsPaused) setCoachingPrompt(null); return; }
    let cancelled = false;
    const fetchPrompt = async () => {
      try {
        const res = await fetch('/api/live/coaching', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setCoachingPrompt(data.prompt || null);
      } catch (_) { /* one failed poll is never surfaced — the next tick retries */ }
    };
    fetchPrompt();
    const id = setInterval(fetchPrompt, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [engine.engineMode, engine.serverSession?.id, promptsPaused]);

  // Reads coaching_strategy/coaching_goal_tokens back FROM the server
  // whenever a session is discovered (refresh of an active session, or a
  // fresh tab picking up a session started elsewhere).
  useEffect(() => {
    const sessionId = engine.serverSession?.id;
    if (engine.engineMode !== 'v2' || !sessionId) return;
    if (justStartedSessionId.current === sessionId) return;
    if (engine.serverSession.coaching_strategy) setLiveStrategy(engine.serverSession.coaching_strategy);
    if (typeof engine.serverSession.coaching_goal_tokens === 'number') setLiveGoalTokens(engine.serverSession.coaching_goal_tokens);
  }, [engine.engineMode, engine.serverSession?.id]);

  const handleGoLive = async () => {
    const session = await engine.goLive(livePlatform);
    if (!session) return;
    justStartedSessionId.current = session.id;
    fetch('/api/live/session/coaching-strategy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: liveStrategy }),
    }).catch(() => {});
    fetch('/api/live/session/goal-tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalTokens: liveGoalTokens || 0 }),
    }).catch(() => {});
  };

  // Responds to the single canonical current prompt. Optimistic — rolled
  // back if the request fails.
  const respondToCoachingPrompt = async (status) => {
    if (!coachingPrompt) return;
    await respondToPromptById(coachingPrompt.id, status, {
      optimistic: () => setCoachingPrompt((prev) => (prev && prev.id === coachingPrompt.id ? { ...prev, action_status: status } : prev)),
      rollback: () => setCoachingPrompt(coachingPrompt),
      onSuccess: () => setCoachingPrompt((prev) => (prev && prev.id === coachingPrompt.id ? null : prev)),
    });
  };

  // ── PREVIOUS PROMPTS (persisted history) ────────────────────────────────
  const [promptHistory, setPromptHistory] = useState([]);
  const [promptHistoryLoading, setPromptHistoryLoading] = useState(true);
  const [promptHistoryFilter, setPromptHistoryFilter] = useState('all');
  const [promptHistoryCursor, setPromptHistoryCursor] = useState(null);
  const [promptHistoryHasMore, setPromptHistoryHasMore] = useState(false);
  const [needsResponseCount, setNeedsResponseCount] = useState(0);
  const [promptTotalCount, setPromptTotalCount] = useState(0);
  const [promptRespondBusyId, setPromptRespondBusyId] = useState(null);
  const promptHistorySessionId = engine.serverSession?.id || null;

  const fetchPromptHistory = useCallback(async ({ before, reset } = {}) => {
    if (!promptHistorySessionId) { setPromptHistory([]); setPromptHistoryLoading(false); return; }
    setPromptHistoryLoading(true);
    try {
      const params = new URLSearchParams({ sessionId: promptHistorySessionId, limit: '20' });
      if (before) params.set('before', before);
      if (promptHistoryFilter !== 'all') params.set('status', promptHistoryFilter);
      const res = await fetch(`/api/live/coaching/history?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPromptHistory((prev) => reset ? (data.prompts || []) : [...prev, ...(data.prompts || [])]);
      setPromptHistoryCursor(data.nextCursor || null);
      setPromptHistoryHasMore(!!data.nextCursor);
      setNeedsResponseCount(data.needsResponseCount || 0);
      setPromptTotalCount(data.totalCount || 0);
    } finally {
      setPromptHistoryLoading(false);
    }
  }, [promptHistorySessionId, promptHistoryFilter]);

  useEffect(() => {
    fetchPromptHistory({ reset: true });
    if (!promptHistorySessionId) return;
    const id = setInterval(() => fetchPromptHistory({ reset: true }), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptHistorySessionId, promptHistoryFilter]);

  // Re-fetches whenever the current-prompt poll observes a new/changed id,
  // so a freshly-fired prompt appears in the list without waiting 15s.
  useEffect(() => { if (coachingPrompt) fetchPromptHistory({ reset: true }); }, [coachingPrompt?.id, coachingPrompt?.action_status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generalized responder — used by both the current-prompt card and the
  // Previous Prompts panel (any row, by its own stable id, never an array
  // index). Same RPC/endpoint either way, so both surfaces converge.
  async function respondToPromptById(eventId, status, { optimistic, rollback, onSuccess } = {}) {
    setPromptRespondBusyId(eventId);
    setPromptHistory((prev) => prev.map((p) => (p.id === eventId ? { ...p, action_status: status } : p)));
    optimistic?.();
    try {
      const res = await fetch('/api/live/coaching/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status }),
      });
      if (!res.ok) throw new Error('respond failed');
      const data = await res.json();
      onSuccess?.(data);
      fetchPromptHistory({ reset: true });
    } catch (_) {
      rollback?.();
      fetchPromptHistory({ reset: true });
    } finally {
      setPromptRespondBusyId(null);
    }
  }

  // Clears the visible list only — coaching_events rows are never deleted.
  // Reloading (or Clear All again next session) brings history back.
  const handleClearAllPrompts = () => {
    if (promptHistory.length === 0) return;
    if (!window.confirm('Clear the visible prompt list? Nothing is deleted — your coaching history stays recorded.')) return;
    setPromptHistory([]);
    setPromptHistoryHasMore(false);
  };

  // Demo/local-only: pushes straight into liveEvents for the visual feed,
  // never reaches the server.
  const addTip = () => {
    const { username, tokens, usd } = liveTipInput;
    if (!username && !tokens && !usd) return;
    const raw = { username: username || 'anonymous', tokens: parseInt(tokens) || 0, usd: parseFloat(usd) || 0, timestamp: new Date(), platform: livePlatform };
    setLiveEvents(prev => [...prev, normalizeTip(raw)]);
    setLiveTipInput({ username: '', tokens: '', usd: '' });
    setShowLogTip(false);
  };

  // ── INLINE AUTH HANDLER ──────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const captchaRes = await fetch('/api/auth/verify-captcha', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail }),
        })
        const captchaData = await captchaRes.json()
        if (!captchaData.ok) { setAuthError(captchaData.error || 'Security check failed.'); setAuthLoading(false); return }
      }
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        window.location.reload();
        return;
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const fmtDuration = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
      : `${m}:${String(r).padStart(2, '0')}`;
  };

  const toDatetimeLocalValue = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const resolutionOutcomeLabel = (lastResolution) => {
    if (!lastResolution) return '';
    if (lastResolution.choice === 'mark_invalid') {
      return '🚫 Session marked invalid — excluded from earnings, duration, and streaming-window stats';
    }
    return `✅ Session ended — active time ${fmtDuration(lastResolution.session?.active_duration_seconds)}`;
  };

  // ── CONNECTING SCREEN ────────────────────────────────────────────────
  if (authStatus === 'connecting') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: 'system-ui', gap: 10 }}>
      <style>{`@keyframes cc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }`}</style>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.purple, animation: 'cc-pulse 1s ease-in-out infinite' }} />
      Connecting…
    </div>
  );

  // ── LIVE INTELLIGENCE LAYER ──────────────────────────────────────────
  void liveTick;
  const state          = computeState();
  // Room Status's score (below) is the single Opportunity/room-health number
  // used everywhere on this page — Stream Health/Opportunity Score/Recovery
  // Actions from the old layout duplicated this same signal 2-3x and were
  // consolidated rather than carried into the redesign.
  const roomHealth     = computeRoomHealth(state);
  const velocity       = computeRevenueVelocity(state?.currentUPM ?? 0, sessions);
  const comparison     = computeLiveComparison(state, sessions);

  // Unique / new tippers — real data only. "New" = never appeared in the
  // last 90 days of imported tip history (lib/analytics/sessions.js keeps
  // each session's raw tips), never a fabricated fan-join count.
  const historicalUsernames = (() => {
    const set = new Set();
    sessions.forEach(s => (s.tips || []).forEach(t => set.add((t.username || '').toLowerCase())));
    return set;
  })();
  const sessionTipperNames = state ? Object.keys(state.tipperMap || {}) : [];
  const uniqueTippers = sessionTipperNames.length;
  const newTippers = sessionTipperNames.filter(n => !historicalUsernames.has((n || '').toLowerCase())).length;

  const PACE_CONFIG = {
    above:    { label: '🔥 Hot',       color: C.green, bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
    on_track: { label: '✅ On Track',   color: C.cyan,  bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)' },
    below:    { label: '📉 Slow',       color: C.red,   bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
    unknown:  { label: '⏳ Starting',   color: C.muted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
  };
  const pace = PACE_CONFIG[state?.paceStatus || 'unknown'];
  const inp2 = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: C.white, fontSize: 13, outline: 'none', width: '100%' };

  const revenueHistory = [...liveEvents]
    .filter(e => !e._isHistory)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-10)
    .reduce((acc, e) => [...acc, (acc[acc.length - 1] || 0) + (e.normalizedRevenue || 0)], []);

  const currentPaceLabel = state ? `$${velocity.currentUPH.toFixed(2)}/hr` : '—';
  const goalCurrentLabel = liveGoalTokens > 0 ? `${(state?.totalTokens || 0).toLocaleString()} tokens` : null;
  const goalTargetLabel = liveGoalTokens > 0 ? `${liveGoalTokens.toLocaleString()} tokens` : null;
  const goalProgressPct = liveGoalTokens > 0 ? (state?.goalProgress ?? 0) : null;

  // Session-scoped Momentum — matches the dashboard's own convention (see
  // dashboard/page.js's sticky command bar) of reflecting the CURRENT live
  // room rather than a historical trend; reuses the exact same
  // computeCoachingState/computeRoomHealth pure functions, just fed this
  // route's own live session data.
  const liveOnlyTips = liveActive
    ? liveEvents.filter(e => !e._isHistory).map(e => ({ received_at: e.timestamp, usd: e.normalizedRevenue, tokens: e.tokens, username: e.username }))
    : [];
  const liveCoachState = liveActive && liveStartTime
    ? computeCoachingState({ tips: liveOnlyTips, startedAt: liveStartTime, goalTokens: liveGoalTokens })
    : null;
  const liveMomentumState = liveCoachState
    ? { ...liveCoachState, tipsPerMinute: liveCoachState.elapsedMins > 0 ? parseFloat((liveCoachState.liveOnlyCount / liveCoachState.elapsedMins).toFixed(2)) : 0 }
    : null;
  const liveRoomHealthForMomentum = liveActive ? computeRoomHealth(liveMomentumState) : null;
  const momentumLabel = !liveActive ? 'Waiting for live stream' : overview.atPeak ? '🔥 AT PEAK' : (liveRoomHealthForMomentum?.directionLabel || '—');
  const momentumColor = !liveActive ? '#475569' : overview.atPeak ? '#10B981' : (liveRoomHealthForMomentum?.directionColor || '#94a3b8');

  const canEndSession = engine.engineMode === 'v2'
    ? (engine.serverSession?.status === 'active' || engine.serverSession?.status === 'paused')
    : liveActive;
  const isPaused = engine.serverSession?.status === 'paused';

  const contextualTipText = (() => {
    if (overview.atPeak) return `You're in your peak window right now — interactive goals and menu items convert best during it.`;
    if (overview.peakWindowLabel) return `Use interactive goals and menu items during your peak window (${overview.peakWindowLabel}).`;
    if (liveGoalTokens > 0 && (state?.goalProgress ?? 0) >= 75) return `You're at ${state.goalProgress}% of your token goal — announce it out loud to close it out.`;
    return null;
  })();

  const promptPerformedPct = promptTotalCount > 0
    ? Math.round((promptHistory.filter(p => p.action_status === 'performed').length / Math.min(promptHistory.length, promptTotalCount)) * 100)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: LM.bg, fontFamily: 'system-ui', color: C.white }}>
      <style>{`
        @keyframes cc-slide-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes cc-pulse    { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @media (max-width: 1199px) {
          .lm-grid { grid-template-columns: 1fr !important; }
          .lm-prompts { order: 3; max-height: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.88)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0f1420', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 0 60px rgba(168,85,247,0.2)', position: 'relative' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💎</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 4 }}>
                {authMode === 'signin' ? 'Sign in to CamCash' : 'Create free account'}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Save your data, unlock full analytics</div>
            </div>
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {['signin', 'signup'].map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthError(''); }} style={{ flex: 1, padding: '9px 0', background: authMode === m ? 'rgba(168,85,247,0.2)' : 'transparent', border: 'none', color: authMode === m ? C.purple : C.muted, fontWeight: authMode === m ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input type="email" placeholder="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: C.white, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: C.white, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            {authError && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, textAlign: 'center' }}>{authError}</div>}
            <Button onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '13px 0' }}>
              {authLoading ? 'Please wait…' : authMode === 'signin' ? 'Sign In →' : 'Create Account →'}
            </Button>
          </div>
        </div>
      )}

      {/* ── EXT INSTALL MODAL ── */}
      {showExtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(14px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {(() => {
            const steps = [
              { icon: '📂', title: 'Open your Downloads folder', body: 'Find camcash-extension.zip — it just downloaded to your computer.' },
              { icon: '📦', title: 'Extract / Unzip the file', body: 'Right-click → "Extract All" (Windows) or double-click (Mac). You\'ll get a folder called camcash-extension.' },
              { icon: '🌐', title: 'Open Chrome Extensions', body: 'In Chrome, type chrome://extensions in the address bar and press Enter.' },
              { icon: '🔧', title: 'Enable Developer Mode', body: 'Toggle on "Developer mode" in the top-right corner of the Extensions page.' },
              { icon: '📁', title: 'Load unpacked', body: 'Click "Load unpacked" → select the extracted camcash-extension folder.' },
              { icon: '✅', title: 'You\'re ready!', body: 'Click the CamCash icon in your toolbar. Tips will appear here automatically while you stream.' },
            ];
            const isLast = extStep === steps.length - 1;
            const s = steps[extStep];
            return (
              <div style={{ background: '#0f1420', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 420, boxShadow: '0 0 60px rgba(168,85,247,0.2)', position: 'relative' }}>
                <button onClick={() => { setShowExtModal(false); setExtStep(0); }} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Step {extStep + 1} of {steps.length}</div>
                <div style={{ fontSize: 48, marginBottom: 14, textAlign: 'center' }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 10, textAlign: 'center' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, textAlign: 'center', marginBottom: 28 }}>{s.body}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{ width: i === extStep ? 20 : 6, height: 6, borderRadius: 3, background: i === extStep ? C.purple : i < extStep ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s ease' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {extStep > 0 && (
                    <button onClick={() => setExtStep(s => s - 1)} style={{ flex: 1, padding: '11px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Back</button>
                  )}
                  {!isLast ? (
                    <Button onClick={() => setExtStep(s => s + 1)} style={{ flex: 2, padding: '11px 0', fontSize: 14 }}>Next →</Button>
                  ) : (
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Button onClick={() => { setShowExtModal(false); setExtStep(0); setAuthMode('signup'); setShowAuthModal(true); }} style={{ width: '100%', padding: '11px 0', fontSize: 14 }}>
                        Sign up to save & sync data →
                      </Button>
                      <button onClick={() => { setShowExtModal(false); setExtStep(0); }} style={{ width: '100%', padding: '9px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        Continue in guest mode
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── DEMO PREVIEW MODAL — reuses the existing /live/demo route (no second demo implementation) ── */}
      {showDemoPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(10px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 1100, height: '85vh', background: '#0a0e18', borderRadius: 16, border: '1px solid rgba(168,85,247,0.3)', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setShowDemoPreview(false)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 18, width: 32, height: 32, borderRadius: 8, cursor: 'pointer' }}>✕</button>
            <iframe src="/live/demo" title="Live Mode demo preview" style={{ width: '100%', height: '100%', border: 'none' }} />
          </div>
        </div>
      )}

      {/* ── SETTINGS PANEL ── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(10px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
          onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live Mode settings" style={{ width: 'min(420px, 100%)', height: '100vh', overflowY: 'auto', background: '#0a0e18', borderLeft: '1px solid rgba(168,85,247,0.25)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Settings</div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Extension', ok: liveEvents.some(e => e.sourceUsed === 'extension'), okText: 'Connected', offText: 'Not detected' },
                { label: 'Realtime',  ok: !!liveTipsChannelRef?.current,                      okText: 'Live',      offText: 'Offline' },
                { label: 'Sync', ok: engine.engineMode === 'v2' ? (engine.phase === 'active' || engine.phase === 'needs_resolution') : liveActive,
                  okText: engine.engineMode === 'v2' && engine.serverSession?.status === 'paused' ? 'Paused' : 'Active', offText: 'Standby' },
              ].map(({ label, ok, okText, offText }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? C.green : '#374151', boxShadow: ok ? `0 0 5px ${C.green}` : 'none' }} />
                  <span style={{ fontSize: 12.5, color: C.muted }}>{label}</span>
                  <span style={{ fontSize: 12.5, color: ok ? C.green : '#475569', fontWeight: 700, marginLeft: 'auto' }}>{ok ? okText : offText}</span>
                </div>
              ))}
              {engine.engineMode === 'v2' && engine.serverSession && (engine.phase === 'active' || engine.serverSession.status === 'paused') && (
                <div style={{ fontSize: 12, color: C.muted }}>
                  Session: {fmtDuration(engine.duration?.active_duration_seconds)} · Started {new Date(engine.serverSession.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: liveTimezone })} ({liveTimezone})
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Platform</label>
              <select value={livePlatform} onChange={e => setLivePlatform(e.target.value)} style={inp2}>
                {['Chaturbate','BongaCams','MyFreeCams','CamSoda','Stripchat'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 }}>Token Goal</label>
              <input type="number" value={liveGoalTokens || ''} onChange={e => {
                const next = Math.max(0, Number(e.target.value) || 0);
                setLiveGoalTokens(next);
                if (engine.engineMode === 'v2' && engine.serverSession) {
                  fetch('/api/live/session/goal-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goalTokens: next }) }).catch(() => {});
                }
              }} placeholder="Token goal" style={inp2} />
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 }}>Coaching Strategy</label>
              <select value={liveStrategy} onChange={e => {
                const next = e.target.value;
                setLiveStrategy(next);
                if (engine.engineMode === 'v2' && engine.serverSession) {
                  fetch('/api/live/session/coaching-strategy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: next }) }).catch(() => {});
                }
              }} style={inp2}>
                <option value="balanced">⚖️ Balanced</option>
                <option value="aggressive">💰 Aggressive</option>
                <option value="retention">🔄 Retention</option>
                <option value="engagement">💬 Engagement</option>
                <option value="whale">🐋 Whale Focus</option>
                <option value="goal">🎯 Goal Focus</option>
              </select>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 }}>Timezone</label>
              <select value={liveTimezone} onChange={e => setLiveTimezone(e.target.value)} style={inp2}>
                {Array.from(new Set([liveTimezone, Intl.DateTimeFormat().resolvedOptions().timeZone,
                  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'UTC', 'Europe/London', 'Europe/Berlin'
                ])).map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {engine.engineMode === 'v2' ? (
                <>
                  {engine.phase === 'idle' && (
                    <button disabled={engine.actionPending} onClick={handleGoLive} style={{ padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 13, cursor: engine.actionPending ? 'default' : 'pointer', opacity: engine.actionPending ? 0.6 : 1 }}>
                      {engine.actionPending ? 'Starting…' : '▶ Start Stream'}
                    </button>
                  )}
                  {engine.phase === 'needs_resolution' && (
                    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10 }}>⚠️ Still live?</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button disabled={engine.actionPending} onClick={() => engine.resolve('still_live')} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Still Live</button>
                        <button disabled={engine.actionPending} onClick={() => engine.resolve('end_at_last_heartbeat')} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Stream Ended</button>
                        {resolveShowEndTimePicker ? (
                          <>
                            <input type="datetime-local" value={resolveEndTimeInput} max={toDatetimeLocalValue(new Date())}
                              min={engine.serverSession?.started_at ? toDatetimeLocalValue(new Date(engine.serverSession.started_at)) : undefined}
                              onChange={(e) => setResolveEndTimeInput(e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: C.white, fontSize: 12, outline: 'none' }} />
                            <button disabled={engine.actionPending || !resolveEndTimeInput} onClick={() => {
                              const iso = new Date(resolveEndTimeInput).toISOString();
                              engine.resolve('choose_end_time', iso);
                              setResolveShowEndTimePicker(false); setResolveEndTimeInput('');
                            }} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(56,213,232,0.15)', border: '1px solid rgba(56,213,232,0.4)', color: C.cyan, fontWeight: 700, fontSize: 12, cursor: (engine.actionPending || !resolveEndTimeInput) ? 'default' : 'pointer' }}>Confirm</button>
                            <button disabled={engine.actionPending} onClick={() => { setResolveShowEndTimePicker(false); setResolveEndTimeInput(''); }} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          </>
                        ) : (
                          <button disabled={engine.actionPending} onClick={() => setResolveShowEndTimePicker(true)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Choose End Time</button>
                        )}
                        <button disabled={engine.actionPending} onClick={() => {
                          if (window.confirm('Mark this session invalid? It will be excluded from earnings, duration, and streaming-window stats. The record itself is never deleted.')) engine.resolve('mark_invalid');
                        }} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.3)', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Mark Invalid</button>
                      </div>
                    </div>
                  )}
                  {engine.phase === 'resolved' && (
                    <div style={{ fontSize: 12, color: engine.lastResolution?.choice === 'mark_invalid' ? C.muted : C.green, fontWeight: 700 }}>{resolutionOutcomeLabel(engine.lastResolution)}</div>
                  )}
                  {engine.actionError && <div style={{ fontSize: 11, color: C.red }}>{engine.actionError}</div>}
                </>
              ) : !liveActive ? (
                <button onClick={handleStartStream} style={{ padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>▶ Start Stream</button>
              ) : (
                <button onClick={handleStopStream} style={{ padding: '11px 0', borderRadius: 10, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: C.red, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⏹ End</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button as="a" href="/camcash-extension.zip" download="camcash-extension.zip" onClick={() => { setShowExtModal(true); setExtStep(0); }} style={{ width: '100%', padding: '10px 0', fontSize: 13 }}>
                📥 Download Extension
              </Button>
              <button onClick={() => setShowDemoPreview(true)} style={{ padding: '9px 0', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, color: C.cyan, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                🎬 Preview Demo
              </button>
              <a href="/dashboard" style={{ padding: '9px 0', textAlign: 'center', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: C.purple, fontWeight: 600, fontSize: 12.5, textDecoration: 'none' }}>
                Full Dashboard →
              </a>
              {!user && (
                <button onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }} style={{ padding: '9px 0', background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LOG A TIP MODAL (manual/local-only entry) ── */}
      {showLogTip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowLogTip(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: '#0f1420', border: `1px solid ${LM.magenta}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 }}>Log a Tip</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Adds to this session's live feed only — not saved to your historical tip data.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Username" value={liveTipInput.username} onChange={e => setLiveTipInput(v => ({ ...v, username: e.target.value }))} style={inp2} />
              <input placeholder="Tokens" type="number" value={liveTipInput.tokens} onChange={e => setLiveTipInput(v => ({ ...v, tokens: e.target.value }))} style={inp2} />
              <input placeholder="USD (optional)" type="number" value={liveTipInput.usd} onChange={e => setLiveTipInput(v => ({ ...v, usd: e.target.value }))} style={inp2} />
              <Button onClick={addTip} style={{ marginTop: 4 }}>Add Tip</Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 28px 40px', maxWidth: 1600, margin: '0 auto' }}>

        {/* ── TOP STATS STRIP (account-wide/historical — never the session numbers below) ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${LM.border}`, borderRadius: 12, padding: '4px 18px', marginBottom: 16 }}>
          <TopStatsStrip
            revenue={overview.revenue}
            hourlyRateUnlocked={overview.hourlyRateUnlocked}
            hourlyRate={overview.hourlyRate}
            hourlyRateSubtext={overview.hourlyRateSubtext}
            hourlyRateTooltip="Estimated from the time between your first and last recorded tips in each session."
            onHourlyRateLockedClick={() => { window.location.href = '/dashboard?tab=upload'; }}
            momentumLabel={momentumLabel}
            momentumColor={momentumColor}
            atPeak={overview.atPeak}
            bestPlatform={overview.bestPlatform}
            peakWindowLabel={overview.peakWindowLabel}
            peakEtaLabel={overview.peakEtaLabel}
          />
        </div>

        <LiveHeader
          isLive={liveActive}
          onSettings={() => setShowSettings(true)}
          onEndSession={() => (engine.engineMode === 'v2' ? engine.stop() : handleStopStream())}
          onPauseResume={() => (isPaused ? engine.resume() : engine.pause())}
          isPaused={isPaused}
          canEndSession={canEndSession}
        />

        <EventsSync onNewTip={(events) => {
          const mapped = events.map(e => normalizeTip({
            username: e.object?.user?.username ?? 'anonymous',
            tokens: e.object?.tip?.tokens ?? 0,
            usd: parseFloat(((e.object?.tip?.tokens ?? 0) * tokenRate('Chaturbate')).toFixed(2)),
            timestamp: e.timestamp ? new Date(e.timestamp * 1000) : new Date(),
            platform: 'Chaturbate',
          }))
          setLiveEvents(prev => [...prev, ...mapped])
        }} />

        {user && !liveEvents.some(e => e.sourceUsed === 'extension') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderRadius: 12, padding: '12px 18px', marginBottom: 16, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🧩</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>Auto-capture your tips</div>
                <div style={{ fontSize: 12, color: C.muted }}>Install the CamCash Chrome extension so tips log here automatically.</div>
              </div>
            </div>
            <Button as="a" href="/camcash-extension.zip" download="camcash-extension.zip" onClick={() => { setShowExtModal(true); setExtStep(0); }} style={{ padding: '8px 16px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
              📥 Download Extension
            </Button>
          </div>
        )}

        {engine.phase === 'needs_resolution' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>⚠️ Still live? Resolve your last session in Settings to keep your stats accurate.</span>
            <button onClick={() => setShowSettings(true)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.2)', border: 'none', color: C.gold, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Resolve →</button>
          </div>
        )}

        {/* ── MAIN TWO-COLUMN WORKSPACE ── */}
        <div className="lm-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <SessionSummary
              state={state}
              roomHealth={roomHealth}
              comparison={comparison}
              uniqueTippers={uniqueTippers}
              newTippers={newTippers}
            />

            <EarningsMomentumPanel
              pace={pace}
              currentPaceLabel={currentPaceLabel}
              goalLabel={liveGoalTokens > 0 ? 'Goal Progress' : null}
              goalValue={goalTargetLabel}
              goalCurrent={goalCurrentLabel}
              goalProgressPct={goalProgressPct}
              chartPoints={revenueHistory}
            />

            <CoachingPromptCard
              prompt={coachingPrompt}
              promptsPaused={promptsPaused}
              busy={!!coachingPrompt && promptRespondBusyId === coachingPrompt.id}
              onPerform={() => respondToCoachingPrompt('performed')}
              onSkip={() => respondToCoachingPrompt('skipped')}
              goal={liveGoalTokens > 0 && state ? {
                pct: Math.min(100, state.goalProgress || 0),
                currentLabel: `${(state.totalTokens || 0).toLocaleString()} tok`,
                targetLabel: `${liveGoalTokens.toLocaleString()} tok`,
                name: 'Token Goal',
              } : null}
            />

            <QuickActionsPanel
              onSetGoal={() => setShowGoalEditor(true)}
              onStrategy={() => setShowSettings(true)}
              onLogTip={() => setShowLogTip(true)}
              onClearFeed={() => {
                if (!window.confirm("Clear this session's tip feed? Earnings, tip count, and top tipper for this session will reset. Historical/past sessions are never affected.")) return;
                if (engine.engineMode === 'v2') engine.clearTips();
                else setLiveEvents([]);
              }}
              onTogglePausePrompts={() => setPromptsPaused(p => !p)}
              promptsPaused={promptsPaused}
            />

            {showGoalEditor && (
              <div style={{ ...{}, marginBottom: 12, padding: 14, borderRadius: 12, background: LM.card, border: `1px solid ${LM.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: LM.textSecondary, fontWeight: 700 }}>Token Goal</span>
                <input type="number" value={liveGoalTokens || ''} autoFocus onChange={e => {
                  const next = Math.max(0, Number(e.target.value) || 0);
                  setLiveGoalTokens(next);
                  if (engine.engineMode === 'v2' && engine.serverSession) {
                    fetch('/api/live/session/goal-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goalTokens: next }) }).catch(() => {});
                  }
                }} style={{ ...inp2, width: 140 }} />
                <button onClick={() => setShowGoalEditor(false)} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, background: LM.magenta, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Done</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <RecentEventsPanel
                events={[...liveEvents].filter(e => !e._isHistory).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))}
                onViewAll={() => setShowSettings(false) || document.getElementById('lm-full-events')?.scrollIntoView({ behavior: 'smooth' })}
              />
              <LiveInsightsPanel
                bestEarningLabel={overview.peakWindowLabel ? `${overview.peakWindowLabel}${overview.peakEtaLabel ? ` · ${overview.peakEtaLabel}` : ''}` : null}
                topTipperLabel={state?.topTipper ? `${state.topTipper.username} ($${state.topTipper.revenue.toFixed(2)})` : null}
                paceVsNormalLabel={comparison.vsAvgPct !== null ? `${comparison.vsAvgPct >= 0 ? '+' : ''}${comparison.vsAvgPct}% vs your average` : null}
                paceVsNormalColor={comparison.vsAvgPct !== null ? (comparison.vsAvgPct >= 0 ? LM.green : LM.red) : undefined}
                engagementLabel={state ? (roomHealth.label + (state.tipsPerMinute ? ` · ${state.tipsPerMinute.toFixed(2)} tips/min` : '')) : null}
                promptPerformedPct={promptPerformedPct}
                onViewFull={() => setShowSettings(true)}
              />
            </div>

            <ContextualTipBar text={contextualTipText} />
          </div>

          <div className="lm-prompts">
            <PreviousPromptsPanel
              prompts={promptHistory}
              needsResponseCount={needsResponseCount}
              totalCount={promptTotalCount}
              loading={promptHistoryLoading}
              filter={promptHistoryFilter}
              onFilterChange={(f) => setPromptHistoryFilter(f)}
              onRespond={(id, status) => respondToPromptById(id, status)}
              busyId={promptRespondBusyId}
              onClearAll={handleClearAllPrompts}
              onLoadMore={() => fetchPromptHistory({ before: promptHistoryCursor })}
              hasMore={promptHistoryHasMore}
              onViewFullHistory={() => setShowSettings(true)}
            />
          </div>
        </div>

        {/* Full tip feed — target of "View All Events" */}
        <div id="lm-full-events" style={{ marginTop: 16, background: LM.panel, border: `1px solid ${LM.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: LM.textMuted, marginBottom: 10 }}>All Session Events</div>
          {liveEvents.filter(e => !e._isHistory).length === 0 ? (
            <div style={{ fontSize: 13, color: LM.textMuted }}>No events yet this session.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {[...liveEvents].filter(e => !e._isHistory).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((e, i) => (
                <div key={e._id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: LM.textSecondary, borderBottom: `1px solid ${LM.border}`, paddingBottom: 6 }}>
                  <span>{e.username} — {e.tokens || 0} tokens</span>
                  <span style={{ color: LM.green, fontWeight: 700 }}>${(e.normalizedRevenue || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <SiteFooter />
      <FeedbackWidget />
    </div>
  );
}
