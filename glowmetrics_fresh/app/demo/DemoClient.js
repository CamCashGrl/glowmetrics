'use client'

import { useState, useEffect, useRef } from 'react'
import { FinalCTASection } from './sections'
import Button from '../../components/ui/Button'
import { DEMO_CLIENT_COLORS as C } from "@/lib/theme/colors"


// ─── Static demo data ──────────────────────────────────────────────────────────
const FANS = [
  { name: 'PurpleRain99',   lifetime: '$2,840', tips: 127, sessions: 34, avg: '$83',  last: '4d ago',  risk: 'HIGH', bars: [92,45,28,55,100,80,60,40,22,15] },
  { name: 'xDarkMatter3',   lifetime: '$1,320', tips: 78,  sessions: 21, avg: '$63',  last: '5h ago',  risk: 'LOW',  bars: [60,75,55,80,65,70,58,72,68,90] },
  { name: 'euro_titan88',   lifetime: '$960',   tips: 52,  sessions: 18, avg: '$53',  last: '1d ago',  risk: 'LOW',  bars: [50,60,70,45,80,55,65,75,85,70] },
  { name: 'kingwolf99',     lifetime: '$750',   tips: 31,  sessions: 14, avg: '$54',  last: '3d ago',  risk: 'MED',  bars: [40,55,70,60,45,80,50,65,35,55] },
  { name: 'shadow_wolf_x',  lifetime: '$480',   tips: 28,  sessions: 12, avg: '$40',  last: '6d ago',  risk: 'HIGH', bars: [75,60,80,55,70,40,30,25,20,10] },
  { name: 'vaultmaster',    lifetime: '$380',   tips: 21,  sessions: 10, avg: '$38',  last: '8d ago',  risk: 'HIGH', bars: [65,50,70,45,60,35,28,20,15,8] },
  { name: 'nightcrawler_k', lifetime: '$240',   tips: 14,  sessions: 8,  avg: '$30',  last: '12d ago', risk: 'HIGH', bars: [55,40,65,30,50,25,18,12,8,5] },
  { name: 'redstar_tx',     lifetime: '$195',   tips: 11,  sessions: 7,  avg: '$28',  last: '4d ago',  risk: 'MED',  bars: [40,55,45,60,50,65,55,70,60,45] },
]

const SESSIONS = [
  { date: 'May 19, 2026', day: 'Mon', start: '9:00 PM', dur: '2h 40m', earned: '$148',  tips: 24, peak: '10:22 PM', topFan: 'xDarkMatter3',  topAmt: '$50',  rating: 'HOT' },
  { date: 'May 17, 2026', day: 'Sat', start: '8:30 PM', dur: '3h 10m', earned: '$212',  tips: 38, peak: '9:45 PM',  topFan: 'euro_titan88',   topAmt: '$75',  rating: 'EXPLOSIVE' },
  { date: 'May 15, 2026', day: 'Thu', start: '9:15 PM', dur: '2h 00m', earned: '$94',   tips: 15, peak: '10:00 PM', topFan: 'kingwolf99',     topAmt: '$50',  rating: 'ACTIVE' },
  { date: 'May 14, 2026', day: 'Wed', start: '10:00 PM',dur: '1h 45m', earned: '$183',  tips: 21, peak: '10:30 PM', topFan: 'PurpleRain99',   topAmt: '$100', rating: 'EXPLOSIVE' },
  { date: 'May 12, 2026', day: 'Mon', start: '9:00 PM', dur: '2h 20m', earned: '$76',   tips: 12, peak: '9:40 PM',  topFan: 'redstar_tx',     topAmt: '$20',  rating: 'WARM' },
  { date: 'May 10, 2026', day: 'Sat', start: '8:00 PM', dur: '3h 30m', earned: '$264',  tips: 44, peak: '9:15 PM',  topFan: 'euro_titan88',   topAmt: '$100', rating: 'EXPLOSIVE' },
  { date: 'May 7, 2026',  day: 'Wed', start: '9:30 PM', dur: '2h 05m', earned: '$112',  tips: 19, peak: '10:10 PM', topFan: 'shadow_wolf_x',  topAmt: '$25',  rating: 'ACTIVE' },
  { date: 'May 5, 2026',  day: 'Mon', start: '9:00 PM', dur: '1h 50m', earned: '$89',   tips: 14, peak: '9:35 PM',  topFan: 'kingwolf99',     topAmt: '$50',  rating: 'WARM' },
]

const HOURS = [
  { h: '8 PM',  val: 42 }, { h: '9 PM',  val: 78 }, { h: '10 PM', val: 100 },
  { h: '11 PM', val: 87 }, { h: '12 AM', val: 63 }, { h: '1 AM',  val: 38 },
  { h: '2 AM',  val: 22 },
]

const LIVE_TIPS_SEED = [
  { user: 'xDarkMatter3',  tokens: 500,  msg: 'you look amazing 😍',          ts: '10:22:04', whale: true  },
  { user: 'euro_titan88',  tokens: 200,  msg: 'keep going!',                  ts: '10:22:31', whale: false },
  { user: 'PurpleRain99',  tokens: 1000, msg: '🔥🔥🔥',                       ts: '10:22:58', whale: true  },
  { user: 'kingwolf99',    tokens: 150,  msg: 'loving the vibe tonight',      ts: '10:23:14', whale: false },
  { user: 'redstar_tx',    tokens: 100,  msg: 'hi! first time here 👋',       ts: '10:23:29', whale: false },
  { user: 'shadow_wolf_x', tokens: 300,  msg: 'you\'re the best',             ts: '10:23:47', whale: false },
  { user: 'nightcrawler_k',tokens: 75,   msg: '💜',                           ts: '10:24:02', whale: false },
  { user: 'vaultmaster',   tokens: 500,  msg: 'goal!!!',                      ts: '10:24:18', whale: true  },
]

const NEW_TIP_POOL = [
  { user: 'euro_titan88',  tokens: 300,  msg: 'encore!! 🔥',                  whale: false },
  { user: 'PurpleRain99',  tokens: 2000, msg: 'YOU ARE EVERYTHING 💜💜💜',    whale: true  },
  { user: 'xDarkMatter3',  tokens: 500,  msg: 'tip for the goal 💪',          whale: true  },
  { user: 'kingwolf99',    tokens: 200,  msg: 'loving this',                  whale: false },
  { user: 'newuser_88',    tokens: 50,   msg: 'hello! 👋',                    whale: false },
  { user: 'euro_titan88',  tokens: 1000, msg: '🚀🚀🚀',                       whale: true  },
  { user: 'redstar_tx',    tokens: 150,  msg: 'tip! 💜',                      whale: false },
  { user: 'shadow_wolf_x', tokens: 400,  msg: 'go go go!!',                   whale: false },
]

const ROOM_STATES = ['WARMING', 'ACTIVE', 'HOT', 'EXPLOSIVE']
const COACH_MSGS = [
  'Peak hour is 10 PM — you\'re right on time. Keep energy high.',
  'xDarkMatter3 is active. Shout them out — they\'ll tip again.',
  'euro_titan88 has been in 3 sessions this week. They\'re loyal.',
  'Room is heating up. Announce a 500-token goal to push it HOT.',
  '🔥 PurpleRain99 just dropped 1000 tokens. Acknowledge them!',
  'You\'re in HOT territory — engagement up 40% from last session.',
  'Tip rate is accelerating. Launch a countdown goal now.',
  '🚀 EXPLOSIVE session! On track for top-5 earnings night.',
]

const TITLES_MAP = {
  'playful-small-tonight':     ["💜 Come play! | Goal: 200 = surprise | Tonight only ✨", "Playful & silly tonight 🎉 | 200 token goal | come hang 💜"],
  'playful-big-tonight':       ["🎉 Big goal tonight: 1000 tokens = [full show] | tip fast — top tipper gets VIP", "💜 Goal night! 1000 tokens unlocks something amazing — who's in? 🔥"],
  'naughty-small-tonight':     ["😈 Naughty mood | Goal: oil show @ 300 | Tip menu active 💦", "🔥 Feeling naughty | 300 token goal — come find out what happens 😈"],
  'naughty-big-last hour':     ["🔥 LAST HOUR | 1000-token goal — 200 away | someone be my hero 😈💜", "⏳ Final push — 1000 goal ENDS SOON | tip to make it happen 🔥"],
  'chill-none-tonight':        ["💜 chill tonight | come hang | no goal | good vibes only 🥰", "easy night 💜 | no pressure | come chat and chill"],
  'chill-small-tonight':       ["💜 chill + chat | 300 token goal = special moment | come hang", "Easy vibes tonight 💜 | goal at 300 — just having fun 🥰"],
  'interactive-small-tonight': ["🎮 Lush ON | tip to control me | Goal: 300 = I lose control 😈", "🎮 Lush active & ready 💜 | every tip = reaction | goal: 300 tonight"],
  'interactive-big-last hour': ["🎮 FINAL HOUR | Lush on max | 500-token goal — almost there 🔥⏳", "⏳ Lush at max sensitivity | 500 token goal ending SOON — tip NOW 🎮🔥"],
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function TopNav() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '52px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
      background: 'rgba(4,8,18,0.95)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(168,85,247,0.2)',
    }}>
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '18px' }}>💜</span>
        <span style={{
          fontWeight: 700, fontSize: '16px',
          background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>CamCash</span>
        <span style={{ fontSize: '11px', color: C.dim, marginLeft: '4px' }}>/ demo</span>
      </a>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <a href="/extension" style={{ fontSize: '13px', color: C.muted, textDecoration: 'none' }}>Extension</a>
        <Button as="a" href="/landing" style={{ padding: '7px 16px', fontSize: '13px' }}>Start free →</Button>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  icon: '📊', label: 'Overview'      },
  { id: 'sessions',  icon: '📅', label: 'Sessions'       },
  { id: 'fans',      icon: '👑', label: 'Top Fans'       },
  { id: 'insights',  icon: '💡', label: 'Insights'       },
  { id: 'titles',    icon: '🎯', label: 'Title Generator'},
  { id: 'live',      icon: '🔴', label: 'Live Mode'      },
]

function Sidebar({ active, setActive }) {
  return (
    <div style={{
      width: '200px', flexShrink: 0,
      background: C.sidebar,
      borderRight: '1px solid rgba(168,85,247,0.12)',
      display: 'flex', flexDirection: 'column',
      paddingTop: '16px', paddingBottom: '20px',
    }}>
      <div style={{ padding: '0 12px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', color: C.dim, textTransform: 'uppercase' }}>
        Dashboard
      </div>
      {TABS.map(t => {
        const isActive = active === t.id
        const isLive = t.id === 'live'
        return (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', margin: '1px 8px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', width: 'calc(100% - 16px)',
            background: isActive ? 'rgba(168,85,247,0.15)' : 'transparent',
            color: isActive ? C.white : C.muted,
            fontSize: '13px', fontWeight: isActive ? 700 : 500,
            textAlign: 'left', transition: 'all 0.15s',
          }}>
            <span>{t.icon}</span>
            <span style={{ flex: 1 }}>{t.label}</span>
            {isLive && (
              <span style={{
                fontSize: '8px', fontWeight: 800, letterSpacing: '0.5px',
                color: C.red, background: 'rgba(239,68,68,0.15)',
                padding: '2px 5px', borderRadius: '4px', textTransform: 'uppercase',
              }}>NEW</span>
            )}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(168,85,247,0.1)', marginTop: '12px' }}>
        <div style={{ fontSize: '11px', color: C.dim, marginBottom: '4px' }}>demo account</div>
        <div style={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>@YourUsername</div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '12px', padding: '18px 20px',
    }}>
      <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: color || C.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Overview</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Last 30 days · demo data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <Stat label="Total Earned"     value="$1,178"  sub="↑ 23% vs last month"   color={C.green}  />
        <Stat label="Sessions"         value="8"       sub="avg 2h 34m each"                         />
        <Stat label="Unique Fans"      value="24"      sub="8 re-engaged this month"                  />
        <Stat label="Avg / Session"    value="$147"    sub="↑ $34 from last month"  color={C.purple} />
        <Stat label="Best Night"       value="$264"    sub="May 10 · Sat 8 PM"      color={C.gold}   />
        <Stat label="Peak Hour"        value="10 PM"   sub="most tips land here"                      />
      </div>

      {/* Earnings bar chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: C.white, marginBottom: '16px' }}>Earnings by session (last 8)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
          {SESSIONS.slice().reverse().map((s, i) => {
            const val = parseInt(s.earned.replace('$',''))
            const pct = val / 264
            const ratingColor = s.rating === 'EXPLOSIVE' ? C.pink : s.rating === 'HOT' ? C.red : s.rating === 'ACTIVE' ? C.purple : C.cyan
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '10px', color: C.dim }}>{s.earned}</div>
                <div style={{
                  width: '100%', height: `${pct * 60}px`,
                  background: ratingColor, borderRadius: '4px 4px 0 0', opacity: 0.85,
                  minHeight: '8px',
                }} />
                <div style={{ fontSize: '9px', color: C.dim, whiteSpace: 'nowrap' }}>{s.day}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Peak hours */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: C.white, marginBottom: '16px' }}>Best streaming hours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '70px' }}>
          {HOURS.map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '100%', height: `${h.val * 0.6}px`,
                background: h.val >= 90 ? C.purple : h.val >= 70 ? C.pink : 'rgba(168,85,247,0.3)',
                borderRadius: '3px 3px 0 0',
              }} />
              <div style={{ fontSize: '10px', color: C.dim, whiteSpace: 'nowrap' }}>{h.h}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '10px' }}>
          💡 Start at <strong style={{ color: C.purple }}>9 PM</strong> — your peak is 10 PM and you need warm-up time.
        </div>
      </div>

      {/* AI brief */}
      <div style={{
        background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: '12px', padding: '18px 20px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: C.purple, textTransform: 'uppercase', marginBottom: '10px' }}>AI Daily Brief</div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {[
            'PurpleRain99 is overdue — last seen 4 days ago. Re-engage today.',
            'Your Saturday sessions earn 38% more than weekdays. Prioritize Sat.',
            '10 PM is your peak. Starting at 9 PM gives you a 60-min warm-up.',
            'shadow_wolf_x and vaultmaster haven\'t been in for 6–8 days. Send a message.',
          ].map((tip, i) => (
            <li key={i} style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>{tip}</li>
          ))}
        </ul>
      </div>

      {/* CSV upload CTA */}
      <div style={{
        background: C.card, border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: '12px', padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, marginBottom: '4px' }}>
            📄 See this with your real data
          </div>
          <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>
            Export your CSV from Chaturbate, BongaCams, or MFC and upload it — your real fan rankings, sessions, and earnings load instantly.{' '}
            <a href="/landing#how-to-export" style={{ color: C.purple, textDecoration: 'underline', fontWeight: 600 }}>
              How to export your CSV →
            </a>
          </div>
        </div>
        <Button as="a" href="/landing" style={{ flexShrink: 0, padding: '10px 20px', fontSize: '13px' }}>Upload CSV →</Button>
      </div>
    </div>
  )
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────
function SessionsTab() {
  const [selected, setSelected] = useState(0)
  const s = SESSIONS[selected]
  const ratingColors = { EXPLOSIVE: C.pink, HOT: C.red, ACTIVE: C.purple, WARM: C.cyan }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Session Breakdown</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Click any session to see details</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Session list */}
        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SESSIONS.map((s, i) => (
            <button key={i} onClick={() => setSelected(i)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: selected === i ? 'rgba(168,85,247,0.15)' : C.card,
              outline: selected === i ? `1px solid rgba(168,85,247,0.4)` : `1px solid ${C.border}`,
              textAlign: 'left', gap: '10px',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.white }}>{s.date}</div>
                <div style={{ fontSize: '11px', color: C.dim, marginTop: '2px' }}>{s.start} · {s.dur}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: C.green }}>{s.earned}</div>
                <div style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                  color: ratingColors[s.rating], background: `${ratingColors[s.rating]}18`,
                  padding: '2px 6px', borderRadius: '4px', marginTop: '3px', display: 'inline-block',
                }}>{s.rating}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Session detail */}
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.white }}>{s.date}</div>
              <div style={{ fontSize: '13px', color: C.muted, marginTop: '3px' }}>{s.day} · {s.start} · {s.dur}</div>
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
              color: ratingColors[s.rating], background: `${ratingColors[s.rating]}18`,
              padding: '4px 10px', borderRadius: '6px', border: `1px solid ${ratingColors[s.rating]}40`,
            }}>{s.rating}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {[
              { l: 'Earned',       v: s.earned,  c: C.green  },
              { l: 'Tips',         v: s.tips,    c: C.white  },
              { l: 'Peak activity',v: s.peak,    c: C.purple },
              { l: 'Top fan',      v: s.topFan,  c: C.gold   },
              { l: 'Top tip',      v: s.topAmt,  c: C.pink   },
            ].map((r, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: C.dim, marginBottom: '4px' }}>{r.l}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: r.c }}>{r.v}</div>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(168,85,247,0.07)', borderRadius: '8px', padding: '12px 14px',
            border: '1px solid rgba(168,85,247,0.2)',
          }}>
            <div style={{ fontSize: '11px', color: C.purple, fontWeight: 700, marginBottom: '5px' }}>AI Insight</div>
            <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>
              {s.rating === 'EXPLOSIVE'
                ? `Top session of the month. ${s.topFan} drove ${s.topAmt} — acknowledge them next time to encourage a repeat.`
                : s.rating === 'HOT'
                ? `Strong session. Peak hit at ${s.peak} — try starting your main goal push 30 min before that.`
                : `Solid session. Starting a small goal in the first 30 min could push this into HOT territory.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fans tab ─────────────────────────────────────────────────────────────────
const REENGAGE = {
  PurpleRain99:   ["Hey PurpleRain99 💜 haven't seen you in a few days — going live tonight at 9PM with something special. Thinking of you 🥰", "PurpleRain99! You've been one of my faves 💜 streaming tonight — come say hi? First tipper picks what happens next 👀"],
  shadow_wolf_x:  ["shadow_wolf_x 👋 missed you! Come through tonight — I've got something new you'd love 🔥", "shadow_wolf_x! Going live at 10 — first tip picks the vibe. Come hang 💜"],
  vaultmaster:    ["vaultmaster 💜 where have you been! Going live tonight — you've been on my mind. Come through 🥰", "vaultmaster! 🔥 Special goal tonight — need my best people there. Hope you can make it 💜"],
  nightcrawler_k: ["nightcrawler_k 👋 been a while! Going live tonight — come see what's new 💜", "Hey nightcrawler_k! Streaming tonight — would love to see you there 🔥"],
}

function FansTab() {
  const [selected, setSelected] = useState('PurpleRain99')
  const [msgIdx, setMsgIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const fan = FANS.find(f => f.name === selected) || FANS[0]
  const msgs = REENGAGE[selected]
  const riskColor = { HIGH: C.red, MED: C.gold, LOW: C.green }

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Top Fans</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Click a fan to see their profile and re-engage messages</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Fan list */}
        <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {FANS.map((f, i) => (
            <button key={f.name} onClick={() => { setSelected(f.name); setMsgIdx(0); setCopied(false) }} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: selected === f.name ? 'rgba(168,85,247,0.15)' : C.card,
              outline: selected === f.name ? '1px solid rgba(168,85,247,0.4)' : `1px solid ${C.border}`,
              textAlign: 'left',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 800, color: '#fff',
              }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: '11px', color: C.green }}>{f.lifetime}</div>
              </div>
              <div style={{
                fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px',
                color: riskColor[f.risk], background: `${riskColor[f.risk]}18`,
              }}>{f.risk}</div>
            </button>
          ))}
        </div>

        {/* Fan detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Stats */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '17px', fontWeight: 800, color: C.white }}>{fan.name}</div>
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                color: riskColor[fan.risk], background: `${riskColor[fan.risk]}18`,
                padding: '3px 8px', borderRadius: '5px', border: `1px solid ${riskColor[fan.risk]}40`,
              }}>
                {fan.risk === 'HIGH' ? '⚠ At risk · ' : fan.risk === 'MED' ? '⏳ Fading · ' : '✅ Active · '}{fan.last}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {[
                { l: 'Lifetime', v: fan.lifetime, c: C.green  },
                { l: 'Tips',     v: fan.tips,     c: C.white  },
                { l: 'Sessions', v: fan.sessions, c: C.white  },
                { l: 'Avg/sess', v: fan.avg,      c: C.purple },
              ].map((r, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: C.dim }}>{r.l}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: r.c }}>{r.v}</div>
                </div>
              ))}
            </div>

            {/* Mini bar chart */}
            <div style={{ fontSize: '11px', color: C.dim, marginBottom: '6px' }}>Tip activity (last 10 sessions)</div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '36px' }}>
              {fan.bars.map((b, i) => (
                <div key={i} style={{
                  flex: 1, height: `${b * 0.36}px`,
                  background: b >= 80 ? C.purple : b >= 50 ? C.pink : 'rgba(168,85,247,0.3)',
                  borderRadius: '2px 2px 0 0', minHeight: '3px',
                }} />
              ))}
            </div>
          </div>

          {/* Re-engage */}
          {msgs && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.white, marginBottom: '12px' }}>Re-engage message</div>
              <div style={{
                background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: '8px', padding: '14px', fontSize: '13px', color: C.muted,
                lineHeight: 1.6, marginBottom: '12px', minHeight: '60px',
              }}>
                {msgs[msgIdx % msgs.length]}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setMsgIdx(i => i + 1)} style={{
                  padding: '8px 14px', borderRadius: '7px', border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer',
                }}>↻ New variation</button>
                <button onClick={handleCopy} style={{
                  padding: '8px 16px', borderRadius: '7px', border: 'none',
                  background: copied ? C.green : `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                  color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                }}>{copied ? '✓ Copied!' : 'Copy message'}</button>
              </div>
            </div>
          )}
          {!msgs && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', color: C.muted }}>
                {fan.risk === 'LOW'
                  ? `✅ ${fan.name} is active — no re-engage needed right now.`
                  : `Re-engage messages available for high-risk fans. Sign up to unlock for all fans.`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Insights tab ─────────────────────────────────────────────────────────────
function InsightsTab() {
  const insights = [
    { icon: '📅', title: 'Best nights: Sat & Mon', body: 'Your Saturday sessions average $212 — 43% above your weekday average. Monday evenings at 9 PM also consistently outperform.', color: C.purple },
    { icon: '⏰', title: 'Peak activity: 10–11 PM', body: 'Most of your tips land between 10 PM and 11 PM. Start streaming by 9 PM to build momentum before your peak window.', color: C.cyan },
    { icon: '👑', title: 'Top 3 fans = 56% of revenue', body: 'PurpleRain99, xDarkMatter3, and euro_titan88 combined for $4,120 of your total. These three are your VIPs.', color: C.gold },
    { icon: '⚠', title: '3 fans at high churn risk', body: 'PurpleRain99, shadow_wolf_x, and vaultmaster haven\'t been seen in 4–8 days. Historical drop-off starts at day 5.', color: C.red },
    { icon: '🎯', title: '300–500 token goals perform best', body: 'Goals in that range complete 73% of the time in your sessions. Goals over 1,000 stall unless you\'re in an explosive session.', color: C.pink },
    { icon: '🔁', title: 'Re-engage window is 5 days', body: 'Fans who don\'t see a message within 5 days of absence have a 60% lower return rate. Reach out before day 5.', color: C.green },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Insights</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Patterns from your last 30 days of streaming</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {insights.map((ins, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '12px', padding: '18px 20px',
            borderLeft: `3px solid ${ins.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{ins.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: C.white }}>{ins.title}</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: C.muted, lineHeight: 1.6 }}>{ins.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Title Generator tab ──────────────────────────────────────────────────────
function TitlesTab() {
  const [vibe, setVibe]     = useState('naughty')
  const [goal, setGoal]     = useState('small')
  const [urgency, setUrgency] = useState('tonight')
  const [idx, setIdx]       = useState(0)

  const key = `${vibe}-${goal}-${urgency}`
  const set = TITLES_MAP[key] || [`💜 ${vibe} vibes | come hang tonight | tip to play`, `🔥 ${vibe} mode | join the fun 💜`]
  const title = set[idx % set.length]

  const [copied, setCopied] = useState(false)
  const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 1800) }

  const btn = (val, current, setter, options) => options.map(o => (
    <button key={o.val} onClick={() => { setter(o.val); setIdx(0); setCopied(false) }} style={{
      padding: '8px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px',
      background: current === o.val ? `linear-gradient(135deg, ${C.purple}, ${C.pink})` : 'rgba(255,255,255,0.05)',
      color: current === o.val ? '#fff' : C.muted, fontWeight: current === o.val ? 700 : 400,
    }}>{o.label}</button>
  ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Room Title Generator</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Pick your vibe and get titles optimized for your audience</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Vibe</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {btn(vibe, vibe, setVibe, [
              { val: 'playful', label: '🎉 Playful' },
              { val: 'naughty', label: '😈 Naughty' },
              { val: 'chill',   label: '💜 Chill'   },
              { val: 'interactive', label: '🎮 Interactive' },
            ])}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Goal size</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {btn(goal, goal, setGoal, [
              { val: 'none',  label: 'No goal'   },
              { val: 'small', label: 'Small (≤500)' },
              { val: 'big',   label: 'Big (1000+)'  },
            ])}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Timing</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {btn(urgency, urgency, setUrgency, [
              { val: 'anytime',   label: 'Anytime'   },
              { val: 'tonight',   label: 'Tonight'   },
              { val: 'last hour', label: 'Last hour' },
            ])}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '18px' }}>
          <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Generated title</div>
          <div style={{
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '8px', padding: '14px 16px', fontSize: '14px', color: C.white,
            lineHeight: 1.5, marginBottom: '12px', fontWeight: 500,
          }}>{title}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setIdx(i => i + 1); setCopied(false) }} style={{
              padding: '9px 16px', borderRadius: '7px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: '13px', cursor: 'pointer',
            }}>↻ Another variation</button>
            <button onClick={handleCopy} style={{
              padding: '9px 18px', borderRadius: '7px', border: 'none',
              background: copied ? C.green : `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
              color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}>{copied ? '✓ Copied!' : 'Copy title'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Live Mode tab ────────────────────────────────────────────────────────────
const LIVE_INSIGHTS = [
  { icon: '🔥', tag: 'DO THIS NOW',      context: 'No tips in 8 minutes',                   action: 'Try launching a 2,000 token room goal — urgency restarts tipping.' },
  { icon: '⏳', tag: 'PEAK WINDOW',      context: 'Historically this is your best hour',     action: 'You earn 42% of your revenue in this window. Push hard now.' },
  { icon: '💎', tag: 'TOP FAN ACTIVE',   context: 'Your highest-value fan is engaged',        action: 'Mention xDarkMatter3 by name — VIP attention keeps whales tipping.' },
  { icon: '🎯', tag: 'GOAL MOMENTUM',    context: 'Room is at 27% of 2,000-token goal',       action: 'Announce the reward out loud — viewers tip faster when they know what they get.' },
  { icon: '📈', tag: 'PACE ABOVE AVG',   context: 'Tip rate is 38% above your normal',        action: "Don't break the energy — keep doing exactly what you're doing." },
  { icon: '🐋', tag: 'WHALE PROXIMITY',  context: 'PurpleRain99 tips every ~6 min on average', action: '5 min since their last tip — call them out right now.' },
]

const DEMO_FAN_CARDS = [
  { name: 'xDarkMatter3', badge: '👑 Top Tipper', lifetime: '$642', probability: 89, risk: 'Low',  riskColor: '#10b981', lastTip: '3 min ago',  sessions: 21, avgTip: '$30' },
  { name: 'euro_titan88', badge: '🔄 Regular',    lifetime: '$284', probability: 67, risk: 'Medium', riskColor: '#f59e0b', lastTip: '18 min ago', sessions: 14, avgTip: '$20' },
  { name: 'newuser_spark', badge: '🌱 New Fan',   lifetime: '$42',  probability: 45, risk: 'High', riskColor: '#f87171', lastTip: '1 hr ago',   sessions: 3,  avgTip: '$14' },
]

function LiveTab() {
  const [phase, setPhase]             = useState('live')  // starts in live by default
  const [tips, setTips]               = useState(LIVE_TIPS_SEED)
  const [tokens, setTokens]           = useState(536)
  const [revenue, setRevenue]         = useState(26.30)
  const [sessionSecs, setSessionSecs] = useState(9180)  // 2h 33m in seconds
  const [roomState, setRoomState]     = useState('HOT')
  const [insightIdx, setInsightIdx]   = useState(0)
  const [newTipFlash, setNewTipFlash] = useState(null)
  const [tipCount, setTipCount]       = useState(0)
  const [recentCount, setRecentCount] = useState(0)
  const poolIdx   = useRef(0)
  const timerRef  = useRef(null)
  const clockRef  = useRef(null)

  const goalTokens = 2000

  useEffect(() => {
    if (phase !== 'live') return
    // tip simulation
    timerRef.current = setInterval(() => {
      const tip = NEW_TIP_POOL[poolIdx.current % NEW_TIP_POOL.length]
      poolIdx.current++
      const now = new Date()
      const ts  = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      setTips(prev => [{ ...tip, ts, flash: true }, ...prev].slice(0, 20))
      setTokens(prev => Math.min(prev + tip.tokens, goalTokens))
      setRevenue(prev => parseFloat((prev + tip.tokens * 0.05).toFixed(2)))
      setTipCount(c => c + 1)
      setRecentCount(c => c + 1)
      setNewTipFlash(tip.user)
      setInsightIdx(i => (i + 1) % LIVE_INSIGHTS.length)
      setRoomState(ROOM_STATES[Math.min(Math.floor(poolIdx.current / 3), 3)])
      setTimeout(() => { setNewTipFlash(null); setRecentCount(0); }, 3000)
    }, 3200)

    // session clock
    clockRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000)

    return () => { clearInterval(timerRef.current); clearInterval(clockRef.current); }
  }, [phase])

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  }

  const goalPct   = Math.min(Math.round((tokens / goalTokens) * 100), 100)
  const projected = Math.round((tokens / sessionSecs) * 3600 * 1.1)
  const insight   = LIVE_INSIGHTS[insightIdx]
  const roomColors = { WARMING: '#22d3ee', ACTIVE: '#a855f7', HOT: '#f97316', EXPLOSIVE: '#ef4444' }
  const stateColor = roomColors[roomState] || '#a855f7'

  // ── SETUP PHASE ────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: C.white }}>Live Mode — How It Works</h2>
          <p style={{ margin: 0, fontSize: '13px', color: C.dim }}>Real-time tip tracking and AI coaching while you stream</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: 1, color: C.cyan, icon: '🧩', title: 'Download the Chrome extension', body: 'The extension runs in your browser while you stream. It captures every tip automatically and syncs to your dashboard in real time.', cta: { label: 'Get the extension →', href: '/camcash-extension.zip', download: true } },
            { n: 2, color: C.purple, icon: '🎬', title: 'Go live on Chaturbate', body: 'Start your stream normally. The extension detects you\'re live and activates automatically. Works on Chaturbate · BongaCams · MyFreeCams · Stripchat.' },
            { n: 3, color: C.red,    icon: '🔴', title: 'Watch Live Mode in action', body: 'See exactly what you\'d see during a real stream — live tip feed, AI coaching, room state tracker, and earnings counter updating in real time.', action: { label: '▶ Launch live demo', onClick: () => setPhase('live') } },
          ].map(({ n, color, icon, title, body, cta, action }) => (
            <div key={n} style={{ background: C.card, border: `1px solid ${color}40`, borderRadius: '12px', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: `${color}20`, border: `2px solid ${color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color }}>
                  {n}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.white, marginBottom: '6px' }}>{icon} {title}</div>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: C.muted, lineHeight: 1.6 }}>{body}</p>
                  {cta && <a href={cta.href} download={cta.download} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', background: `${color}15`, border: `1px solid ${color}50`, color, fontWeight: 700, fontSize: '13px' }}>{cta.label}</a>}
                  {action && <Button onClick={action.onClick} style={{ padding: '10px 22px', fontSize: '13px' }}>{action.label}</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── LIVE SIMULATION ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 3 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.red, display: 'inline-block', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: '18px', fontWeight: 800, color: C.white }}>Live Mode — Active</span>
            <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.18)', fontSize: '10px', fontWeight: 800, color: C.purple, letterSpacing: 0.8 }}>SAMPLE DATA</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: C.dim }}>Simulated stream · tips animate every 3 sec · {formatDuration(sessionSecs)}</p>
        </div>
        <button onClick={() => setPhase('setup')} style={{ padding: '7px 14px', borderRadius: '7px', border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: '12px', cursor: 'pointer' }}>
          How it works →
        </button>
      </div>

      {/* ── METRIC GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        {[
          { label: 'Room State',      value: `🔥 ${roomState}`,          color: stateColor },
          { label: 'Revenue',          value: `$${revenue.toFixed(2)}`,   color: C.green },
          { label: 'Tokens',           value: tokens.toLocaleString(),     color: C.gold },
          { label: 'Opportunity',      value: '62/100',                    color: C.purple },
          { label: 'Stream Health',    value: '93/100',                    color: C.cyan },
          { label: 'Rev / hr',         value: '$10.50',                    color: C.green },
          { label: 'Best Platform',    value: 'Chaturbate',                color: C.muted },
          { label: 'Momentum',         value: '🔝 At Peak',               color: '#f97316' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '9px', color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── AI INSIGHTS PANEL ── */}
      <div style={{ borderRadius: '12px', padding: '16px 18px', background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.08))', border: '1px solid rgba(168,85,247,0.35)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)', animation: 'liveBar 2s ease infinite alternate' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(236,72,153,0.2)', fontSize: '10px', fontWeight: 800, color: '#ec4899', letterSpacing: 0.8 }}>⚡ {insight.tag}</span>
          <span style={{ fontSize: '10px', color: C.dim }}>AI Coach · rotating every tip</span>
        </div>
        <div style={{ fontSize: '12px', color: '#ec4899', fontWeight: 600, marginBottom: 4 }}>{insight.context}</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: C.white, lineHeight: 1.55 }}>{insight.action}</div>
      </div>

      {/* ── GOAL + TIP FEED ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Goal tracking */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.white }}>🎯 Room Goal</div>
            <span style={{ fontSize: '9px', color: C.muted, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>DEMO PREVIEW</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: C.cyan, marginBottom: 2 }}>{goalPct}%</div>
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: 10 }}>
            {tokens.toLocaleString()} / {goalTokens.toLocaleString()} tokens
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${goalPct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: C.muted }}>Projected: <span style={{ color: C.white, fontWeight: 700 }}>{Math.min(projected, goalTokens * 0.95).toLocaleString()} t</span></span>
            <span style={{ color: C.green, fontWeight: 700 }}>✅ On Pace</span>
          </div>
        </div>

        {/* Live tip feed */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.white }}>Live Tips</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {recentCount > 0 && <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, animation: 'pulse 1s infinite' }}>+{recentCount} new</span>}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'inline-block', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '10px', color: C.muted }}>LIVE</span>
            </div>
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {tips.slice(0, 8).map((tip, i) => (
              <div key={`${tip.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderBottom: `1px solid rgba(168,85,247,0.05)`, background: newTipFlash === tip.user && i === 0 ? 'rgba(168,85,247,0.12)' : 'transparent', transition: 'background 0.3s' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: tip.whale ? `linear-gradient(135deg, ${C.gold}, ${C.pink})` : `linear-gradient(135deg, ${C.purple}, ${C.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 800 }}>{tip.user[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: tip.whale ? C.gold : C.white }}>{tip.user}</span>
                  {tip.whale && <span style={{ fontSize: '8px', color: C.gold, background: 'rgba(245,158,11,0.15)', padding: '1px 4px', borderRadius: 3, marginLeft: 5, fontWeight: 700 }}>🐋</span>}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: tip.tokens >= 500 ? C.gold : tip.tokens >= 200 ? C.pink : C.purple, flexShrink: 0 }}>+{tip.tokens}t</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAN INTELLIGENCE ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.white }}>💎 Fan Intelligence — Live Session</div>
          <span style={{ fontSize: '9px', color: C.muted, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>ILLUSTRATIVE EXAMPLE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {DEMO_FAN_CARDS.map(fan => (
            <div key={fan.name} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: '9px', color: C.purple, fontWeight: 800, letterSpacing: 0.6, marginBottom: 4 }}>{fan.badge}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: C.white, marginBottom: 8 }}>{fan.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: C.dim }}>Lifetime value</span>
                  <span style={{ color: C.green, fontWeight: 700 }}>{fan.lifetime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: C.dim }}>Tip probability</span>
                  <span style={{ color: C.cyan, fontWeight: 700 }}>{fan.probability}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: C.dim }}>Churn risk</span>
                  <span style={{ color: fan.riskColor, fontWeight: 700 }}>{fan.risk}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: C.dim }}>Last tip</span>
                  <span style={{ color: C.muted }}>{fan.lastTip}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ borderRadius: '14px', padding: '22px 24px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, marginBottom: 6 }}>Want real-time insights like this during your streams?</div>
        <div style={{ fontSize: '12px', color: C.muted, marginBottom: 18, lineHeight: 1.6 }}>Install the CamCash extension and tips appear here automatically — or upload a CSV to unlock personalized analytics from past sessions.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button as="a" href="/camcash-extension.zip" download="camcash-extension.zip" style={{ padding: '10px 22px', fontSize: '13px' }}>
            📥 Install Extension
          </Button>
          <Button as="a" href="/dashboard" variant="secondary" style={{ padding: '10px 22px', fontSize: '13px' }}>
            Upload CSV →
          </Button>
        </div>
      </div>

      {/* ── OPERATING SYSTEM CTA ── */}
      <div style={{ borderRadius: '16px', padding: '32px 28px', background: 'linear-gradient(135deg, rgba(4,8,18,0.98), rgba(20,8,40,0.98))', border: '1px solid rgba(168,85,247,0.4)', textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(168,85,247,0.15)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)', animation: 'liveBar 2s ease infinite alternate' }} />
        <div style={{ fontSize: '11px', fontWeight: 800, color: C.purple, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>You've seen the simulation</div>
        <div style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: C.white, marginBottom: 10, letterSpacing: '-0.02em' }}>
          Ready to enter your operating system?
        </div>
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: 24, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
          This is your command center. Real tips. Real fans. Real AI coaching. Everything you just saw — powered by your actual stream data.
        </div>
        <Button as="a" href="/onboarding" style={{ padding: '14px 36px', fontSize: '16px' }}>
          Enter →
        </Button>
        <div style={{ marginTop: 14, fontSize: '11px', color: C.dim }}>Free during beta · No credit card</div>
      </div>

      <style>{`
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes liveBar { from{opacity:0.5} to{opacity:1} }
      `}</style>
    </div>
  )
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function DemoClient() {
  const [tab, setTab] = useState('overview')

  const panels = { overview: OverviewTab, sessions: SessionsTab, fans: FansTab, insights: InsightsTab, titles: TitlesTab, live: LiveTab }
  const Panel = panels[tab]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopNav />

      {/* Hero strip */}
      <div style={{
        paddingTop: '52px',
        background: `linear-gradient(180deg, rgba(168,85,247,0.08) 0%, transparent 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: '68px 24px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: C.purple, textTransform: 'uppercase', marginBottom: '8px' }}>Interactive Demo</div>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: C.white,
          margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.2,
        }}>Your dashboard, with real-looking data</h1>
        <p style={{ fontSize: '14px', color: C.muted, margin: 0 }}>Click any tab on the left — everything is interactive. No signup required.</p>
      </div>

      {/* Dashboard shell */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 140px)' }}>
        <Sidebar active={tab} setActive={setTab} />

        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', maxWidth: '900px' }}>
          <Panel />
        </div>
      </div>

      <FinalCTASection />
    </div>
  )
}
