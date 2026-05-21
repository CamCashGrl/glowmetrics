'use client'

import { useState } from 'react'
import { CSVImportSection, HowItWorksSection, FinalCTASection } from './sections'

// ─── Color constants ───────────────────────────────────────────────────────────
const C = {
  bg:      '#040812',
  card:    '#0d1424',
  sidebar: '#070d1c',
  purple:  '#a855f7',
  pink:    '#ec4899',
  cyan:    '#22d3ee',
  green:   '#10b981',
  gold:    '#f59e0b',
  white:   '#f1f5f9',
  muted:   '#94a3b8',
  dim:     '#475569',
  red:     '#ef4444',
  border:  'rgba(168,85,247,0.15)',
}

// ─── Steps definition ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 'overview',  icon: '📊', label: 'Overview'             },
  { id: 'insights',  icon: '💡', label: 'Insights'             },
  { id: 'sessions',  icon: '📅', label: 'Session Breakdown'    },
  { id: 'fans',      icon: '👑', label: 'Top Fans'             },
  { id: 'titles',    icon: '🎯', label: 'Room Title Generator' },
  { id: 'live',      icon: '🔴', label: 'Live Mode'            },
]

// ─── Re-engage messages per fan ───────────────────────────────────────────────
const REENGAGE_MESSAGES = {
  PurpleRain99: [
    "Hey PurpleRain99 💜 haven't seen you in a few days — going live tonight at 9PM with something special. Thinking of you 🥰",
    "PurpleRain99! You've been one of my absolute faves 💜 I'm streaming tonight — come say hi? First person to tip gets to pick what happens next 👀",
    "Hey bestie 💜 it's been a minute. Going live soon — I literally just thought of you and wanted to reach out 🥰",
  ],
  shadow_wolf_x: [
    "shadow_wolf_x 👋 missed you in my room! Come through tonight — I've got something new going on that I think you'd love 🔥",
    "Hey shadow_wolf_x 💜 been a little while! Streaming tonight — hope to see you there. I've been thinking about doing [thing] and you'd be perfect to have in the room 👀",
    "shadow_wolf_x! Going live tonight at 10 — first tip gets to pick the vibe. Come hang 💜",
  ],
  vaultmaster: [
    "vaultmaster 💜 where have you been! Going live tonight and you've been on my mind. Come through 🥰",
    "Hey vaultmaster — you're literally one of my faves and I miss you in my room. Streaming soon, hope to see you! 💜",
    "vaultmaster! 🔥 Special goal tonight — and I need my best people there. Hope you can make it 💜",
  ],
}

// ─── Fan profile data ─────────────────────────────────────────────────────────
const PROFILE_DATA = {
  PurpleRain99: {
    risk: 'HIGH',
    riskNote: 'overdue 4 days',
    lifetime: '$2,840',
    tips: 127,
    sessions: 34,
    avgPerSession: '$83.50',
    firstTip: 'Jan 3, 2026',
    largestTip: '2,000 tokens ($100)',
    streak: '18 sessions in a row (Jan–Mar 2026)',
    bars: [92, 45, 28, 55, 100, 80, 60, 40, 22, 15],
    lastFive: [
      { date: 'May 14', tokens: '2000 tk' },
      { date: 'Apr 28', tokens: '500 tk' },
      { date: 'Apr 22', tokens: '150 tk' },
      { date: 'Apr 15', tokens: '300 tk' },
      { date: 'Apr 3',  tokens: '1000 tk' },
    ],
  },
  xDarkMatter3: {
    risk: 'LOW',
    riskNote: '5 hours ago',
    lifetime: '$1,320',
    tips: 78,
    sessions: 21,
    avgPerSession: '$62.86',
    firstTip: 'Feb 11, 2026',
    largestTip: '500 tokens ($25)',
    streak: '7 sessions in a row (Apr–May 2026)',
    bars: [60, 75, 55, 80, 65, 70, 58, 72, 68, 90],
    lastFive: [
      { date: 'May 19', tokens: '300 tk' },
      { date: 'May 16', tokens: '150 tk' },
      { date: 'May 14', tokens: '500 tk' },
      { date: 'May 10', tokens: '200 tk' },
      { date: 'May 7',  tokens: '100 tk' },
    ],
  },
  euro_titan88: {
    risk: 'LOW',
    riskNote: '1 day ago',
    lifetime: '$960',
    tips: 52,
    sessions: 18,
    avgPerSession: '$53.33',
    firstTip: 'Mar 2, 2026',
    largestTip: '1,000 tokens ($50)',
    streak: '5 sessions in a row (May 2026)',
    bars: [50, 60, 70, 45, 80, 55, 65, 75, 85, 70],
    lastFive: [
      { date: 'May 19', tokens: '400 tk' },
      { date: 'May 16', tokens: '200 tk' },
      { date: 'May 14', tokens: '1000 tk' },
      { date: 'May 10', tokens: '150 tk' },
      { date: 'May 7',  tokens: '250 tk' },
    ],
  },
  kingwolf99: {
    risk: 'MED',
    riskNote: '3 days ago',
    lifetime: '$750',
    tips: 31,
    sessions: 14,
    avgPerSession: '$53.57',
    firstTip: 'Mar 18, 2026',
    largestTip: '1,000 tokens ($50)',
    streak: '4 sessions in a row (Apr 2026)',
    bars: [40, 55, 70, 60, 45, 80, 50, 65, 35, 55],
    lastFive: [
      { date: 'May 17', tokens: '500 tk' },
      { date: 'May 10', tokens: '200 tk' },
      { date: 'May 5',  tokens: '1000 tk' },
      { date: 'Apr 28', tokens: '150 tk' },
      { date: 'Apr 22', tokens: '300 tk' },
    ],
  },
  shadow_wolf_x: {
    risk: 'HIGH',
    riskNote: '6 days ago',
    lifetime: '$480',
    tips: 28,
    sessions: 12,
    avgPerSession: '$40.00',
    firstTip: 'Apr 1, 2026',
    largestTip: '500 tokens ($25)',
    streak: '3 sessions in a row (Apr 2026)',
    bars: [75, 60, 80, 55, 70, 40, 30, 25, 20, 10],
    lastFive: [
      { date: 'May 14', tokens: '200 tk' },
      { date: 'May 7',  tokens: '500 tk' },
      { date: 'Apr 30', tokens: '150 tk' },
      { date: 'Apr 22', tokens: '100 tk' },
      { date: 'Apr 15', tokens: '300 tk' },
    ],
  },
  vaultmaster: {
    risk: 'HIGH',
    riskNote: '8 days ago',
    lifetime: '$380',
    tips: 21,
    sessions: 10,
    avgPerSession: '$38.00',
    firstTip: 'Apr 5, 2026',
    largestTip: '500 tokens ($25)',
    streak: '2 sessions in a row (Apr 2026)',
    bars: [65, 50, 70, 45, 60, 35, 28, 20, 15, 8],
    lastFive: [
      { date: 'May 12', tokens: '300 tk' },
      { date: 'May 5',  tokens: '150 tk' },
      { date: 'Apr 28', tokens: '500 tk' },
      { date: 'Apr 20', tokens: '100 tk' },
      { date: 'Apr 12', tokens: '200 tk' },
    ],
  },
  nightcrawler_k: {
    risk: 'HIGH',
    riskNote: '12 days ago',
    lifetime: '$240',
    tips: 14,
    sessions: 8,
    avgPerSession: '$30.00',
    firstTip: 'Apr 10, 2026',
    largestTip: '300 tokens ($15)',
    streak: '2 sessions in a row (Apr 2026)',
    bars: [55, 40, 65, 30, 50, 25, 18, 12, 8, 5],
    lastFive: [
      { date: 'May 8',  tokens: '150 tk' },
      { date: 'May 1',  tokens: '100 tk' },
      { date: 'Apr 24', tokens: '300 tk' },
      { date: 'Apr 18', tokens: '75 tk' },
      { date: 'Apr 10', tokens: '200 tk' },
    ],
  },
  redstar_tx: {
    risk: 'MED',
    riskNote: '4 days ago',
    lifetime: '$195',
    tips: 11,
    sessions: 7,
    avgPerSession: '$27.86',
    firstTip: 'Apr 20, 2026',
    largestTip: '200 tokens ($10)',
    streak: '2 sessions in a row (Apr–May 2026)',
    bars: [40, 55, 45, 60, 50, 65, 55, 70, 60, 45],
    lastFive: [
      { date: 'May 16', tokens: '100 tk' },
      { date: 'May 10', tokens: '200 tk' },
      { date: 'May 3',  tokens: '75 tk' },
      { date: 'Apr 26', tokens: '150 tk' },
      { date: 'Apr 20', tokens: '100 tk' },
    ],
  },
}

// ─── Room title data ───────────────────────────────────────────────────────────
const TITLES = {
  'playful-small-tonight':        ["💜 Come play! | Goal: 200 = surprise | Tonight only ✨", "Playful & silly tonight 🎉 | 200 token goal active | come hang 💜"],
  'playful-small-anytime':        ["💜 playful vibes | goal at 200 | come hang 🎉", "Silly & sweet | 200 token goal | tip to play 💜"],
  'playful-big-tonight':          ["🎉 Big goal tonight: 1000 tokens = [full show] | tip fast — top tipper gets VIP", "💜 Goal night! 1000 tokens unlocks something amazing — who's in? 🔥"],
  'playful-big-anytime':          ["🎉 1000 token goal | come unlock something fun | tip to help 💜", "Big goal up | playful energy | 1000 tk = show 🎉"],
  'playful-none-anytime':         ["💜 just having fun tonight | come chat | tip if you want 🎉", "playful & chill | no goal | just vibes 💜 come hang"],
  'playful-none-tonight':         ["💜 playful mood | no goal tonight | just good vibes | come hang 🎉", "silly night | no pressure | just fun 💜 tip to say hi"],
  'naughty-small-tonight':        ["😈 Naughty mood | Goal: oil show @ 300 | Tip menu active 💦", "🔥 Feeling naughty | 300 token goal — come find out what happens 😈"],
  'naughty-small-anytime':        ["😈 naughty energy | 300 goal | tip menu open | come find out 💦", "🔥 300 token goal | naughty mode | tip to play 😈"],
  'naughty-big-tonight':          ["🔥 naughty night | 1000 goal | tip to make it happen 😈 | tonight only", "😈 big naughty goal | 1000 tokens | who's brave? 🔥 tonight only"],
  'naughty-big-last hour':        ["🔥 LAST HOUR | 1000-token goal — 200 away | someone be my hero 😈💜", "⏳ Final push — 1000 goal ENDS SOON | tip to make it happen 🔥"],
  'naughty-none-tonight':         ["😈 naughty mode | no goal | just vibes | tip menu open 💦", "🔥 feeling dangerous | tip menu active | come play 😈 tonight"],
  'naughty-none-last hour':       ["😈 last hour | naughty mood | tip menu still open 🔥", "⏳ last call — naughty until I go offline 😈💦"],
  'chill-none-anytime':           ["💜 chill vibes | come chat | no pressure | tip if you want 🥰", "relaxed hang tonight 💜 | just vibes | tip to say hi"],
  'chill-none-tonight':           ["💜 chill tonight | come hang | no goal | good vibes only 🥰", "easy night 💜 | no pressure | come chat and chill"],
  'chill-small-tonight':          ["💜 chill + chat | 300 token goal = special moment | come hang", "Easy vibes tonight 💜 | goal at 300 — just having fun 🥰"],
  'chill-small-anytime':          ["💜 chill hang | 300 goal | come chat and see 🥰", "relaxed + 300 goal | tip to hang 💜"],
  'chill-big-tonight':            ["💜 chill vibes | big goal: 1000 tonight | come be part of it 🥰", "easy energy | 1000 token goal | tonight 💜 come hang"],
  'chill-big-anytime':            ["💜 chill + 1000 goal | tip to unlock something sweet 🥰", "relaxed hang | big goal active | 1000 tokens 💜"],
  'interactive-small-tonight':    ["🎮 Lush ON | tip to control me | Goal: 300 = I lose control 😈", "🎮 Lush active & ready 💜 | every tip = reaction | goal: 300 tonight"],
  'interactive-small-anytime':    ["🎮 lush on | tip to control | 300 goal 😈", "🎮 interactive toy on | 300 goal | every tip = reaction 💜"],
  'interactive-big-tonight':      ["🎮 Lush at full power | 1000 token goal tonight | tip to control 😈💜", "🎮 big interactive night | 1000 goal | lush on | come play 🔥"],
  'interactive-big-last hour':    ["🎮 FINAL HOUR | Lush on max | 500-token goal — almost there 🔥⏳", "⏳ Lush at max sensitivity | 500 token goal ending SOON — tip NOW 🎮🔥"],
  'interactive-none-anytime':     ["🎮 lush on | tip to control me | no goal just vibes 😈", "🎮 toy active | tip = I feel it | come play 💜"],
  'interactive-none-tonight':     ["🎮 lush on tonight | tip to control | no goal just fun 😈", "🎮 interactive tonight | every tip I react | come see 💜"],
}

function getTitle(vibe, goal, urgency, idx) {
  const key = `${vibe}-${goal}-${urgency}`
  const set = TITLES[key] || [`💜 ${vibe} vibes | ${goal !== 'none' ? 'Goal active' : 'come hang'} | tip menu open`, `🔥 ${vibe} mode | join the fun tonight 💜`]
  return set[idx % set.length]
}

// ─── StickyBar ────────────────────────────────────────────────────────────────
function StickyBar() {
  return (
    <div style={{
      position:       'fixed',
      top:            0,
      left:           0,
      right:          0,
      zIndex:         1000,
      height:         '56px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 24px',
      background:     'rgba(4,8,18,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom:   '1px solid rgba(168,85,247,0.2)',
    }}>
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '20px' }}>💜</span>
        <span style={{
          fontWeight:           700,
          fontSize:             '17px',
          background:           `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-0.3px',
        }}>CamCash</span>
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a href="/blog" style={{ fontSize: '14px', color: C.dim, textDecoration: 'none' }}>Blog</a>
        <a href="/guides" style={{ fontSize: '14px', color: C.dim, textDecoration: 'none' }}>Guides</a>
        <a href="/landing" style={{
          padding:        '8px 18px',
          borderRadius:   '8px',
          background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
          color:          '#fff',
          fontWeight:     700,
          fontSize:       '13px',
          textDecoration: 'none',
          whiteSpace:     'nowrap',
        }}>
          Start free →
        </a>
      </div>
    </div>
  )
}

// ─── HeroSection ──────────────────────────────────────────────────────────────
function HeroSection({ step, setStep }) {
  return (
    <section style={{
      paddingTop: '56px',
      position:   'relative',
      overflow:   'hidden',
      textAlign:  'center',
      padding:    '100px 20px 60px',
    }}>
      <div style={{
        position:      'absolute',
        inset:         0,
        background:    'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(168,85,247,0.14) 0%, rgba(4,8,18,0) 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            '8px',
          marginBottom:   '22px',
          padding:        '6px 16px',
          borderRadius:   '20px',
          background:     'rgba(168,85,247,0.1)',
          border:         '1px solid rgba(168,85,247,0.25)',
        }}>
          <span style={{ fontSize: '14px' }}>📊</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.purple, letterSpacing: '0.5px' }}>
            Interactive Dashboard Demo
          </span>
        </div>

        <h1 style={{
          fontSize:             'clamp(32px, 6vw, 52px)',
          fontWeight:           800,
          lineHeight:           1.15,
          margin:               '0 0 20px',
          background:           `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-1px',
        }}>
          See your CamCash dashboard<br />before you sign up
        </h1>

        <p style={{
          fontSize:   '16px',
          color:      C.muted,
          lineHeight: 1.65,
          margin:     '0 auto 32px',
          maxWidth:   '580px',
        }}>
          Click through the exact dashboard you&apos;ll see after uploading your tip history CSV. Real data, real insights.
        </p>

        <div style={{
          display:        'flex',
          flexWrap:       'wrap',
          gap:            '8px',
          justifyContent: 'center',
          marginBottom:   '28px',
        }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              style={{
                padding:      '7px 16px',
                borderRadius: '20px',
                border:       step === i ? 'none' : `1px solid ${C.dim}`,
                background:   step === i ? C.purple : 'transparent',
                color:        step === i ? '#fff' : C.dim,
                fontSize:     '12px',
                fontWeight:   step === i ? 700 : 500,
                cursor:       'pointer',
                transition:   'all 0.18s',
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '14px', color: C.dim }}>
          ↓ Explore below
        </div>
      </div>
    </section>
  )
}

// ─── Panel: Overview ──────────────────────────────────────────────────────────
function OverviewPanel() {
  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.white, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📊</span> Dashboard Overview
        <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted, marginLeft: '4px' }}>— your earnings at a glance</span>
      </h2>

      {/* 4 stat cards */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap:                 '12px',
        marginBottom:        '22px',
      }}>
        {[
          { label: 'Total Earnings', value: '$8,247.50', color: C.green },
          { label: 'This Month',     value: '$1,340.00', color: C.cyan },
          { label: 'Best Session',   value: '$312.50',   color: C.gold },
          { label: 'Avg / Session',  value: '$89.20',    color: C.purple },
        ].map((stat) => (
          <div key={stat.label} style={{
            background:   C.bg,
            border:       `1px solid ${C.border}`,
            borderRadius: '10px',
            padding:      '14px 16px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: C.dim, textTransform: 'uppercase', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Platform breakdown */}
      <div style={{
        background:   C.bg,
        border:       `1px solid ${C.border}`,
        borderRadius: '10px',
        padding:      '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.dim, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '14px' }}>Platform Breakdown</div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: C.white, fontWeight: 600 }}>Chaturbate</span>
            <span style={{ fontSize: '13px', color: C.muted }}>$5,608.30 · 68%</span>
          </div>
          <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(168,85,247,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '68%', borderRadius: '4px', background: `linear-gradient(90deg, ${C.purple}, ${C.pink})` }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: C.white, fontWeight: 600 }}>BongaCams</span>
            <span style={{ fontSize: '13px', color: C.muted }}>$2,639.20 · 32%</span>
          </div>
          <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(236,72,153,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '32%', borderRadius: '4px', background: `linear-gradient(90deg, ${C.pink}, #f97316)` }} />
          </div>
        </div>
      </div>

      {/* This month mini stats */}
      <div style={{
        display:   'flex',
        flexWrap:  'wrap',
        gap:       '8px',
        marginBottom: '16px',
      }}>
        {[
          { label: 'Sessions',      value: '15' },
          { label: 'Hrs Streamed',  value: '47.2' },
          { label: 'Tips Received', value: '127' },
          { label: 'Top Fan',       value: 'PurpleRain99' },
        ].map((item) => (
          <div key={item.label} style={{
            flex:         '1 1 110px',
            background:   C.bg,
            border:       `1px solid ${C.border}`,
            borderRadius: '8px',
            padding:      '10px 12px',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: C.white, marginBottom: '2px' }}>{item.value}</div>
            <div style={{ fontSize: '10px', color: C.dim, letterSpacing: '0.5px' }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        fontSize:     '12px',
        color:        C.muted,
        background:   'rgba(168,85,247,0.05)',
        border:       '1px solid rgba(168,85,247,0.12)',
        borderRadius: '8px',
        padding:      '10px 14px',
        lineHeight:   1.55,
      }}>
        💡 This is your dashboard home. Every metric updates when you upload a new CSV.
      </div>
    </div>
  )
}

// ─── Panel: Insights ──────────────────────────────────────────────────────────
function InsightsPanel() {
  const insights = [
    {
      icon: '🕐',
      iconBg: 'rgba(168,85,247,0.15)',
      bold: 'Your best earning window is Friday 9PM–1AM',
      body: 'Sessions in this window average 2.4× more than other times. Streaming just 2 extra Fridays per month could add ~$340.',
    },
    {
      icon: '🐋',
      iconBg: 'rgba(239,68,68,0.12)',
      bold: 'PurpleRain99 is overdue by 4 days',
      body: 'They tip on average every 2.1 days. Based on their history, a personal message today has an 80% chance of bringing them back.',
    },
    {
      icon: '⏱️',
      iconBg: 'rgba(34,211,238,0.12)',
      bold: 'Sessions over 90 minutes earn 68% more per hour',
      body: 'Your data shows a consistent pattern: longer sessions build momentum. Your average 90-min session earns $124 vs $74 for shorter ones.',
    },
    {
      icon: '🎯',
      iconBg: 'rgba(245,158,11,0.12)',
      bold: 'Push your goal in the first 30 minutes',
      body: 'You earn 61% of most sessions’ total in the first half. A strong opening goal announcement drives early tip cascades.',
    },
  ]

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.white, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>💡</span> AI Insights
        <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted, marginLeft: '4px' }}>— what your data reveals</span>
      </h2>

      {insights.map((ins, i) => (
        <div key={i} style={{
          background:   C.bg,
          border:       '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          padding:      '16px',
          marginBottom: '12px',
          display:      'flex',
          gap:          '14px',
          alignItems:   'flex-start',
        }}>
          <div style={{
            width:          '36px',
            height:         '36px',
            borderRadius:   '50%',
            background:     ins.iconBg,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '18px',
            flexShrink:     0,
          }}>
            {ins.icon}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, marginBottom: '5px', lineHeight: 1.4 }}>{ins.bold}</div>
            <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.6 }}>{ins.body}</div>
          </div>
        </div>
      ))}

      <div style={{
        fontSize:     '12px',
        color:        C.muted,
        background:   'rgba(168,85,247,0.05)',
        border:       '1px solid rgba(168,85,247,0.12)',
        borderRadius: '8px',
        padding:      '10px 14px',
        lineHeight:   1.55,
        marginTop:    '4px',
      }}>
        💡 Insights refresh every time you upload a new CSV — always based on YOUR actual data.
      </div>
    </div>
  )
}

// ─── Panel: Session Breakdown ─────────────────────────────────────────────────
function SessionsPanel() {
  const sessions = [
    { date: 'May 18', duration: '2h 14m', earnings: '$127.50', tips: 18, topTipper: 'kingwolf99',    perHr: '$57.04', best: false },
    { date: 'May 16', duration: '1h 48m', earnings: '$94.00',  tips: 12, topTipper: 'xDarkMatter3', perHr: '$52.22', best: false },
    { date: 'May 14', duration: '3h 02m', earnings: '$312.50', tips: 47, topTipper: 'PurpleRain99', perHr: '$102.87', best: true },
    { date: 'May 12', duration: '1h 32m', earnings: '$76.00',  tips: 9,  topTipper: 'euro_titan88', perHr: '$49.57', best: false },
    { date: 'May 10', duration: '2h 20m', earnings: '$188.00', tips: 24, topTipper: 'kingwolf99',    perHr: '$80.57', best: false },
  ]

  const colStyle = { fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: C.dim, textTransform: 'uppercase' }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.white, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📅</span> Session Breakdown
        <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted, marginLeft: '4px' }}>— every stream, analyzed</span>
      </h2>

      <div style={{
        background:   C.bg,
        border:       `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow:     'hidden',
        marginBottom: '16px',
      }}>
        {/* Table header */}
        <div style={{
          display:    'grid',
          gridTemplateColumns: '64px 72px 88px 44px 1fr 72px',
          gap:        '0',
          padding:    '10px 14px',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          {['Date', 'Duration', 'Earnings', 'Tips', 'Top Tipper', '$/hr'].map((h) => (
            <span key={h} style={colStyle}>{h}</span>
          ))}
        </div>

        {sessions.map((s, i) => (
          <div key={s.date} style={{
            display:    'grid',
            gridTemplateColumns: '64px 72px 88px 44px 1fr 72px',
            gap:        '0',
            padding:    '11px 14px',
            alignItems: 'center',
            background: s.best ? 'rgba(245,158,11,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.2)',
            borderLeft: s.best ? `3px solid ${C.gold}` : '3px solid transparent',
            borderBottom: i < sessions.length - 1 ? '1px solid rgba(168,85,247,0.06)' : 'none',
          }}>
            <span style={{ fontSize: '12px', color: C.muted }}>{s.date}</span>
            <span style={{ fontSize: '12px', color: C.muted }}>{s.duration}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{s.earnings}</span>
            <span style={{ fontSize: '12px', color: C.muted }}>{s.tips}</span>
            <span style={{ fontSize: '12px', color: C.purple, fontWeight: 600 }}>{s.topTipper}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: C.cyan }}>{s.perHr}</span>
          </div>
        ))}
      </div>

      <div style={{
        background:   'rgba(245,158,11,0.05)',
        border:       `1px solid rgba(245,158,11,0.3)`,
        borderRadius: '10px',
        padding:      '14px 16px',
        marginBottom: '14px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: C.gold, marginBottom: '4px' }}>⭐ Best Session</div>
        <div style={{ fontSize: '13px', color: C.white, lineHeight: 1.55 }}>
          May 14 — 3h 02m, <span style={{ color: C.green, fontWeight: 700 }}>$312.50</span> earned. PurpleRain99 was your top tipper with 2,000 tokens ($100).
        </div>
      </div>

      <div style={{
        fontSize:     '12px',
        color:        C.muted,
        background:   'rgba(168,85,247,0.05)',
        border:       '1px solid rgba(168,85,247,0.12)',
        borderRadius: '8px',
        padding:      '10px 14px',
        lineHeight:   1.55,
      }}>
        💡 Click any session to see a full breakdown (available in your account).
      </div>
    </div>
  )
}

// ─── Panel: Top Fans ──────────────────────────────────────────────────────────
function FansPanel() {
  const [profileFan,  setProfileFan]  = useState(null)
  const [selectedFan, setSelectedFan] = useState('PurpleRain99')
  const [reengageMsg, setReengageMsg] = useState(0)
  const [copiedRe,    setCopiedRe]    = useState(false)

  const fans = [
    { rank: 1, name: 'PurpleRain99',   lifetime: '$2,840', tips: 127, lastTip: '4 days ago',  risk: 'HIGH' },
    { rank: 2, name: 'xDarkMatter3',   lifetime: '$1,320', tips: 78,  lastTip: '5 hours ago', risk: 'LOW'  },
    { rank: 3, name: 'euro_titan88',   lifetime: '$960',   tips: 52,  lastTip: '1 day ago',   risk: 'LOW'  },
    { rank: 4, name: 'kingwolf99',     lifetime: '$750',   tips: 31,  lastTip: '3 days ago',  risk: 'MED'  },
    { rank: 5, name: 'shadow_wolf_x',  lifetime: '$480',   tips: 28,  lastTip: '6 days ago',  risk: 'HIGH' },
    { rank: 6, name: 'vaultmaster',    lifetime: '$380',   tips: 21,  lastTip: '8 days ago',  risk: 'HIGH' },
    { rank: 7, name: 'nightcrawler_k', lifetime: '$240',   tips: 14,  lastTip: '12 days ago', risk: 'HIGH' },
    { rank: 8, name: 'redstar_tx',     lifetime: '$195',   tips: 11,  lastTip: '4 days ago',  risk: 'MED'  },
  ]

  const riskColor = { HIGH: C.red, MED: C.gold, LOW: C.green }
  const riskBg    = { HIGH: 'rgba(239,68,68,0.1)', MED: 'rgba(245,158,11,0.1)', LOW: 'rgba(16,185,129,0.1)' }
  const riskBd    = { HIGH: 'rgba(239,68,68,0.3)', MED: 'rgba(245,158,11,0.3)', LOW: 'rgba(16,185,129,0.3)' }

  const highRiskFans = ['PurpleRain99', 'shadow_wolf_x', 'vaultmaster']
  const currentMsg   = (REENGAGE_MESSAGES[selectedFan] || REENGAGE_MESSAGES['PurpleRain99'])[reengageMsg % 3]

  function handleCopyRe() {
    navigator.clipboard.writeText(currentMsg).catch(() => {})
    setCopiedRe(true)
    setTimeout(() => setCopiedRe(false), 2000)
  }

  // ── Profile view ────────────────────────────────────────────────────────────
  if (profileFan !== null) {
    const p = PROFILE_DATA[profileFan] || PROFILE_DATA['PurpleRain99']
    const rC = p.risk === 'HIGH' ? C.red : p.risk === 'MED' ? C.gold : C.green
    const rBg = p.risk === 'HIGH' ? 'rgba(239,68,68,0.1)' : p.risk === 'MED' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'
    const rBd = p.risk === 'HIGH' ? 'rgba(239,68,68,0.3)' : p.risk === 'MED' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'
    const maxBar = Math.max(...p.bars)

    return (
      <div>
        <button
          onClick={() => setProfileFan(null)}
          style={{
            border:       `1px solid ${C.dim}`,
            background:   'transparent',
            color:        C.muted,
            fontSize:     '12px',
            padding:      '5px 12px',
            borderRadius: '6px',
            cursor:       'pointer',
            marginBottom: '16px',
          }}
        >
          ← Back to fans
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.purple, margin: 0 }}>{profileFan}</h2>
          <span style={{
            fontSize:     '11px',
            fontWeight:   700,
            color:        rC,
            background:   rBg,
            border:       `1px solid ${rBd}`,
            borderRadius: '20px',
            padding:      '3px 10px',
          }}>
            {p.risk} RISK · {p.riskNote}
          </span>
        </div>

        {/* Stats grid */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap:                 '10px',
          marginBottom:        '16px',
        }}>
          {[
            { label: 'Lifetime Value',    value: p.lifetime,      color: C.green  },
            { label: 'Total Tips',        value: p.tips,          color: C.cyan   },
            { label: 'Sessions Together', value: p.sessions,      color: C.purple },
            { label: 'Avg Per Session',   value: p.avgPerSession, color: C.white  },
            { label: 'First Tip',         value: p.firstTip,      color: C.muted  },
            { label: 'Largest Tip',       value: p.largestTip,    color: C.gold   },
          ].map((stat) => (
            <div key={stat.label} style={{
              background:   C.bg,
              border:       `1px solid ${C.border}`,
              borderRadius: '8px',
              padding:      '10px 12px',
            }}>
              <div style={{ fontSize: '10px', color: C.dim, fontWeight: 600, marginBottom: '4px', letterSpacing: '0.3px' }}>{stat.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Streak badge */}
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '8px',
          background:   'rgba(245,158,11,0.08)',
          border:       '1px solid rgba(245,158,11,0.25)',
          borderRadius: '8px',
          padding:      '8px 14px',
          marginBottom: '16px',
        }}>
          <span style={{ fontSize: '16px' }}>🔥</span>
          <span style={{ fontSize: '12px', color: C.gold, fontWeight: 600 }}>Streak: {p.streak}</span>
        </div>

        {/* Tip timeline bar chart */}
        <div style={{
          background:   C.bg,
          border:       `1px solid ${C.border}`,
          borderRadius: '8px',
          padding:      '12px 14px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.dim, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Tip Timeline — Last 10 Sessions
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '48px' }}>
            {p.bars.map((h, i) => (
              <div
                key={i}
                title={`Session ${i + 1}`}
                style={{
                  flex:         1,
                  height:       `${Math.round((h / maxBar) * 100)}%`,
                  minHeight:    '4px',
                  borderRadius: '3px 3px 0 0',
                  background:   `linear-gradient(180deg, ${C.purple}, rgba(168,85,247,0.4))`,
                  opacity:      0.5 + 0.5 * (h / maxBar),
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: C.dim }}>10 sessions ago</span>
            <span style={{ fontSize: '10px', color: C.dim }}>Most recent</span>
          </div>
        </div>

        {/* Last 5 tips */}
        <div style={{
          background:   C.bg,
          border:       `1px solid ${C.border}`,
          borderRadius: '8px',
          padding:      '12px 14px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.dim, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Last 5 Tips
          </div>
          {p.lastFive.map((tip, i) => (
            <div key={i} style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '6px 0',
              borderBottom:   i < p.lastFive.length - 1 ? '1px solid rgba(168,85,247,0.07)' : 'none',
            }}>
              <span style={{ fontSize: '12px', color: C.muted }}>{tip.date}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.cyan }}>{tip.tokens}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Fan list view ────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.white, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>👑</span> Top Fans
        <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted, marginLeft: '4px' }}>— ranked by lifetime spend</span>
      </h2>

      {/* Fan table */}
      <div style={{
        background:   C.bg,
        border:       `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow:     'hidden',
        marginBottom: '20px',
      }}>
        <div style={{
          display:    'grid',
          gridTemplateColumns: '28px 1fr 80px 44px 90px 52px 36px',
          gap:        '0',
          padding:    '9px 12px',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          {['#', 'Fan', 'Lifetime', 'Tips', 'Last Tip', 'Risk', ''].map((h) => (
            <span key={h} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: C.dim, textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {fans.map((fan, i) => (
          <div key={fan.name} style={{
            display:    'grid',
            gridTemplateColumns: '28px 1fr 80px 44px 90px 52px 36px',
            gap:        '0',
            padding:    '10px 12px',
            alignItems: 'center',
            borderBottom: i < fans.length - 1 ? '1px solid rgba(168,85,247,0.06)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.15)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.dim }}>{fan.rank}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>{fan.name}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{fan.lifetime}</span>
            <span style={{ fontSize: '12px', color: C.muted }}>{fan.tips}</span>
            <span style={{ fontSize: '11px', color: C.dim }}>{fan.lastTip}</span>
            <span style={{
              display:      'inline-flex',
              alignItems:   'center',
              padding:      '2px 6px',
              borderRadius: '20px',
              fontSize:     '10px',
              fontWeight:   700,
              color:        riskColor[fan.risk],
              background:   riskBg[fan.risk],
              border:       `1px solid ${riskBd[fan.risk]}`,
              width:        'fit-content',
            }}>
              {fan.risk}
            </span>
            <button
              onClick={() => setProfileFan(fan.name)}
              style={{
                border:       `1px solid ${C.dim}`,
                background:   'transparent',
                color:        C.muted,
                fontSize:     '12px',
                padding:      '4px 8px',
                borderRadius: '6px',
                cursor:       'pointer',
              }}
            >
              👁
            </button>
          </div>
        ))}
      </div>

      {/* Re-engage section */}
      <div style={{
        background:   C.bg,
        border:       `1px solid ${C.border}`,
        borderRadius: '10px',
        padding:      '16px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, marginBottom: '4px' }}>💌 Re-Engage Generator</div>
        <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px', lineHeight: 1.5 }}>
          Generate a personalized message for any at-risk fan. Copy it and send via Chaturbate DM or social.
        </div>

        {/* Fan selector pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {highRiskFans.map((name) => (
            <button
              key={name}
              onClick={() => { setSelectedFan(name); setReengageMsg(0) }}
              style={{
                padding:      '6px 14px',
                borderRadius: '20px',
                border:       selectedFan === name ? `1px solid ${C.purple}` : `1px solid ${C.dim}`,
                background:   selectedFan === name ? 'rgba(168,85,247,0.15)' : 'transparent',
                color:        selectedFan === name ? C.purple : C.muted,
                fontSize:     '12px',
                fontWeight:   selectedFan === name ? 700 : 400,
                cursor:       'pointer',
                transition:   'all 0.15s',
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Generated message */}
        <div style={{
          background:   C.card,
          border:       '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding:      '12px 14px',
          fontSize:     '13px',
          color:        C.muted,
          lineHeight:   1.65,
          minHeight:    '70px',
          marginBottom: '12px',
        }}>
          {currentMsg}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setReengageMsg((m) => (m + 1) % 3)}
            style={{
              padding:      '8px 16px',
              borderRadius: '8px',
              border:       '1px solid rgba(168,85,247,0.3)',
              background:   'rgba(168,85,247,0.06)',
              color:        C.purple,
              fontSize:     '13px',
              cursor:       'pointer',
            }}
          >
            🔄 Re-generate
          </button>
          <button
            onClick={handleCopyRe}
            style={{
              padding:      '8px 16px',
              borderRadius: '8px',
              border:       'none',
              background:   `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
              color:        '#fff',
              fontSize:     '13px',
              fontWeight:   700,
              cursor:       'pointer',
            }}
          >
            {copiedRe ? '✓ Copied!' : 'Copy Message'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel: Room Title Generator ──────────────────────────────────────────────
function TitlesPanel() {
  const [vibe,     setVibe]     = useState('playful')
  const [goal,     setGoal]     = useState('small')
  const [urgency,  setUrgency]  = useState('tonight')
  const [titleIdx, setTitleIdx] = useState(0)
  const [copied,   setCopied]   = useState(false)

  const vibeOpts    = [{ id: 'playful', label: 'Playful' }, { id: 'naughty', label: 'Naughty' }, { id: 'chill', label: 'Chill' }, { id: 'interactive', label: 'Interactive Toy' }]
  const goalOpts    = [{ id: 'none', label: 'No goal' }, { id: 'small', label: 'Small goal' }, { id: 'big', label: 'Big goal' }]
  const urgencyOpts = [{ id: 'anytime', label: 'Anytime' }, { id: 'tonight', label: 'Tonight only' }, { id: 'last hour', label: 'Last hour' }]

  const currentTitle = getTitle(vibe, goal, urgency, titleIdx)

  function handleCopy() {
    navigator.clipboard.writeText(currentTitle).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function PillSelector({ label, options, value, onChange }) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: C.dim, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setTitleIdx(0) }}
              style={{
                padding:      '6px 13px',
                borderRadius: '20px',
                border:       value === opt.id ? `1px solid ${C.purple}` : `1px solid rgba(168,85,247,0.2)`,
                background:   value === opt.id ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.04)',
                color:        value === opt.id ? C.purple : C.muted,
                fontSize:     '12px',
                fontWeight:   value === opt.id ? 700 : 400,
                cursor:       'pointer',
                transition:   'all 0.15s',
                whiteSpace:   'nowrap',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: C.white, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🎯</span> Room Title Generator
        <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted, marginLeft: '4px' }}>— optimized titles that get clicks</span>
      </h2>

      <PillSelector label="Vibe"    options={vibeOpts}    value={vibe}    onChange={setVibe}    />
      <PillSelector label="Goal"    options={goalOpts}    value={goal}    onChange={setGoal}    />
      <PillSelector label="Urgency" options={urgencyOpts} value={urgency} onChange={setUrgency} />

      {/* Generated title box */}
      <div style={{
        background:   C.bg,
        border:       '1px solid rgba(245,158,11,0.3)',
        borderRadius: '10px',
        padding:      '20px',
        marginBottom: '14px',
        fontSize:     '16px',
        fontWeight:   600,
        color:        C.white,
        lineHeight:   1.55,
        minHeight:    '64px',
      }}>
        {currentTitle}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={() => setTitleIdx((i) => i + 1)}
          style={{
            padding:      '9px 18px',
            borderRadius: '8px',
            border:       '1px solid rgba(168,85,247,0.3)',
            background:   'rgba(168,85,247,0.06)',
            color:        C.purple,
            fontSize:     '13px',
            cursor:       'pointer',
          }}
        >
          🔄 Re-generate
        </button>
        <button
          onClick={handleCopy}
          style={{
            padding:      '9px 18px',
            borderRadius: '8px',
            border:       'none',
            background:   `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
            color:        '#fff',
            fontSize:     '13px',
            fontWeight:   700,
            cursor:       'pointer',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy Title'}
        </button>
      </div>

      <div style={{
        fontSize:     '12px',
        color:        C.muted,
        background:   'rgba(168,85,247,0.05)',
        border:       '1px solid rgba(168,85,247,0.12)',
        borderRadius: '8px',
        padding:      '10px 14px',
        lineHeight:   1.6,
      }}>
        💡 Pro tip: titles with a goal, an emoji, and urgency get 2–3× more clicks. Update your title every 20 minutes during a session.
      </div>
    </div>
  )
}

// ─── LivePanel ────────────────────────────────────────────────────────────────
function LivePanel() {
  const [tips, setTips]             = useState([])
  const [tokenTotal, setTokenTotal] = useState(0)
  const [usdTotal, setUsdTotal]     = useState(0)
  const [coach, setCoach]           = useState('👁 Watching for tips — set a goal to get things started.')
  const [flashId, setFlashId]       = useState(null)
  const tipIndexRef = useRef(0)

  const FAKE_TIPS = [
    { username: 'PurpleRain99',  tokens: 200,  usd: 10.00 },
    { username: 'xDarkMatter3',  tokens: 50,   usd: 2.50  },
    { username: 'vaultmaster',   tokens: 500,  usd: 25.00 },
    { username: 'GalaxyQueen',   tokens: 100,  usd: 5.00  },
    { username: 'midnight_wolf', tokens: 25,   usd: 1.25  },
    { username: 'PurpleRain99',  tokens: 1000, usd: 50.00 },
    { username: 'silversurfer88',tokens: 75,   usd: 3.75  },
    { username: 'vaultmaster',   tokens: 300,  usd: 15.00 },
    { username: 'xDarkMatter3',  tokens: 150,  usd: 7.50  },
    { username: 'neon_dreamer',  tokens: 50,   usd: 2.50  },
  ]

  const COACHES = [
    '🔥 Room is heating up — PurpleRain99 is active, call them out by name!',
    '⚡ Tip streak detected — raise your goal while momentum is high',
    '🐋 vaultmaster just dropped 500 tokens — acknowledge them VIP style NOW',
    '💰 You\'re 73% to your goal — announce the reward out loud right now',
    '🎯 Room momentum building — set a countdown timer to create urgency',
    '🔥 EXPLOSIVE energy — push the next goal immediately, room is ready',
    '🐋 PurpleRain99 tips every ~4 min — 6 min since their last. Call them out!',
    '⚡ HIGH CONVERSION WINDOW — momentum +41% above your normal pace',
  ]

  const ROOM_STATES = [
    { label: 'WARMING',   emoji: '🌡️', color: '#22d3ee', score: 30, from: 'rgba(14,28,55,0.98)',  to: 'rgba(20,40,70,0.98)',  glow: 'rgba(34,211,238,0.12)' },
    { label: 'ACTIVE',    emoji: '⚡',  color: '#a855f7', score: 55, from: 'rgba(16,30,62,0.98)',  to: 'rgba(30,55,90,0.98)',  glow: 'rgba(168,85,247,0.22)' },
    { label: 'HOT',       emoji: '🔥',  color: '#f59e0b', score: 75, from: 'rgba(38,16,72,0.98)',  to: 'rgba(58,22,92,0.98)',  glow: 'rgba(245,158,11,0.30)' },
    { label: 'HOT',       emoji: '🔥',  color: '#f59e0b', score: 85, from: 'rgba(44,18,76,0.98)',  to: 'rgba(64,24,98,0.98)',  glow: 'rgba(245,158,11,0.38)' },
    { label: 'EXPLOSIVE', emoji: '💥',  color: '#ef4444', score: 97, from: 'rgba(60,12,28,0.98)',  to: 'rgba(88,18,38,0.98)',  glow: 'rgba(239,68,68,0.42)' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      const tipData = FAKE_TIPS[tipIndexRef.current % FAKE_TIPS.length]
      const id = Date.now()
      const tip = { ...tipData, id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
      setTips(prev => [tip, ...prev].slice(0, 8))
      setTokenTotal(prev => prev + tipData.tokens)
      setUsdTotal(prev => prev + tipData.usd)
      setFlashId(id)
      setCoach(COACHES[tipIndexRef.current % COACHES.length])
      setTimeout(() => setFlashId(null), 1800)
      tipIndexRef.current++
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  const roomState = ROOM_STATES[Math.min(Math.floor(tips.length / 2), ROOM_STATES.length - 1)]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'livepulse 1.5s infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Live Mode</div>
        <div style={{ fontSize: 10, color: C.dim, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>simulated demo</div>
      </div>

      {/* Room State Hero */}
      <div style={{ borderRadius: 12, padding: '16px 20px', marginBottom: 10, background: `linear-gradient(135deg, ${roomState.from}, ${roomState.to})`, border: `1px solid ${roomState.color}35`, boxShadow: `0 0 36px ${roomState.glow}`, transition: 'all 1s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'livepulse 1.5s infinite' }} />
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Room State</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: roomState.color, transition: 'color 1s ease' }}>{roomState.emoji} {roomState.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            {[
              { label: 'Revenue', value: `$${usdTotal.toFixed(2)}`, color: '#10b981' },
              { label: 'Tokens',  value: tokenTotal.toLocaleString(), color: '#22d3ee' },
              { label: 'Tips',    value: tips.length, color: '#a855f7' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${roomState.score}%`, borderRadius: 2, background: `linear-gradient(90deg, ${roomState.color}, #22d3ee)`, transition: 'width 1.2s ease' }} />
        </div>
      </div>

      {/* AI Coach Centerpiece */}
      <div style={{ borderRadius: 12, padding: '13px 18px', marginBottom: 10, background: 'linear-gradient(135deg, rgba(236,72,153,0.09), rgba(124,92,255,0.09))', border: '1px solid rgba(168,85,247,0.32)' }}>
        <div style={{ fontSize: 9, color: '#ec4899', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, marginBottom: 7 }}>⚡ AI Coach — Do This Now</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white, lineHeight: 1.65 }}>{coach}</div>
      </div>

      {/* Stats + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { label: 'Revenue', value: `$${usdTotal.toFixed(2)}`, color: '#10b981' },
            { label: 'Tokens',  value: tokenTotal.toLocaleString(), color: '#22d3ee' },
            { label: 'Avg Tip', value: tips.length > 0 ? `$${(usdTotal / tips.length).toFixed(2)}` : '$0.00', color: '#f59e0b' },
            { label: 'Rev/hr',  value: tips.length > 0 ? `$${(usdTotal / (tips.length * 2.4 / 3600) / 1).toFixed(0)}` : '$0', color: '#a855f7' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ borderRadius: 8, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Live Tips</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tips.length === 0 && <div style={{ fontSize: 11, color: C.dim, textAlign: 'center', padding: '12px 0' }}>Starting simulation...</div>}
            {tips.slice(0, 7).map((tip) => {
              const isFlash = tip.id === flashId
              const isBig   = tip.tokens >= 300
              return (
                <div key={tip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: isFlash ? 'rgba(168,85,247,0.2)' : isBig ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', border: isFlash ? '1px solid rgba(168,85,247,0.5)' : isBig ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent', transition: 'all 0.35s ease', boxShadow: isFlash ? '0 0 10px rgba(168,85,247,0.25)' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isFlash ? '#c084fc' : C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 82 }}>
                    {isBig ? '🐋 ' : ''}{tip.username}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: isBig ? '#f59e0b' : '#10b981', flexShrink: 0 }}>${tip.usd.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', fontSize: 11, color: C.dim, textAlign: 'center' }}>
        This is what your dashboard looks like while you stream — tips auto-capture from your Chaturbate chat
      </div>

      <style>{`@keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

// ─── DashboardWalkthrough ─────────────────────────────────────────────────────
function DashboardWalkthrough() {
  const [step, setStep] = useState(0)

  const PANELS = [OverviewPanel, InsightsPanel, SessionsPanel, FansPanel, TitlesPanel, LivePanel]
  const ActivePanel = PANELS[step]

  return (
    <section style={{ padding: '20px 20px 40px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Dashboard shell */}
        <div style={{
          background:   C.card,
          border:       `1px solid ${C.border}`,
          borderRadius: '16px',
          boxShadow:    '0 0 48px rgba(168,85,247,0.1), 0 2px 40px rgba(0,0,0,0.6)',
          overflow:     'hidden',
          display:      'flex',
          minHeight:    '480px',
        }}>

          {/* Sidebar */}
          <div style={{
            width:        '200px',
            minWidth:     '200px',
            background:   C.sidebar,
            borderRight:  `1px solid ${C.border}`,
            display:      'flex',
            flexDirection:'column',
            flexShrink:   0,
          }}>
            {/* User info */}
            <div style={{
              padding:      '18px 16px 14px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.white, marginBottom: '5px' }}>sweetpetal_live</div>
              <span style={{
                fontSize:     '10px',
                fontWeight:   700,
                color:        '#f59e0b',
                background:   'rgba(245,158,11,0.1)',
                border:       '1px solid rgba(245,158,11,0.25)',
                borderRadius: '20px',
                padding:      '2px 8px',
              }}>
                Chaturbate
              </span>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, padding: '10px 0' }}>
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => setStep(i)}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         '10px',
                    padding:     '9px 14px',
                    cursor:      'pointer',
                    background:  step === i ? 'rgba(168,85,247,0.12)' : 'transparent',
                    borderLeft:  step === i ? `3px solid ${C.purple}` : '3px solid transparent',
                    transition:  'all 0.15s',
                    userSelect:  'none',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{s.icon}</span>
                  <span style={{
                    fontSize:   '12px',
                    fontWeight: step === i ? 700 : 500,
                    color:      step === i ? C.white : C.dim,
                    lineHeight: 1.3,
                  }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </nav>

            {/* Bottom hint */}
            <div style={{
              padding:      '12px 16px',
              borderTop:    `1px solid ${C.border}`,
              fontSize:     '11px',
              color:        C.dim,
            }}>
              Upload another CSV
            </div>
          </div>

          {/* Main panel */}
          <div style={{
            flex:       1,
            padding:    '24px',
            overflowY:  'auto',
            maxHeight:  '560px',
          }}>
            <ActivePanel />
          </div>
        </div>

        {/* Navigation bar */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 0',
          maxWidth:       '1000px',
          margin:         '0 auto',
        }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              padding:      '9px 22px',
              borderRadius: '8px',
              border:       `1px solid ${C.dim}`,
              background:   'transparent',
              color:        step === 0 ? C.dim : C.muted,
              fontSize:     '14px',
              cursor:       step === 0 ? 'not-allowed' : 'pointer',
              opacity:      step === 0 ? 0.45 : 1,
            }}
          >
            ← Back
          </button>

          <span style={{ fontSize: '13px', color: C.dim }}>
            Step {step + 1} of {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              style={{
                padding:      '9px 22px',
                borderRadius: '8px',
                border:       'none',
                background:   `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                color:        '#fff',
                fontSize:     '14px',
                fontWeight:   700,
                cursor:       'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <a
              href="/landing"
              style={{
                padding:        '9px 22px',
                borderRadius:   '8px',
                background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                color:          '#fff',
                fontSize:       '14px',
                fontWeight:     700,
                textDecoration: 'none',
              }}
            >
              Finish →
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── DemoClient ───────────────────────────────────────────────────────────────
export default function DemoClient() {
  const [step, setStep] = useState(0)

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <StickyBar />
      <HeroSection step={step} setStep={setStep} />
      <DashboardWalkthrough />
      <CSVImportSection />
      <HowItWorksSection />
      <FinalCTASection />
    </div>
  )
}
