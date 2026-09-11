'use client';

import { useState, useEffect, useRef } from 'react';
import { track } from '../../../lib/track';
import Button from '../../../components/ui/Button';

const C = {
  bg: '#05070f',
  card: 'rgba(15,20,32,0.75)',
  border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7',
  cyan: '#22d3ee',
  green: '#10b981',
  white: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
  text: '#e2e8f0',
  pink: '#ec4899',
  gold: '#f59e0b',
  red: '#f87171',
  orange: '#f97316',
};

const glass = {
  background: 'rgba(15,20,32,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)',
};

// Simulated-second timestamps
const MILESTONES = [
  { time: 0,    id: 'start',     label: 'Stream starts',       icon: '🎬', color: C.green,
    calloutTitle: 'Stream is live on 3 platforms',
    calloutBody:  'CamCash is watching Chaturbate, BongaCams, and MyFreeCams simultaneously. Every tip is captured in real time — zero manual logging.' },
  { time: 120,  id: 'peak',      label: 'Peak hours glow',     icon: '⚡', color: C.gold,
    calloutTitle: "You're in a peak earning window",
    calloutBody:  'Based on your stream history, the next 90 minutes are your highest-converting hours. CamCash surfaced this pattern automatically and is pushing more aggressive coaching.' },
  { time: 300,  id: 'visitor',   label: 'New visitor',         icon: '👤', color: C.cyan,
    calloutTitle: 'Engagement prompt fired',
    calloutBody:  'A fresh viewer just entered. CamCash suggested: "Say hi to new members + share your tip menu." Room title update recommended: ✨ NEW GOAL OPEN | TIP REQUESTS WELCOME' },
  { time: 480,  id: 'whale',     label: 'WhaleDaddy99 joins',  icon: '🐋', color: C.purple,
    calloutTitle: '🚨 Fan CRM Whale Alert',
    calloutBody:  'WhaleDaddy99 just joined — your #1 tipper. Last tipped $847 total. CamCash: "Say his name out loud. Acknowledge him publicly. He tips big when recognized."' },
  { time: 720,  id: 'dip',       label: 'Engagement dip',      icon: '📉', color: C.orange,
    calloutTitle: 'Engagement dip detected',
    calloutBody:  'Tip velocity dropped below 0.3/min. CamCash is recommending a token goal to re-energize the room and give viewers a concrete reason to tip right now.' },
  { time: 900,  id: 'goal',      label: 'Token goal launched', icon: '🎯', color: C.cyan,
    calloutTitle: 'Token goal is live — 500 tokens',
    calloutBody:  'CamCash is tracking your pace in real time. If you fall behind target, it will fire a mid-goal shoutout suggestion or animated countdown prompt.' },
  { time: 1200, id: 'goal_hit',  label: 'Goal HIT! 🎉',        icon: '🎉', color: C.green,
    calloutTitle: 'Goal smashed in record time',
    calloutBody:  'Room hit 500 tokens in ~5 minutes. Average for this room type is 12 min. You ran 2.4× ahead of baseline. CamCash logged this as a session personal best.' },
  { time: 1500, id: 'boost',     label: 'Whale boost',         icon: '🚀', color: C.purple,
    calloutTitle: 'Whale cluster detected',
    calloutBody:  'Two high-value tippers entered simultaneously. CamCash fired a "stack your goal" suggestion — extend momentum immediately with a second goal before the energy drops.' },
  { time: 1800, id: 'title',     label: 'Title auto-switched', icon: '✏️', color: C.pink,
    calloutTitle: 'AI room title switch',
    calloutBody:  "30 min in — stale titles kill discovery. CamCash analyzed your stream phase and picked the highest-converting title format. It switched automatically." },
  { time: 2100, id: 'summary',   label: 'Stream summary',      icon: '📊', color: C.cyan,
    calloutTitle: 'Session complete',
    calloutBody:  'CamCash compiled your full session: earnings by platform, top tippers, best moments, and 3 personalized suggestions for your next stream.' },
];

const SMALL_TIPS  = ['TipperTony', 'BasicBob', 'HappyViewer', 'Lurker22', 'CasualFan99', 'JustWatching', 'NewHere01', 'RegularRob'];
const MED_TIPS    = ['BigSpender', 'GoldRush', 'PremiumPete', 'TipMaster', 'SilverKing', 'FanBoy88'];
const WHALE_NAMES = ['WhaleDaddy99', 'BigWhale77', 'TopDog420'];

const PLT_COLOR = { CB: C.purple, BC: C.pink, MFC: C.cyan };
const PLT_NAME  = { CB: 'Chaturbate', BC: 'BongaCams', MFC: 'MyFreeCams' };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function randPlatform() { const r = Math.random(); return r < 0.5 ? 'CB' : r < 0.8 ? 'BC' : 'MFC'; }
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const CONFETTI_COLORS = ['#a855f7', '#22d3ee', '#ec4899', '#f59e0b', '#10b981', '#f97316'];

export default function LiveDemoPage() {
  const [demoTime,     setDemoTime]     = useState(0);
  const [speed,        setSpeed]        = useState(5);
  const [tips,         setTips]         = useState([]);
  const [earnings,     setEarnings]     = useState({ CB: 0, BC: 0, MFC: 0 });
  const [milestoneIdx, setMilestoneIdx] = useState(0);
  const [goalProgress, setGoalProgress] = useState(0);
  const [goalActive,   setGoalActive]   = useState(false);
  const [goalHit,      setGoalHit]      = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [roomTitle,    setRoomTitle]    = useState('💫 CHATTING | TIP MENU OPEN | FEELING GOOD');
  const [streamDone,   setStreamDone]   = useState(false);
  const [peakGlow,     setPeakGlow]     = useState(false);
  const [whaleAlert,   setWhaleAlert]   = useState(false);
  const [topTippers,   setTopTippers]   = useState({});

  const speedRef        = useRef(5);
  const demoTimeRef     = useRef(0);
  const tickRef         = useRef(null);
  const milestoneRef    = useRef(0);
  const lastTipRef      = useRef(-99);
  const tipIdRef        = useRef(0);
  const earningsRef     = useRef({ CB: 0, BC: 0, MFC: 0 });
  const topTippersRef   = useRef({});
  const goalHitRef      = useRef(false);
  const whaleAlertTRef  = useRef(null);
  const boostFiredRef   = useRef(false);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    function fireTip(username, tokens, platform) {
      const usd = parseFloat((tokens * 0.05).toFixed(2));
      const tip = { id: ++tipIdRef.current, username, tokens, usd, platform, ts: demoTimeRef.current };
      earningsRef.current[platform] = parseFloat((earningsRef.current[platform] + usd).toFixed(2));
      topTippersRef.current[username] = parseFloat(((topTippersRef.current[username] || 0) + usd).toFixed(2));
      setTips(prev => [tip, ...prev].slice(0, 40));
      setEarnings({ ...earningsRef.current });
      setTopTippers({ ...topTippersRef.current });
      lastTipRef.current = demoTimeRef.current;
    }

    track('live_demo_started')
    tickRef.current = setInterval(() => {
      const t = demoTimeRef.current + 0.1 * speedRef.current;
      demoTimeRef.current = t;
      setDemoTime(t);

      if (t >= 2200) {
        clearInterval(tickRef.current);
        setStreamDone(true);
        return;
      }

      // Milestone detection
      const newIdx = MILESTONES.filter(m => m.time <= t).length - 1;
      if (newIdx !== milestoneRef.current) {
        milestoneRef.current = newIdx;
        setMilestoneIdx(newIdx);
        const mId = MILESTONES[newIdx]?.id;

        if (mId === 'peak') setPeakGlow(true);

        if (mId === 'whale') {
          setWhaleAlert(true);
          whaleAlertTRef.current = t;
          fireTip('WhaleDaddy99', randInt(120, 200), 'CB');
        }

        if (mId === 'goal') setGoalActive(true);

        if (mId === 'goal_hit') {
          goalHitRef.current = true;
          setGoalHit(true);
          setGoalProgress(100);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
          fireTip('WhaleDaddy99', randInt(50, 100), 'CB');
        }

        if (mId === 'title') {
          setTimeout(() => setRoomTitle('🔥 NEW GOAL OPEN | TIP REQUESTS WELCOME | INTERACTIVE'), 1500);
        }
      }

      // Dismiss whale alert after 40 simulated seconds
      if (whaleAlertTRef.current && t - whaleAlertTRef.current > 40) {
        setWhaleAlert(false);
        whaleAlertTRef.current = null;
      }

      // Goal progress (900–1200s)
      if (t >= 900 && t < 1200 && !goalHitRef.current) {
        setGoalProgress(Math.min(99, ((t - 900) / 300) * 100));
      }

      // Boost burst (1500–1560s, fire a few whale tips)
      if (t >= 1500 && t < 1502 && !boostFiredRef.current) {
        boostFiredRef.current = true;
        const burstTippers = ['WhaleDaddy99', 'BigWhale77', 'TopDog420'];
        burstTippers.forEach((name, i) => {
          setTimeout(() => fireTip(name, randInt(80, 200), ['CB', 'BC', 'MFC'][i]), i * 600);
        });
      }

      // Tip generation
      const sinceLastTip = t - lastTipRef.current;
      let interval, tokens, username;

      if      (t < 120)                        { interval = randInt(8, 15);  tokens = randInt(1, 5);   username = pick(SMALL_TIPS); }
      else if (t < 480)                        { interval = randInt(4, 8);   tokens = randInt(10, 25); username = pick(MED_TIPS); }
      else if (t < 720)                        { interval = randInt(5, 10);  tokens = randInt(5, 15);  username = pick([...SMALL_TIPS, ...MED_TIPS]); }
      else if (t < 900)                        { interval = randInt(12, 20); tokens = randInt(3, 8);   username = pick(SMALL_TIPS); }
      else if (t < 1200)                       { interval = randInt(3, 6);   tokens = randInt(10, 30); username = pick(MED_TIPS); }
      else if (t >= 1500 && t < 1600)         { interval = randInt(2, 4);   tokens = randInt(20, 80); username = Math.random() < 0.3 ? pick(WHALE_NAMES) : pick(MED_TIPS); }
      else                                     { interval = randInt(8, 15);  tokens = randInt(5, 20);  username = pick([...SMALL_TIPS, ...MED_TIPS]); }

      if (sinceLastTip >= interval) {
        fireTip(username, tokens, randPlatform());
      }
    }, 100);

    return () => clearInterval(tickRef.current);
  }, []);

  const totalEarnings = Object.values(earnings).reduce((a, b) => a + b, 0);
  const activeMilestone = MILESTONES[milestoneIdx];

  const topTipperList = Object.entries(topTippers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.white }}>
      <style>{`
        @keyframes cc-pulse   { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes cc-slide   { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes cc-bar     { from{opacity:0.6;} to{opacity:1;} }
        @keyframes cc-glow    { 0%,100%{box-shadow:0 0 8px rgba(168,85,247,0.4);} 50%{box-shadow:0 0 24px rgba(168,85,247,0.8);} }
        @keyframes cc-peak    { 0%,100%{box-shadow:0 0 10px rgba(245,158,11,0.2);} 50%{box-shadow:0 0 28px rgba(245,158,11,0.7);} }
        @keyframes cc-goal-p  { 0%,100%{box-shadow:0 0 8px rgba(34,211,238,0.3);} 50%{box-shadow:0 0 22px rgba(34,211,238,0.8);} }
        @keyframes cc-confetti {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Confetti burst */}
      {showConfetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, overflow: 'hidden' }}>
          {Array.from({ length: 70 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: '-20px',
              width: `${5 + Math.random() * 8}px`,
              height: `${5 + Math.random() * 8}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `cc-confetti ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 1.5}s forwards`,
            }} />
          ))}
        </div>
      )}

      {/* ── GO LIVE STATUS BAR ── */}
      <div style={{
        background: 'rgba(4,8,18,0.97)',
        borderBottom: `1px solid ${peakGlow ? 'rgba(245,158,11,0.35)' : 'rgba(168,85,247,0.2)'}`,
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
        position: 'sticky', top: 0, zIndex: 50,
        animation: peakGlow ? 'cc-peak 2.5s ease infinite' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900, background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CamCash
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 10px ${C.green}`, animation: 'cc-pulse 1.2s ease infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 0.5 }}>GO LIVE</span>
          </div>
          <span style={{ fontSize: 11, color: C.muted }}>{fmtTime(demoTime)} elapsed</span>
          <span style={{ fontSize: 10, color: C.dim, fontStyle: 'italic', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomTitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['CB', 'BC', 'MFC'].map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLT_COLOR[p], animation: 'cc-pulse 2s ease infinite' }} />
              <span style={{ fontSize: 10, color: PLT_COLOR[p], fontWeight: 700 }}>{p}</span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: C.muted }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.green }}>${totalEarnings.toFixed(2)}</span>
          </div>
          {peakGlow && (
            <div style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', fontSize: 10, color: C.gold, fontWeight: 800 }}>
              ⚡ PEAK WINDOW
            </div>
          )}
        </div>
      </div>

      {/* ── DEMO BANNER + SPEED ── */}
      <div style={{ background: 'rgba(168,85,247,0.07)', borderBottom: '1px solid rgba(168,85,247,0.15)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.2)', fontSize: 9, fontWeight: 800, color: C.purple, letterSpacing: 1 }}>LIVE DEMO</div>
          <span style={{ fontSize: 11, color: C.muted }}>Auto-playing a scripted 35-min stream — no auth required</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: C.dim }}>Speed:</span>
          {[1, 5, 10].map(s => (
            <button key={s} onClick={() => { setSpeed(s); speedRef.current = s; track('live_demo_speed_changed', { speed: s }); }} style={{
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              border: speed === s ? `1px solid ${C.cyan}` : '1px solid rgba(255,255,255,0.1)',
              background: speed === s ? 'rgba(34,211,238,0.12)' : 'transparent',
              color: speed === s ? C.cyan : C.muted,
              fontSize: 11, fontWeight: speed === s ? 800 : 500,
            }}>{s}×</button>
          ))}
        </div>
      </div>

      {/* ── MILESTONE TIMELINE ── */}
      <div style={{ padding: '14px 24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content' }}>
          {MILESTONES.map((m, i) => {
            const done   = i < milestoneIdx;
            const active = i === milestoneIdx;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: done ? 0.55 : active ? 1 : 0.3 }}>
                  <div style={{
                    width: active ? 34 : 26, height: active ? 34 : 26, borderRadius: '50%',
                    background: done ? 'rgba(16,185,129,0.2)' : active ? `linear-gradient(135deg, ${m.color}, ${C.purple})` : 'rgba(255,255,255,0.05)',
                    border: active ? `2px solid ${m.color}` : done ? `2px solid ${C.green}` : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: active ? 15 : 12,
                    animation: active ? 'cc-glow 2s ease infinite' : 'none',
                    transition: 'all 0.35s ease',
                    color: done ? C.green : C.white,
                  }}>
                    {done ? '✓' : m.icon}
                  </div>
                  <span style={{ fontSize: 9, color: active ? C.white : C.dim, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap', maxWidth: 78, textAlign: 'center', lineHeight: 1.3 }}>{m.label}</span>
                </div>
                {i < MILESTONES.length - 1 && (
                  <div style={{ width: 28, height: 2, margin: '0 3px', marginBottom: 18, background: done ? `linear-gradient(90deg, ${C.green}66, ${C.green}22)` : 'rgba(255,255,255,0.05)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Peak hours banner */}
        {peakGlow && milestoneIdx >= 1 && milestoneIdx < 9 && (
          <div style={{
            borderRadius: 12, padding: '11px 18px', marginBottom: 16,
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'cc-peak 2.5s ease infinite',
          }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>You're in a peak earning window</span>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>Historically your highest-converting 90 minutes — push harder now</span>
            </div>
          </div>
        )}

        {/* Whale CRM alert */}
        {whaleAlert && (
          <div style={{
            borderRadius: 12, padding: '14px 20px', marginBottom: 16,
            background: 'rgba(168,85,247,0.09)', border: '1px solid rgba(168,85,247,0.5)',
            display: 'flex', alignItems: 'center', gap: 14,
            animation: 'cc-slide 0.4s ease',
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>🐋</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: C.purple, marginBottom: 3 }}>WhaleDaddy99 just entered your room</div>
              <div style={{ fontSize: 12, color: C.muted }}>Your #1 tipper — <strong style={{ color: C.gold }}>$847 total tipped</strong>. Say his name out loud. Acknowledge him publicly. He tips big when recognized.</div>
            </div>
          </div>
        )}

        {/* 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>

          {/* LEFT: Tip feed */}
          <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'cc-pulse 1.2s ease infinite' }} />
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Live Tip Feed</span>
              </div>
              <span style={{ fontSize: 10, color: C.dim }}>{tips.length} tips so far</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 500, overflowY: 'auto' }}>
              {tips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 12 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🎬</div>
                  Stream starting… first tips incoming
                </div>
              ) : tips.map((tip, i) => (
                <div key={tip.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: 9,
                  background: i === 0 ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                  border: i === 0 ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(255,255,255,0.04)',
                  animation: i === 0 ? 'cc-slide 0.3s ease' : 'none',
                  opacity: Math.max(0.25, 1 - i * 0.055),
                }}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    <span style={{ fontSize: 15 }}>
                      {tip.usd >= 5 ? '🐋' : tip.usd >= 1 ? '💰' : '💸'}
                    </span>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#c084fc' : C.white }}>{tip.username}</span>
                      <span style={{ fontSize: 9, color: PLT_COLOR[tip.platform], marginLeft: 7, fontWeight: 700 }}>{tip.platform}</span>
                    </div>
                    <span style={{ fontSize: 10, color: C.cyan }}>{tip.tokens}t</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: tip.usd >= 2.5 ? C.gold : C.green }}>
                    ${tip.usd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Earnings + callout + top tippers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Platform earnings bars */}
            <div style={{ ...glass, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>Platform Earnings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {['CB', 'BC', 'MFC'].map(p => {
                  const pct = totalEarnings > 0 ? (earnings[p] / totalEarnings) * 100 : 0;
                  return (
                    <div key={p}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: PLT_COLOR[p] }}>{p}</span>
                          <span style={{ fontSize: 9, color: C.dim, marginLeft: 6 }}>{PLT_NAME[p]}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>${earnings[p].toFixed(2)}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          background: `linear-gradient(90deg, ${PLT_COLOR[p]}, ${PLT_COLOR[p]}88)`,
                          width: `${pct}%`,
                          transition: 'width 0.5s ease',
                          boxShadow: `0 0 6px ${PLT_COLOR[p]}55`,
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>Combined</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: C.green }}>${totalEarnings.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Active milestone callout */}
            {activeMilestone && (
              <div key={activeMilestone.id} style={{
                ...glass, borderRadius: 16, padding: 18,
                border: `1px solid ${activeMilestone.color}33`,
                boxShadow: `0 0 20px ${activeMilestone.color}18`,
                animation: 'cc-slide 0.4s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <span style={{ fontSize: 17 }}>{activeMilestone.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: activeMilestone.color, textTransform: 'uppercase', letterSpacing: 1 }}>CamCash just did this</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 7 }}>{activeMilestone.calloutTitle}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>{activeMilestone.calloutBody}</div>
              </div>
            )}

            {/* Top tippers */}
            {topTipperList.length > 0 && (
              <div style={{ ...glass, borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Top Tippers</div>
                {topTipperList.map(([name, amount], i) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < topTipperList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 13 }}>{['🥇', '🥈', '🥉'][i]}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: name === 'WhaleDaddy99' ? C.purple : C.white }}>{name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Token goal progress */}
        {goalActive && (
          <div style={{
            ...glass, borderRadius: 16, padding: 20, marginBottom: 20,
            border: goalHit ? `1px solid ${C.green}44` : '1px solid rgba(34,211,238,0.3)',
            animation: goalHit ? 'none' : 'cc-goal-p 2s ease infinite',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{goalHit ? '🎉' : '🎯'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
                    {goalHit ? 'Token goal SMASHED! 🎉' : 'Token Goal — 500 tokens'}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {goalHit ? 'Hit in ~5 minutes — 2.4× faster than your average' : 'Room is rallying around the goal — keep it going!'}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: goalHit ? C.green : C.cyan }}>{Math.round(goalProgress)}%</span>
            </div>
            <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6,
                background: goalHit ? `linear-gradient(90deg, ${C.green}, #34d399)` : `linear-gradient(90deg, ${C.cyan}, ${C.purple})`,
                width: `${goalProgress}%`,
                transition: 'width 0.3s ease',
                boxShadow: goalHit ? `0 0 14px ${C.green}` : `0 0 10px ${C.cyan}`,
              }} />
            </div>
          </div>
        )}

        {/* Room title switch UI */}
        {milestoneIdx >= 8 && (
          <div style={{ ...glass, borderRadius: 16, padding: 20, marginBottom: 20, border: '1px solid rgba(236,72,153,0.3)', animation: 'cc-slide 0.5s ease' }}>
            <div style={{ fontSize: 10, color: C.pink, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800, marginBottom: 4 }}>✏️ AI Room Title Refresh — 30 min mark</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>CamCash analyzed your stream phase and ranked 3 title options. Switched to the top performer automatically.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { title: '🔥 NEW GOAL OPEN | TIP REQUESTS WELCOME | INTERACTIVE', score: 94, active: true },
                { title: "✨ FEELING AMAZING | 30 MIN IN | LET'S PLAY",           score: 81, active: false },
                { title: '💎 CHAT WITH ME | GOAL AT 500 | TIP MENU OPEN',         score: 76, active: false },
              ].map((opt, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: opt.active ? 'rgba(236,72,153,0.09)' : 'rgba(255,255,255,0.02)',
                  border: opt.active ? '1px solid rgba(236,72,153,0.4)' : '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: opt.active ? C.white : C.muted, fontWeight: opt.active ? 700 : 400 }}>{opt.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ fontSize: 10, color: opt.active ? C.pink : C.dim }}>Score {opt.score}</span>
                    {opt.active && <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(236,72,153,0.25)', color: C.pink, fontSize: 9, fontWeight: 800 }}>LIVE</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stream summary */}
        {streamDone && (
          <div style={{ borderRadius: 20, padding: '28px 32px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(15,20,40,0.97), rgba(20,26,50,0.97))', border: '1px solid rgba(34,211,238,0.3)', boxShadow: '0 0 50px rgba(34,211,238,0.12)', animation: 'cc-slide 0.5s ease' }}>
            <div style={{ fontSize: 10, color: C.cyan, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, marginBottom: 18 }}>📊 Stream Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 22 }}>
              {[
                { label: 'Total Earned',  value: '$284.40', color: C.green,  icon: '💵' },
                { label: 'Stream Time',   value: '35 min',  color: C.purple, icon: '⏱️' },
                { label: 'Tips Received', value: '147',     color: C.cyan,   icon: '⚡' },
                { label: 'Peak Rev/hr',   value: '$487',    color: C.gold,   icon: '🚀' },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{ textAlign: 'center', padding: '16px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 20, marginBottom: 7 }}>{icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color, marginBottom: 5 }}>{value}</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>By Platform</div>
                {[{ p: 'CB', v: 142.20 }, { p: 'BC', v: 85.30 }, { p: 'MFC', v: 56.90 }].map(({ p, v }) => (
                  <div key={p} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: PLT_COLOR[p], fontWeight: 700 }}>{PLT_NAME[p]}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.white }}>${v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>Top Tippers</div>
                {[['WhaleDaddy99', 124.50], ['BigWhale77', 47.25], ['PremiumPete', 18.70]].map(([name, amt]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: name === 'WhaleDaddy99' ? C.purple : C.white }}>{name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>${amt.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>🏆 Best moment: </span>
              <span style={{ fontSize: 12, color: C.muted }}>Token goal hit at 20:00 — fastest completion this month. WhaleDaddy99 contributed $124.50 (44% of session revenue).</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {streamDone && (
          <div style={{ textAlign: 'center', padding: '36px 24px', borderRadius: 20, background: 'linear-gradient(135deg, rgba(168,85,247,0.09), rgba(236,72,153,0.06))', border: '1px solid rgba(168,85,247,0.3)', animation: 'cc-slide 0.7s ease' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>💎</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 10 }}>
              This is what CamCash looks like on a real stream.
            </div>
            <div style={{ fontSize: 14, color: C.muted, maxWidth: 460, margin: '0 auto 30px', lineHeight: 1.7 }}>
              Every tip tracked. Every whale flagged. Every dip caught — automatically across Chaturbate, BongaCams, and MyFreeCams.
            </div>
            <Button as="a" href="/signup" style={{ padding: '16px 52px', fontSize: 16, letterSpacing: 0.3 }}>
              Start for free →
            </Button>
            <div style={{ marginTop: 14, fontSize: 11, color: C.dim }}>
              No credit card &nbsp;·&nbsp; No extension required to start &nbsp;·&nbsp; Takes under 2 minutes
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
