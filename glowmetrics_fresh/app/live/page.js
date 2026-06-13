'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeRoomHealth } from '../../lib/analytics/roomHealth';
import { computeRevenueVelocity, computeLiveComparison } from '../../lib/analytics/velocity';
import { detectSessionPhase, PHASES, getRecoveryActions, getGoalStrategy } from '../../lib/analytics/sessionPhase';
import { computeOpportunityScore, computeStreamHealth } from '../../lib/analytics/opportunity';
import FeedbackWidget from '../components/FeedbackWidget';
import EventsSync from './EventsSync';

const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
};

const glassCard = {
  background: 'rgba(15,20,32,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)',
};

const TOKEN_RATES = { Chaturbate: 0.05, BongaCams: 0.05, MyFreeCams: 0.05, CamSoda: 0.05, Stripchat: 0.05 };

export default function LivePage() {
  const [user, setUser]               = useState(null);
  const [authStatus, setAuthStatus]   = useState('connecting');
  const [liveActive, setLiveActive]   = useState(false);
  const [liveStartTime, setLiveStartTime] = useState(null);
  const [liveEvents, setLiveEvents]   = useState([]);
  const [liveStrategy, setLiveStrategy] = useState('balanced');
  const [liveGoalTokens, setLiveGoalTokens] = useState(0);
  const [livePlatform, setLivePlatform] = useState('Chaturbate');
  const [liveTipInput, setLiveTipInput] = useState({ username: '', tokens: '', usd: '' });
  const [flashTipId, setFlashTipId]   = useState(null);
  const [liveTick, setLiveTick]       = useState(0);
  const [sessions, setSessions]       = useState([]);

  // ── DEMO / AUTH / EXT MODAL STATE ────────────────────────────────────
  const [demoTips, setDemoTips]           = useState([]);
  const [demoRevenue, setDemoRevenue]     = useState(0);
  const [demoCoachIdx, setDemoCoachIdx]   = useState(0);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [showDemoPreview, setShowDemoPreview] = useState(false);
  const [showExtModal, setShowExtModal]   = useState(false);
  const [extStep, setExtStep]             = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode]           = useState('signin');
  const [authEmail, setAuthEmail]         = useState('');
  const [authPassword, setAuthPassword]   = useState('');
  const [authError, setAuthError]         = useState('');
  const [authLoading, setAuthLoading]     = useState(false);

  const processedTipIds   = useRef(new Set());
  const coachingCooldowns = useRef({});
  const isHydratingHistory = useRef(false);
  const phaseChangeLog    = useRef([]);
  const firedAlertsLog    = useRef([]);
  const prevPhaseRef      = useRef(null);
  const liveTipsChannelRef = useRef(null);
  const liveTickerRef     = useRef(null);

  // 1-second ticker drives coaching + elapsed time
  useEffect(() => {
    liveTickerRef.current = setInterval(() => setLiveTick(t => t + 1), 1000);
    return () => clearInterval(liveTickerRef.current);
  }, []);

  const normalizeTip = useCallback((ev) => {
    const tokens = parseInt(ev.tokens) || 0;
    const usd    = parseFloat(ev.usd) || 0;
    const rate   = TOKEN_RATES[livePlatform] || 0.05;
    let rev = 0, src = 'unknown', conf = 0;
    if (usd > 0 && tokens > 0)      { rev = usd; src = 'usd'; conf = 0.9; }
    else if (usd > 0)                { rev = usd; src = 'usd'; conf = 0.95; }
    else if (tokens > 0)             { rev = parseFloat((tokens * rate).toFixed(2)); src = 'tokens'; conf = 0.75; }
    return { ...ev, normalizedRevenue: rev, sourceUsed: src, confidenceScore: conf,
      timestamp: ev.timestamp || ev.received_at || new Date() };
  }, [livePlatform]);

  useEffect(() => {
    // ?__demo=1 forces the unauthenticated demo view (used in preview modal)
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__demo') === '1') {
      setAuthStatus('live');
      return;
    }
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
          setFlashTipId(t.id);
          if (liveActive && liveStartTime) {
            // auto-start session on first real tip if not already started
          }
          setTimeout(() => setFlashTipId(null), 2500);
        }).subscribe();
      liveTipsChannelRef.current = ch;

      // Load sessions for velocity comparison
      supabase.from('sessions').select('*').eq('user_id', u.id)
        .order('start_time', { ascending: false }).limit(30)
        .then(({ data }) => { if (data) setSessions(data); });
    });

    return () => { if (liveTipsChannelRef.current) supabase.removeChannel(liveTipsChannelRef.current); };
  }, [normalizeTip]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── INLINE LIVE ENGINE (same logic as dashboard live tab) ────────────

  const computeState = () => {
    if (!liveEvents.length || !liveStartTime) return null;
    const nowMs   = Date.now();
    const startMs = new Date(liveStartTime).getTime();
    const elapsedMins = Math.max((nowMs - startMs) / 60000, 0.1);
    let totalRevenue = 0, totalTokens = 0;
    const tipperMap = {};
    liveEvents.forEach(ev => {
      totalRevenue += ev.normalizedRevenue || 0;
      totalTokens  += ev.tokens || 0;
      tipperMap[ev.username] = (tipperMap[ev.username] || 0) + (ev.normalizedRevenue || 0);
    });
    const liveOnly = liveEvents.filter(e => !e._isHistory);
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
    };
  };

  const canFireAlert = (key, cooldownMs) => {
    if (isHydratingHistory.current) return false;
    const last = coachingCooldowns.current[key];
    if (!last || Date.now() - last > cooldownMs) {
      coachingCooldowns.current[key] = Date.now();
      return true;
    }
    return false;
  };

  const getAlerts = (state) => {
    if (!state || isHydratingHistory.current || !liveActive) return [];
    const { timeSinceLastTip, paceStatus, goalProgress, topTipper, totalRevenue, elapsedMins, liveOnlyCount } = state;
    const deadAirCrit = liveStrategy === 'aggressive' ? 6 : 8;
    const deadAirHigh = liveStrategy === 'aggressive' ? 4 : 5;
    const goalPushPct = liveStrategy === 'aggressive' || liveStrategy === 'goal' ? 80 : 90;
    const alerts = [];
    const logFired = (icon, text) => {
      firedAlertsLog.current.unshift({ icon, text, ts: Date.now() });
      if (firedAlertsLog.current.length > 20) firedAlertsLog.current.length = 20;
    };
    if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirCrit) {
      if (canFireAlert('dead_air_critical', 3 * 60 * 1000)) {
        const context = `No tips in ${Math.round(timeSinceLastTip)} minutes`;
        const action = liveStrategy === 'whale' && topTipper
          ? `Address ${topTipper.username} directly — call them out by name right now`
          : `Start a 2,000 token room goal and ask viewers to vote on the reward`;
        const text = `${context} — ${action}`;
        alerts.push({ priority: 1, level: 'critical', icon: '🚨', text, context, action }); logFired('🚨', text);
      }
    }
    if (goalProgress >= goalPushPct && goalProgress < 100) {
      if (canFireAlert('goal_push', 4 * 60 * 1000)) {
        const context = `Goal is at ${goalProgress}% — the room is primed`;
        const action = `Announce your reward out loud right now and keep the energy high`;
        const text = `${goalProgress}% to goal — push NOW, announce the reward`;
        alerts.push({ priority: 1, level: 'critical', icon: '🎯', text, context, action }); logFired('🎯', text);
      }
    }
    if (timeSinceLastTip !== null && timeSinceLastTip >= deadAirHigh && timeSinceLastTip < deadAirCrit) {
      if (canFireAlert('dead_air_high', 5 * 60 * 1000)) {
        const context = `${Math.round(timeSinceLastTip)} minutes since your last tip`;
        const action = liveStrategy === 'engagement'
          ? `Drop a poll in chat — "50 tokens or 100 tokens?" restarts the tipping cycle`
          : liveStrategy === 'retention'
          ? `Thank a viewer by name — recognition re-engages the room`
          : `Start a quick 200-token goal right now`;
        const text = `${Math.round(timeSinceLastTip)} min since last tip — ${action}`;
        alerts.push({ priority: 2, level: 'warning', icon: '⚠️', text, context, action }); logFired('⚠️', text);
      }
    }
    if (paceStatus === 'below' && elapsedMins >= 8 && liveOnlyCount >= 3) {
      if (canFireAlert('pace_below', 5 * 60 * 1000)) {
        const context = `Revenue pace is below your normal rate`;
        const action = liveStrategy === 'aggressive'
          ? `Announce a limited-time exclusive offer right now`
          : `Activate toy or set a micro-goal to restart momentum`;
        const text = `Pace dropping — ${action}`;
        alerts.push({ priority: 2, level: 'warning', icon: '📉', text, context, action }); logFired('📉', text);
      }
    }
    if (elapsedMins > 75 && paceStatus === 'below' && liveOnlyCount >= 5) {
      if (canFireAlert('stream_fatigue', 15 * 60 * 1000)) {
        const context = `${Math.round(elapsedMins)} minutes in and tip rate is dropping`;
        const action = `Try a new goal or content angle to reset room energy`;
        const text = `Stream fatigue — ${action}`;
        alerts.push({ priority: 2, level: 'warning', icon: '😴', text, context, action }); logFired('😴', text);
      }
    }
    if (paceStatus === 'above' && elapsedMins >= 8 && liveOnlyCount >= 3) {
      if (canFireAlert('pace_above', 8 * 60 * 1000)) {
        const context = `Tip frequency is up — room energy is above your normal pace`;
        const action = liveStrategy === 'aggressive'
          ? `Raise your goal amount RIGHT NOW while the room is hot`
          : `Don't break the energy — keep doing exactly what you're doing`;
        const text = liveStrategy === 'aggressive'
          ? `Momentum is hot — ${action}`
          : `Momentum building — ${action}`;
        alerts.push({ priority: 3, level: 'success', icon: '🔥', text, context, action }); logFired('🔥', text);
      }
    }
    if (goalProgress >= 100) {
      if (canFireAlert('goal_hit', 10 * 60 * 1000)) {
        const context = `You just hit your room goal!`;
        const action = `Set the next goal immediately — momentum drops if there's nothing to tip toward`;
        const text = `Goal hit! ${action}`;
        alerts.push({ priority: 3, level: 'success', icon: '🎉', text, context, action }); logFired('🎉', text);
      }
    }
    if (liveOnlyCount >= 4 && liveStrategy !== 'engagement') {
      const liveOnly = liveEvents.filter(e => !e._isHistory);
      const tipsByUser = {};
      for (const e of liveOnly) {
        if (!e.username) continue;
        if (!tipsByUser[e.username]) tipsByUser[e.username] = [];
        tipsByUser[e.username].push(new Date(e.timestamp).getTime());
      }
      let surfaced = false;
      for (const [uname, times] of Object.entries(tipsByUser)) {
        if (surfaced || times.length < 2) continue;
        const sorted = [...times].sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
        const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const sinceLastMs = Date.now() - sorted[sorted.length - 1];
        if (avgGapMs > 15 * 60 * 1000) continue;
        const ratio = sinceLastMs / avgGapMs;
        if (ratio >= 1.3 && sinceLastMs > 2 * 60 * 1000) {
          if (canFireAlert(`whale_prox_${uname}`, 6 * 60 * 1000)) {
            const avgMins = Math.round(avgGapMs / 60000);
            const sinceMins = Math.round(sinceLastMs / 60000);
            const context = `${uname} usually tips every ~${avgMins} minutes`;
            const action = `${sinceMins} min since their last tip — call them out right now!`;
            const text = `${uname} tips every ~${avgMins} min — ${sinceMins} min since their last. Call them out!`;
            alerts.push({ priority: 3, level: 'info', icon: '🐋', text, context, action }); logFired('🐋', text);
            surfaced = true;
          }
        }
      }
    }
    if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.45) {
      if (canFireAlert(`whale_dep_${topTipper.username}`, 10 * 60 * 1000)) {
        const pctStr = Math.round(topTipper.revenue / totalRevenue * 100);
        const context = `${topTipper.username} is ${pctStr}% of your session revenue`;
        const action = `Give them personal attention and an exclusive offer for their next tip`;
        const text = `${topTipper.username} is ${pctStr}% of revenue — give them attention`;
        alerts.push({ priority: 4, level: 'info', icon: '🐳', text, context, action }); logFired('🐳', text);
      }
    }
    return alerts.sort((a, b) => a.priority - b.priority).slice(0, 4);
  };

  const getNextAction = (state) => {
    if (!state || !liveActive) return { text: 'Start your stream to get live coaching' };
    if (isHydratingHistory.current) return { text: 'Loading session data…' };
    const { timeSinceLastTip, paceStatus, goalProgress, topTipper, totalRevenue, elapsedMins, liveOnlyCount } = state;
    if (liveOnlyCount === 0) return { text: 'Waiting for your first tip — set a goal to get things started.' };
    if (liveStrategy === 'goal') {
      if (goalProgress >= 100) return { text: 'Goal hit! Set the next one immediately — keep the momentum alive.' };
      if (goalProgress >= 75) return { text: `Announce your reward out loud — goal is at ${goalProgress}%.` };
      return { text: `Keep mentioning the goal — you're at ${goalProgress}%.` };
    }
    if (liveStrategy === 'whale') {
      if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.3)
        return { text: `Focus on ${topTipper.username} — give them a VIP experience right now.` };
      if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
        return { text: 'Address your top tipper by name. VIP treatment keeps whales coming back.' };
      return { text: 'Whale mode: every tipper is a VIP. Personal attention creates repeat tips.' };
    }
    if (liveStrategy === 'retention') {
      if (timeSinceLastTip !== null && timeSinceLastTip >= 5)
        return { text: 'Call out 3 viewer names right now — recognition keeps people in the room.' };
      if (topTipper) return { text: `Show ${topTipper.username} real appreciation — loyal fans tip again when they feel seen.` };
      return { text: 'Greet every viewer by name. Retention starts with acknowledgment.' };
    }
    if (liveStrategy === 'engagement') {
      if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
        return { text: 'Drop a poll: "50 tokens or 100 tokens?" — interaction restarts the tipping cycle.' };
      return { text: 'Ask viewers a yes/no question in chat. Engagement always leads to tips.' };
    }
    if (liveStrategy === 'aggressive') {
      if (goalProgress >= 80) return { text: `${goalProgress}% to goal — announce the reward NOW.` };
      if (paceStatus === 'above') return { text: 'Momentum is high — raise your goal amount RIGHT NOW while the room is hot.' };
      if (timeSinceLastTip !== null && timeSinceLastTip >= 4)
        return { text: 'Push mode: "Next tip in 60 sec gets [reward]" — urgency creates action.' };
      return { text: 'Stay aggressive — set visible goals, announce rewards, push every 5 minutes.' };
    }
    if (goalProgress >= 90 && goalProgress < 100)
      return { text: `Announce your reward out loud — goal is ${goalProgress}%.` };
    if (timeSinceLastTip !== null && timeSinceLastTip >= 6)
      return { text: 'Say 3 names in chat right now. "I see [name] — tip to control what I do next."' };
    if (paceStatus === 'below' && elapsedMins >= 8)
      return { text: 'Set a small 50-token goal right now — micro-goals restart momentum when the room slows.' };
    if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.4)
      return { text: `Thank ${topTipper.username} by name and offer them something exclusive for their next tip.` };
    if (elapsedMins < 15 && liveOnlyCount < 3)
      return { text: 'Set a 200-token opening goal and announce it. Early goals train the room to tip.' };
    return { text: 'Keep energy high — acknowledge every tipper by name. Recognition drives repeat tipping.' };
  };

  const addTip = () => {
    const { username, tokens, usd } = liveTipInput;
    if (!username && !tokens && !usd) return;
    const raw = { username: username || 'anonymous', tokens: parseInt(tokens) || 0, usd: parseFloat(usd) || 0, timestamp: new Date(), platform: livePlatform };
    setLiveEvents(prev => [...prev, normalizeTip(raw)]);
    setLiveTipInput({ username: '', tokens: '', usd: '' });
  };

  // ── DEMO SIMULATION ──────────────────────────────────────────────────
  const DEMO_TIPPERS = [
    { username: 'VenusRain', tokens: 100, usd: 5.00 },
    { username: 'DarkFox99', tokens: 500, usd: 25.00 },
    { username: 'PixelKing', tokens: 50,  usd: 2.50 },
    { username: 'NightBlaze', tokens: 200, usd: 10.00 },
    { username: 'CrimsonWave', tokens: 1000, usd: 50.00 },
    { username: 'StarDust7', tokens: 25, usd: 1.25 },
    { username: 'LunarFox', tokens: 75, usd: 3.75 },
  ];
  const DEMO_COACHES = [
    { icon: '🔥', context: 'Tip frequency is up — room energy above your normal pace', action: "Don't break the energy — keep doing exactly what you're doing" },
    { icon: '💎', context: 'DarkFox99 is 38% of your session revenue', action: 'Give them personal attention and an exclusive offer for their next tip' },
    { icon: '🎯', context: 'Goal is at 78% — the room is primed', action: 'Announce your reward out loud right now and keep the energy high' },
    { icon: '🐋', context: 'CrimsonWave usually tips every ~4 minutes', action: '6 min since their last tip — call them out right now!' },
    { icon: '⚡', context: 'Revenue pace is above your normal rate', action: 'Raise your goal amount NOW while the room is hot' },
  ];

  useEffect(() => {
    if (authStatus !== 'unauthenticated' && authStatus !== 'connecting') return;
    if (demoDismissed) return;
    let idx = 0;
    let rev = 0;
    const iv = setInterval(() => {
      const t = DEMO_TIPPERS[idx % DEMO_TIPPERS.length];
      idx++;
      rev = parseFloat((rev + t.usd).toFixed(2));
      setDemoRevenue(rev);
      setDemoTips(prev => [{ ...t, ts: Date.now(), id: idx }, ...prev].slice(0, 6));
      setDemoCoachIdx(c => (c + 1) % DEMO_COACHES.length);
    }, 3200);
    return () => clearInterval(iv);
  }, [authStatus, demoDismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── INLINE AUTH HANDLER ──────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ── CONNECTING / UNAUTHENTICATED SCREENS ─────────────────────────────

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
  const roomHealth     = computeRoomHealth(state);
  const sessionPhase   = detectSessionPhase(state, prevPhaseRef.current);
  const oppScore       = computeOpportunityScore(state, roomHealth);
  const streamHealth   = computeStreamHealth(state, roomHealth, sessionPhase);
  const velocity       = computeRevenueVelocity(state?.currentUPM ?? 0, sessions);
  const comparison     = computeLiveComparison(state, sessions);
  const goalStrategy   = getGoalStrategy(state, roomHealth);
  const recoveryActions = getRecoveryActions(sessionPhase);
  const phaseConfig    = PHASES[sessionPhase] || PHASES.STARTUP;

  if (sessionPhase !== prevPhaseRef.current) {
    if (prevPhaseRef.current !== null) {
      phaseChangeLog.current.unshift({ phase: sessionPhase, prev: prevPhaseRef.current, icon: phaseConfig.icon, label: phaseConfig.label, ts: Date.now() });
      if (phaseChangeLog.current.length > 10) phaseChangeLog.current.length = 10;
    }
    prevPhaseRef.current = sessionPhase;
  }

  const alerts     = getAlerts(state);
  const nextAction = getNextAction(state);

  // ── NEW INTELLIGENCE FEATURES ────────────────────────────────────────

  // Personal Best
  const personalBest = (() => {
    const valid = sessions.filter(s => (s.totalUSD || 0) > 0);
    return valid.length ? parseFloat(Math.max(...valid.map(s => s.totalUSD || 0)).toFixed(2)) : null;
  })();
  const personalBestPct = personalBest && state ? Math.min(Math.round((state.totalRevenue / personalBest) * 100), 110) : null;

  // Goal Pace Predictor
  const goalPaceData = (() => {
    if (!liveGoalTokens || !state || state.elapsedMins < 1.5 || state.totalTokens === 0) return null;
    const tpm = state.totalTokens / state.elapsedMins;
    const projectedAt60 = Math.round(tpm * 60);
    const willHit = projectedAt60 >= liveGoalTokens;
    const minsToGoal = tpm > 0 ? Math.round((liveGoalTokens - state.totalTokens) / tpm) : null;
    const suggestedGoal = Math.round(projectedAt60 * 0.88);
    return { tpm: parseFloat(tpm.toFixed(1)), projectedAt60, willHit, minsToGoal, suggestedGoal };
  })();

  // Earnings Milestones
  const MILESTONES = [5, 10, 25, 50, 75, 100, 150, 200, 300, 500];
  const nextMilestone = (() => {
    if (!state || state.totalRevenue <= 0) return null;
    const next = MILESTONES.find(m => m > state.totalRevenue);
    if (!next) return null;
    const remaining = parseFloat((next - state.totalRevenue).toFixed(2));
    const minsEst = state.currentUPM > 0 ? Math.round(remaining / state.currentUPM) : null;
    const progress = ((next - remaining) / next) * 100;
    return { target: next, remaining, minsEst, progress };
  })();

  // Peak Hour Countdown (computed from sessions history)
  const peakHourData = (() => {
    if (sessions.length < 5) return null;
    const hourRevenue = {};
    const hourCount = {};
    sessions.forEach(s => {
      if (!s.start_time || !(s.totalUSD > 0)) return;
      const h = new Date(s.start_time).getHours();
      hourRevenue[h] = (hourRevenue[h] || 0) + (s.totalUSD || 0);
      hourCount[h] = (hourCount[h] || 0) + 1;
    });
    if (!Object.keys(hourRevenue).length) return null;
    const avgByHour = Object.entries(hourRevenue).map(([h, rev]) => ({ hour: parseInt(h), avg: rev / hourCount[h] }));
    const sorted = avgByHour.sort((a, b) => b.avg - a.avg);
    const peakHour = sorted[0].hour;
    const peakEnd = (peakHour + 2) % 24;
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const inPeak = nowH === peakHour || nowH === (peakHour + 1) % 24;
    if (!inPeak) return null;
    const peakEndMins = peakEnd * 60 - (nowH * 60 + nowM);
    const minsRemaining = peakEndMins > 0 ? peakEndMins : peakEndMins + 1440;
    if (minsRemaining > 120) return null;
    const peakRevTotal = (hourRevenue[peakHour] || 0) + (hourRevenue[(peakHour + 1) % 24] || 0);
    const totalRev = Object.values(hourRevenue).reduce((s, v) => s + v, 0);
    const pct = totalRev > 0 ? Math.round((peakRevTotal / totalRev) * 100) : null;
    return { minsRemaining, peakHour, pct };
  })();

  // Silence Detection Card
  const silenceData = liveActive && state && state.timeSinceLastTip !== null && state.timeSinceLastTip >= 5 ? {
    minutes: Math.round(state.timeSinceLastTip),
    severe: state.timeSinceLastTip >= 9,
    actions: ['Start a new room goal', 'Outfit change', 'Run a viewer poll', 'Spin the wheel', 'Name a public challenge', 'Call out top viewers by name'],
  } : null;

  // Whale / Top Tipper Alert
  const whaleAlert = (() => {
    if (!state?.topTipper || !state?.totalRevenue || !liveActive || state.liveOnlyCount < 3) return null;
    const pct = Math.round((state.topTipper.revenue / state.totalRevenue) * 100);
    if (pct < 35) return null;
    return { username: state.topTipper.username, revenue: state.topTipper.revenue, pct };
  })();

  const PACE_CONFIG = {
    above:    { label: '🔥 Hot',       color: C.green, bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
    on_track: { label: '✅ On Track',   color: C.cyan,  bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)' },
    below:    { label: '📉 Slow',       color: C.red,   bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
    unknown:  { label: '⏳ Starting',   color: C.muted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
  };
  const ALERT_COLORS = { critical: C.red, warning: C.orange, success: C.green, info: C.cyan };
  const pace = PACE_CONFIG[state?.paceStatus || 'unknown'];
  const inp2 = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: C.white, fontSize: 13, outline: 'none', width: '100%' };

  const revenueHistory = [...liveEvents]
    .filter(e => !e._isHistory)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-8)
    .map(e => e.normalizedRevenue || 0);

  // ── RENDER ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui', color: C.white }}>
      <style>{`
        @keyframes cc-slide-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes cc-slide    { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes cc-pulse    { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes cc-glow     { 0%,100%{box-shadow:0 0 8px currentColor;} 50%{box-shadow:0 0 18px currentColor;} }
        @keyframes cc-bar      { from{opacity:0.4;} to{opacity:1;} }
        .cc-card:hover { box-shadow: 0 0 20px rgba(168,85,247,0.2) !important; }
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
            <button onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '13px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 15, cursor: authLoading ? 'not-allowed' : 'pointer', opacity: authLoading ? 0.7 : 1, boxShadow: '0 0 24px rgba(168,85,247,0.3)' }}>
              {authLoading ? 'Please wait…' : authMode === 'signin' ? 'Sign In →' : 'Create Account →'}
            </button>
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
                    <button onClick={() => setExtStep(s => s + 1)} style={{ flex: 2, padding: '11px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Next →</button>
                  ) : (
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => { setShowExtModal(false); setExtStep(0); setAuthMode('signup'); setShowAuthModal(true); }} style={{ width: '100%', padding: '11px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
                        Sign up to save & sync data →
                      </button>
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

      {/* ── STICKY NAV ────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
            CamCash
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, animation: 'cc-pulse 1.2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 1 }}>LIVE</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.muted }}>{user?.email}</span>
          <button onClick={() => setShowDemoPreview(true)} style={{ padding: '7px 14px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, color: C.cyan, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            🎬 Preview Demo
          </button>
          <a href="/dashboard" style={{ padding: '7px 14px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: C.purple, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
            Full Dashboard →
          </a>
          <a href="/camcash-extension.zip" download="camcash-extension.zip" onClick={() => { setShowExtModal(true); setExtStep(0); }} style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
            📥 Get Extension
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} style={{ padding: '7px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

        <EventsSync onNewTip={(events) => {
          const mapped = events.map(e => normalizeTip({
            username: e.object?.user?.username ?? 'anonymous',
            tokens: e.object?.tip?.tokens ?? 0,
            usd: parseFloat(((e.object?.tip?.tokens ?? 0) * 0.05).toFixed(2)),
            timestamp: e.timestamp ? new Date(e.timestamp * 1000) : new Date(),
            platform: 'Chaturbate',
          }))
          setLiveEvents(prev => [...prev, ...mapped])
        }} />

        {/* ── OPERATIONAL STATUS BAR ─────────────────────────────── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Extension', ok: liveEvents.some(e => e.sourceUsed === 'extension'), okText: 'Connected', offText: 'Not detected' },
              { label: 'Realtime',  ok: !!liveTipsChannelRef?.current,                      okText: 'Live',      offText: 'Offline' },
              { label: 'Sync',      ok: liveActive,                                          okText: 'Active',    offText: 'Standby' },
            ].map(({ label, ok, okText, offText }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? C.green : '#374151', boxShadow: ok ? `0 0 5px ${C.green}` : 'none' }} />
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
            <a href="/camcash-extension.zip" download="camcash-extension.zip" onClick={() => { setShowExtModal(true); setExtStep(0); }}
              style={{ padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              📥 Download Extension
            </a>
            {!liveActive ? (
              <button onClick={() => { setLiveActive(true); setLiveStartTime(new Date()); setLiveEvents([]); processedTipIds.current = new Set(); coachingCooldowns.current = {}; }}
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

          {/* Intelligence strip */}
          {liveActive && state && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
              <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: roomHealth.bg, border: `1px solid ${roomHealth.border}` }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Room Heat</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: roomHealth.color }}>{roomHealth.emoji} {roomHealth.label}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{roomHealth.confidence}% confidence</div>
              </div>
              <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Opportunity</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: oppScore.color }}>{oppScore.score}<span style={{ fontSize: 11, fontWeight: 400 }}>/100</span></div>
              </div>
              <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Stream Health</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: streamHealth.grade === 'A' ? C.green : streamHealth.grade === 'B' ? C.cyan : streamHealth.grade === 'C' ? C.gold : C.red }}>{streamHealth.grade}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{streamHealth.score}/100</span>
                </div>
              </div>
              <div style={{ flex: '1 1 160px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Revenue Velocity</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: velocity.color }}>${velocity.currentUPH.toFixed(2)}/hr</div>
              </div>
              {comparison.vsAvgPct !== null && (
                <div style={{ flex: '1 1 130px', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>vs Your Average</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: (comparison.vsAvgPct ?? 0) >= 0 ? C.green : C.red }}>
                    {(comparison.vsAvgPct ?? 0) >= 0 ? '+' : ''}{comparison.vsAvgPct}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── NOT STARTED ───────────────────────────────────────────── */}
        {!liveActive && !liveEvents.length && (
          <div style={{ ...glassCard, borderRadius: 20, padding: '64px 48px', textAlign: 'center', marginBottom: 24, background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.06), rgba(34,211,238,0.05))', position: 'relative', overflow: 'hidden', animation: 'cc-bar 4s ease infinite alternate' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)', animation: 'cc-bar 2s ease infinite alternate' }} />
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔴</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 10 }}>Live Command Center</div>
            <div style={{ fontSize: 14, color: C.muted, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.75 }}>
              Your AI coach watches the room in real time — tracking momentum, spotting opportunities, and telling you exactly what to do next to make more money.
            </div>
            <button onClick={() => { setLiveActive(true); setLiveStartTime(new Date()); setLiveEvents([]); processedTipIds.current = new Set(); coachingCooldowns.current = {}; }}
              style={{ padding: '13px 36px', borderRadius: 12, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 32px rgba(16,185,129,0.4)' }}>
              ▶ Start Streaming
            </button>
          </div>
        )}

        {(liveActive || liveEvents.length > 0) && (
          <div>

            {/* ── ROOM STATE HERO ────────────────────────────────── */}
            {(() => {
              const rhKey = roomHealth.state || 'COLD';
              const rhMap = {
                COLD:      { from: 'rgba(15,20,35,0.97)',  to: 'rgba(20,28,48,0.97)',   glow: 'rgba(30,40,80,0.2)' },
                WARMING:   { from: 'rgba(14,28,55,0.97)',  to: 'rgba(20,40,70,0.97)',   glow: 'rgba(34,211,238,0.12)' },
                ACTIVE:    { from: 'rgba(16,30,62,0.97)',  to: 'rgba(26,52,90,0.97)',   glow: 'rgba(34,211,238,0.22)' },
                HOT:       { from: 'rgba(38,16,72,0.97)',  to: 'rgba(58,22,92,0.97)',   glow: 'rgba(168,85,247,0.32)' },
                EXPLOSIVE: { from: 'rgba(60,12,28,0.98)',  to: 'rgba(88,18,38,0.98)',   glow: 'rgba(248,113,113,0.42)' },
              };
              const rg = rhMap[rhKey] || rhMap.COLD;
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
                        { label: 'Revenue',     value: `$${state?.totalRevenue?.toFixed(2) || '0.00'}`, color: C.green,          size: 28 },
                        { label: 'Tokens',      value: (state?.totalTokens || 0).toLocaleString(),       color: C.cyan,           size: 22 },
                        { label: 'Pace',        value: pace.label,                                        color: pace.color,       size: 18 },
                        { label: 'Opportunity', value: `${oppScore.score}/100`,                           color: oppScore.color,   size: 22 },
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
              );
            })()}

            {/* ── AI COACH CENTERPIECE ─────────────────────────────── */}
            {(() => {
              const topAlert = alerts[0];
              const restAlerts = alerts.slice(1);
              const urgencyMap = {
                critical: { bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.38)', badge: 'rgba(248,113,113,0.22)', badgeText: C.red,   tag: '🚨 CRITICAL ACTION' },
                warning:  { bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.38)',  badge: 'rgba(245,158,11,0.22)',  badgeText: C.gold,  tag: '⚠️ ALERT' },
                success:  { bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.38)',  badge: 'rgba(16,185,129,0.22)',  badgeText: C.green, tag: '🔥 MOMENTUM' },
                info:     { bg: 'rgba(34,211,238,0.09)',  border: 'rgba(34,211,238,0.38)',  badge: 'rgba(34,211,238,0.22)',  badgeText: C.cyan,  tag: '💡 INSIGHT' },
              };
              const uc = topAlert ? (urgencyMap[topAlert.level] || urgencyMap.info) : null;
              const def = { bg: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(124,92,255,0.1))', border: 'rgba(168,85,247,0.3)', badge: 'rgba(236,72,153,0.2)', badgeText: C.pink, tag: '⚡ DO THIS NOW' };
              const sty = uc || def;
              return (
                <div style={{ borderRadius: 16, padding: '26px 28px', marginBottom: 20, background: topAlert ? sty.bg : def.bg, border: `1px solid ${topAlert ? sty.border : def.border}`, boxShadow: topAlert?.level === 'critical' ? '0 0 32px rgba(248,113,113,0.12)' : 'none', animation: topAlert?.level === 'critical' ? 'cc-glow 2.5s ease-in-out infinite' : 'none', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ec4899, #a855f7, #22d3ee)', backgroundSize: '200% 100%', animation: 'cc-bar 2s ease infinite alternate' }} />
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ padding: '3px 10px', borderRadius: 6, background: topAlert ? sty.badge : def.badge, fontSize: 10, fontWeight: 800, color: topAlert ? sty.badgeText : def.badgeText, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                          {topAlert ? sty.tag : def.tag}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>AI Coach · {liveStrategy} mode</div>
                      </div>
                      {topAlert?.context && (
                        <div style={{ fontSize: 13, color: topAlert ? sty.badgeText : C.pink, opacity: 0.85, marginBottom: 6, fontWeight: 600, lineHeight: 1.4 }}>
                          {topAlert.context}
                        </div>
                      )}
                      <div style={{ fontSize: 19, fontWeight: 700, color: C.white, lineHeight: 1.65, marginBottom: topAlert && nextAction.text !== topAlert.text ? 12 : 0 }}>
                        {topAlert ? (topAlert.action || topAlert.text) : nextAction.text}
                      </div>
                      {topAlert && nextAction.text !== topAlert.text && (
                        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                          <span style={{ color: topAlert ? sty.badgeText : C.pink, fontWeight: 700 }}>Next: </span>{nextAction.text}
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
              );
            })()}

            {/* ── MAIN GRID ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20, marginBottom: 20 }}>

              {/* LEFT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* 4 stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Revenue',  value: `$${state?.totalRevenue?.toFixed(2) || '0.00'}`,           color: C.green,      sub: velocity.label || null,         showSparkline: true },
                    { label: 'Tips/min', value: state?.tipsPerMinute?.toFixed(2) || '0.00',                color: C.cyan,       sub: `${state?.liveOnlyCount || 0} tips live`, showSparkline: false },
                    { label: 'Avg Tip',  value: `$${state?.avgTipValue?.toFixed(2) || '0.00'}`,            color: C.gold,       sub: state?.topTipper ? `Top: ${state.topTipper.username}` : null, showSparkline: false },
                    { label: 'Rev/hr',   value: `$${velocity.currentUPH.toFixed(0)}`,                      color: velocity.color, sub: comparison.vsAvgPct !== null ? `${(comparison.vsAvgPct ?? 0) >= 0 ? '+' : ''}${comparison.vsAvgPct}% vs avg` : null, showSparkline: false },
                  ].map(({ label, value, color, sub, showSparkline }) => (
                    <div key={label} className="cc-card" style={{ ...glassCard, borderRadius: 12, padding: 18, transition: 'box-shadow 0.2s ease', cursor: 'default' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 20px ${color}28`; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                      {showSparkline && revenueHistory.length >= 2 && (() => {
                        const d = revenueHistory, w = 72, h = 28;
                        const mx = Math.max(...d), mn = Math.min(...d), rng = mx - mn || 1;
                        const pts = d.map((v, i) => `${(i/(d.length-1))*w},${h-((v-mn)/rng)*h}`).join(' ');
                        return <svg width={w} height={h} style={{ display:'block', overflow:'visible', marginTop: 4 }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
                      })()}
                      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Pace + Goal */}
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

                {/* ── GOAL PACE PREDICTOR + PERSONAL BEST + MILESTONES ── */}
                {liveActive && state && (goalPaceData || personalBest !== null || nextMilestone) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>

                    {/* Goal Pace Predictor */}
                    {goalPaceData && liveGoalTokens > 0 && (
                      <div style={{ borderRadius: 12, padding: '14px 18px', background: goalPaceData.willHit ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${goalPaceData.willHit ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Goal Pace Predictor</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Current pace</span>
                          <span style={{ fontSize: 11, color: C.white, fontWeight: 700 }}>{goalPaceData.tpm} t/min</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Projected (60 min)</span>
                          <span style={{ fontSize: 11, color: C.white, fontWeight: 700 }}>{goalPaceData.projectedAt60.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Goal</span>
                          <span style={{ fontSize: 11, color: C.white, fontWeight: 700 }}>{liveGoalTokens.toLocaleString()}</span>
                        </div>
                        <div style={{ padding: '7px 10px', borderRadius: 8, background: goalPaceData.willHit ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: goalPaceData.willHit ? C.green : C.gold }}>
                            {goalPaceData.willHit ? '✅ On Track to Hit' : '⚠️ Likely to Miss'}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                            {goalPaceData.willHit
                              ? (goalPaceData.minsToGoal !== null ? `~${goalPaceData.minsToGoal} min remaining` : 'Keep the pace up')
                              : `Reduce goal to ${goalPaceData.suggestedGoal.toLocaleString()} or increase urgency`}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Session Personal Best */}
                    {personalBest !== null && state && (
                      <div style={{ ...glassCard, borderRadius: 12, padding: '14px 18px' }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Session Record</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Today</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.green }}>${state.totalRevenue.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Personal best</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>${personalBest.toFixed(2)}</span>
                        </div>
                        {personalBestPct !== null && (
                          <>
                            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 6 }}>
                              <div style={{ height: '100%', width: `${Math.min(personalBestPct, 100)}%`, borderRadius: 2, background: personalBestPct >= 100 ? `linear-gradient(90deg, ${C.green}, ${C.cyan})` : `linear-gradient(90deg, ${C.gold}, ${C.orange})`, transition: 'width 0.5s ease' }} />
                            </div>
                            <div style={{ fontSize: 10, color: personalBestPct >= 100 ? C.green : C.muted }}>
                              {personalBestPct >= 100 ? '🏆 New personal best!' : `${personalBestPct}% of your record · $${(personalBest - state.totalRevenue).toFixed(2)} to beat it`}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Next Earnings Milestone */}
                    {nextMilestone && state && (
                      <div style={{ borderRadius: 12, padding: '14px 18px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.22)' }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>🎉 Next Milestone</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: C.purple, marginBottom: 4 }}>${nextMilestone.target}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                          Only <span style={{ color: C.white, fontWeight: 700 }}>${nextMilestone.remaining}</span> away
                          {nextMilestone.minsEst !== null && <span style={{ color: C.muted }}> · ~{nextMilestone.minsEst} min</span>}
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${nextMilestone.progress}%`, borderRadius: 2, background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible tip input */}
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

                {/* Live event feed */}
                {liveEvents.length > 0 && (
                  <div style={{ ...glassCard, borderRadius: 12, padding: 16, flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                      Live Event Feed
                      <span style={{ marginLeft: 8, color: C.dim, fontWeight: 400, textTransform: 'none', fontSize: 10, letterSpacing: 0 }}>— {liveEvents.filter(e => !e._isHistory).length} live tips</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
                      {[...liveEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((ev, i) => {
                        const isFlash = ev._id && ev._id === flashTipId;
                        const isNew   = i === 0 && !ev._isHistory;
                        const isBig   = (ev.normalizedRevenue || 0) >= 5;
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Stream Health */}
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
                      { label: 'Momentum',   value: streamHealth.components.momentum,   max: 30, color: C.green },
                      { label: 'Engagement', value: streamHealth.components.engagement,  max: 30, color: C.cyan },
                      { label: 'Velocity',   value: streamHealth.components.velocity,    max: 25, color: C.gold },
                      { label: 'Recovery',   value: streamHealth.components.recovery,    max: 15, color: '#a855f7' },
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

                {/* Recovery Actions */}
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

                {/* Opportunity Signals */}
                {liveActive && state && oppScore.signals.length > 0 && (
                  <div style={{ ...glassCard, borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Why These Alerts?</div>
                      <div style={{ padding: '2px 8px', borderRadius: 6, background: `${oppScore.color}18`, fontSize: 11, fontWeight: 800, color: oppScore.color }}>{oppScore.score}/100</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {oppScore.signals.map((sig, i) => (
                        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <span style={{ color: oppScore.color, fontSize: 12, flexShrink: 0 }}>→</span>
                          <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{sig}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Peak Hour Countdown */}
                {liveActive && peakHourData && (
                  <div style={{ borderRadius: 14, padding: '16px 18px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)' }}>
                    <div style={{ fontSize: 9, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>⏳ Peak Window Ends In</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: C.gold, marginBottom: 4 }}>
                      {peakHourData.minsRemaining >= 60
                        ? `${Math.floor(peakHourData.minsRemaining / 60)}h ${peakHourData.minsRemaining % 60}m`
                        : `${peakHourData.minsRemaining} min`}
                    </div>
                    {peakHourData.pct !== null && (
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                        Historically {peakHourData.pct}% of your revenue comes in this window — push hard now.
                      </div>
                    )}
                  </div>
                )}

                {/* Silence Detection */}
                {silenceData && (
                  <div style={{ borderRadius: 14, padding: '16px 18px', background: silenceData.severe ? 'rgba(248,113,113,0.08)' : 'rgba(245,158,11,0.07)', border: `1px solid ${silenceData.severe ? 'rgba(248,113,113,0.35)' : 'rgba(245,158,11,0.28)'}`, animation: silenceData.severe ? 'cc-glow 2.5s ease-in-out infinite' : 'none' }}>
                    <div style={{ fontSize: 9, color: silenceData.severe ? C.red : C.gold, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>
                      {silenceData.severe ? '🚨 Room Stalling' : '⚠️ Going Quiet'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>
                      No tips in {silenceData.minutes} minutes
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
                      Historically this is where sessions decline. Pick one now:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {silenceData.actions.map((action, i) => (
                        <div key={i} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: C.white, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: silenceData.severe ? C.red : C.gold, fontWeight: 800, fontSize: 10, flexShrink: 0 }}>{i + 1}.</span>
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Whale / Top Tipper Alert */}
                {whaleAlert && (
                  <div style={{ borderRadius: 14, padding: '16px 18px', background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.3)' }}>
                    <div style={{ fontSize: 9, color: C.cyan, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>💎 Top Tipper This Session</div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: C.white, marginBottom: 8 }}>{whaleAlert.username}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Tipped this session</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.cyan }}>${whaleAlert.revenue.toFixed(2)}</span>
                    </div>
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.1)', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: C.cyan, fontWeight: 700 }}>{whaleAlert.pct}% of your session revenue</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, lineHeight: 1.5 }}>
                      → Thank them publicly and offer something exclusive for their next tip
                    </div>
                  </div>
                )}

                {/* Extension Status */}
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
                    <a href="/camcash-extension.zip" download="camcash-extension.zip" style={{ display: 'inline-block', padding: '6px 14px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>📥 Download Extension →</a>
                  )}
                </div>
              </div>
            </div>

            {/* ── BOTTOM PANELS ─────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>

              {/* Session Timeline */}
              {liveActive && (liveEvents.length > 0 || phaseChangeLog.current.length > 0) && (() => {
                const tipEntries   = liveEvents.filter(e => !e._isHistory).map(e => ({ type: 'tip',   ts: new Date(e.timestamp).getTime(), icon: (e.normalizedRevenue || 0) >= 5 ? '🐋' : '💰', text: `${e.username} — ${e.tokens > 0 ? e.tokens + 't' : ''} $${(e.normalizedRevenue || 0).toFixed(2)}`, color: (e.normalizedRevenue || 0) >= 5 ? C.gold : C.green }));
                const phaseEntries = phaseChangeLog.current.map(p => ({ type: 'phase', ts: p.ts, icon: p.icon, text: `Phase → ${p.label}`, color: C.cyan }));
                const alertEntries = firedAlertsLog.current.slice(0, 6).map(a => ({ type: 'alert',   ts: a.ts, icon: a.icon, text: a.text, color: C.muted }));
                const merged = [...tipEntries, ...phaseEntries, ...alertEntries].sort((a, b) => b.ts - a.ts).slice(0, 20);
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
                );
              })()}

              {/* Alert History */}
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

        {/* ── EXTENSION + ACCESS + QR ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 12 }}>

          {/* Extension card */}
          <div style={{ borderRadius: 16, padding: '24px 28px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #7c3aed)', animation: 'cc-bar 2s ease infinite alternate' }} />
            <div style={{ fontSize: 28, marginBottom: 10 }}>🧩</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>CamCash Chrome Extension</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 16 }}>
              Automatically captures every tip from Chaturbate and sends it here in real time — no manual logging. Works silently in the background while you stream.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {['Auto-captures tips from Chaturbate', 'Syncs to this dashboard instantly', 'Floating HUD shows coaching on-screen', 'Free to install · takes 30 seconds'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: C.green, fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{f}</span>
                </div>
              ))}
            </div>
            <a href="/camcash-extension.zip" download="camcash-extension.zip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 10, fontWeight: 800, textDecoration: 'none', fontSize: 14, boxShadow: '0 0 20px rgba(168,85,247,0.35)' }}>
              📥 Download Extension →
            </a>
          </div>

          {/* Full Access card */}
          <div style={{ borderRadius: 16, padding: '24px 28px', background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.25)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ec4899, #a855f7, #22d3ee)', animation: 'cc-bar 2s ease infinite alternate' }} />
            <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>Full Dashboard Access</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 16 }}>
              CamCash is completely free during beta. Create an account to unlock your full earnings history, session breakdowns, top tipper reports, and the complete AI command center.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {['Historical session breakdowns', 'Top tipper + whale tracking', 'Earnings by day / hour / platform', 'AI coach with 6 strategy modes', '100% free during beta'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: C.pink, fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/signup" style={{ flex: 1, display: 'inline-block', textAlign: 'center', padding: '11px 0', background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, color: '#fff', borderRadius: 10, fontWeight: 800, textDecoration: 'none', fontSize: 14, boxShadow: '0 0 20px rgba(236,72,153,0.3)' }}>
                Create Free Account →
              </a>
              <a href="/dashboard" style={{ display: 'inline-block', textAlign: 'center', padding: '11px 16px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', color: C.purple, borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
                Dashboard
              </a>
            </div>
          </div>

          {/* QR Code card */}
          <div style={{ borderRadius: 16, padding: '24px 28px', background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #22d3ee, #a855f7)', animation: 'cc-bar 2s ease infinite alternate' }} />
            <div style={{ fontSize: 28, marginBottom: 10 }}>📱</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>Open on Your Phone</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Scan to open CamCash on any device — keep live mode running on your phone while you stream.
            </div>
            {/* QR code — points to camcashgrl.com/live */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 10, marginBottom: 14, display: 'inline-block' }}>
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://www.camcashgrl.com/live&color=040812&bgcolor=ffffff"
                alt="QR code for camcashgrl.com/live"
                width={140}
                height={140}
                style={{ display: 'block', borderRadius: 4 }}
              />
            </div>
            <div style={{ fontSize: 11, color: C.dim }}>camcashgrl.com/live</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <a href="/camcash-extension.zip" download="camcash-extension.zip" style={{ fontSize: 11, color: C.cyan, textDecoration: 'underline' }}>Get Extension</a>
              <span style={{ color: C.dim }}>·</span>
              <a href="/signup" style={{ fontSize: 11, color: C.purple, textDecoration: 'underline' }}>Sign Up Free</a>
            </div>
          </div>
        </div>

      </div>

      {/* ── DEMO PREVIEW MODAL ──────────────────────────────────── */}
      {showDemoPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0a0f1e', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 20, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 80px rgba(168,85,247,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(168,85,247,0.15)', background: 'rgba(168,85,247,0.06)', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>🎬 Live Mode — Interactive Demo</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>This is what a new visitor sees — simulated live session with fake data</div>
              </div>
              <button onClick={() => setShowDemoPreview(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: C.muted, fontSize: 18, cursor: 'pointer', padding: '4px 12px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe
              src="/live?__demo=1"
              style={{ flex: 1, border: 'none', width: '100%', minHeight: 560 }}
              title="Live Mode Demo Preview"
            />
          </div>
        </div>
      )}
      <FeedbackWidget />
    </div>
  );
}
