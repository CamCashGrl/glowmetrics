"use client"

import { useEffect } from 'react'
import { track as gtmTrack } from '../../lib/track'
import { PLATFORM_TOKEN_RATES } from '../../lib/constants'

/*
 * CREATOR REPORT
 *
 * This component intentionally reads from the existing analytics object.
 * It does NOT create a second analytics engine and does NOT invent:
 * - industry benchmarks
 * - churn calculations
 * - missed-revenue formulas
 * - platform performance formulas
 *
 * The goal is:
 *
 * FREE
 *   Give the creator a genuinely useful report.
 *   Show the "aha" moments.
 *   Give one real action.
 *   Naturally expose the value of Pro.
 *
 * PRO
 *   Reveal the additional actions and deeper information
 *   already supplied by the analytics engine.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DISPLAY NAMES
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_DISPLAY_NAMES = Object.fromEntries(
  Object.keys(PLATFORM_TOKEN_RATES).map(name => [
    name.toLowerCase(),
    name
  ])
)

const displayPlatform = (platform) => {
  if (!platform) return null

  return (
    PLATFORM_DISPLAY_NAMES[String(platform).toLowerCase()] ||
    platform
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  cyan: '#22D3EE',
  pink: '#EC4899',
  gold: '#F59E0B',
  green: '#10B981',
  white: '#F1F5F9',
  muted: '#94A3B8',
  dim: '#64748B',
  purple: '#A855F7',
  red: '#F87171',
  blue: '#60A5FA',
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtUsd = (value, decimals = 0) => {
  const number = Number(value)

  if (!Number.isFinite(number)) return '$0'

  return `$${number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

const fmtHour = (hour) => {
  const number = parseInt(hour, 10)

  if (hour == null || Number.isNaN(number)) {
    return null
  }

  if (number === 0) return '12 AM'
  if (number < 12) return `${number} AM`
  if (number === 12) return '12 PM'

  return `${number - 12} PM`
}

const fmtMinutes = (minutes) => {
  const value = Number(minutes)

  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  const hours = Math.floor(value / 60)
  const mins = Math.round(value % 60)

  if (hours === 0) {
    return `${mins}m`
  }

  if (mins === 0) {
    return `${hours}h`
  }

  return `${hours}h ${mins}m`
}

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max)

// ─────────────────────────────────────────────────────────────────────────────
// REPORT MATURITY
//
// This is presentation logic only. It does NOT pretend to be an analytics
// confidence calculation. It simply explains how much historical data the
// report has available.
// ─────────────────────────────────────────────────────────────────────────────

function getReportMaturity(analytics, tips = []) {
  const sessions = Number(analytics?.meaningfulSessionCount || 0)
  const tipCount = Number(
    analytics?.totalTips ||
    analytics?.tipCount ||
    tips.length ||
    0
  )

  const platformCount = Array.isArray(analytics?.platforms)
    ? analytics.platforms.length
    : 0

  let score = 0

  // Tips contribute up to 40%
  score += clamp(tipCount / 500, 0, 1) * 40

  // Meaningful sessions contribute up to 40%
  score += clamp(sessions / 10, 0, 1) * 40

  // Multiple platforms contribute up to 20%
  score += clamp(platformCount / 3, 0, 1) * 20

  score = Math.round(clamp(score, 10, 100))

  if (score < 35) {
    return {
      score,
      label: 'Early Signal',
      description:
        'Your report is starting to recognize patterns. More streaming history will make the recommendations more precise.',
      tone: C.cyan,
    }
  }

  if (score < 70) {
    return {
      score,
      label: 'Developing Pattern',
      description:
        'CamCash has enough history to start identifying meaningful patterns in your streaming.',
      tone: C.purple,
    }
  }

  return {
    score,
    label: 'High Pattern Certainty',
    description:
      'Your history contains enough signal for CamCash to identify stronger recurring patterns.',
    tone: C.green,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const STAT_ACCENTS = [
  {
    accent: '#F472B6',
    glowClass: 'card-glow-pink',
  },
  {
    accent: '#22D3EE',
    glowClass: 'card-glow-cyan',
  },
  {
    accent: '#A78BFA',
    glowClass: 'card-glow-violet',
  },
  {
    accent: '#FBBF24',
    glowClass: 'card-glow-gold',
  },
]

function StatCard({
  icon,
  label,
  value,
  sub,
  index = 0,
  muted = false,
}) {
  const { accent, glowClass } =
    STAT_ACCENTS[index % STAT_ACCENTS.length]

  return (
    <div
      className={`stat-card ${glowClass}`}
      style={{
        borderRadius: 16,
        padding: '14px 16px',
        background: 'rgba(15,20,32,0.78)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        animation: `fadeUp 0.3s ease ${index * 0.06}s both`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg,${accent}80,${accent}20)`,
          borderRadius: '16px 16px 0 0',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            fontWeight: 800,
          }}
        >
          {label}
        </span>

        <span
          style={{
            fontSize: 16,
            opacity: 0.75,
          }}
        >
          {icon}
        </span>
      </div>

      <div
        title={typeof value === 'string' ? value : undefined}
        style={{
          fontSize: 'clamp(18px, 2vw, 23px)',
          fontWeight: 900,
          color: muted ? C.muted : accent,
          lineHeight: 1.15,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            fontSize: 10,
            color: C.dim,
            marginTop: 5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED ACTION
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_MOVE_LABELS = {
  '⏰': 'An optimal timing change for your next stream',
  '📅': 'A scheduling opportunity from your history',
  '🐳': 'A high-value supporter action',
  '👑': 'A high-value supporter action',
  '📉': 'A recent performance issue worth addressing',
  '📈': 'A trend in your numbers worth acting on',
  '🎯': 'A platform strategy opportunity',
  '💰': 'An opportunity to improve your earnings per hour',
  '💡': 'Another personalized recommendation from your history',
}

function lockedMoveLabel(move) {
  return (
    LOCKED_MOVE_LABELS[move?.icon] ||
    'Another personalized recommendation from your history'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED PREVIEW CARD
// ─────────────────────────────────────────────────────────────────────────────

function LockedAction({
  icon = '🔒',
  title,
  onUpgrade,
  source,
}) {
  const handleUpgrade = () => {
    try {
      gtmTrack('creator_report_upgrade_click', {
        source: source || 'creator_report_locked_action',
      })
    } catch (_) {}

    onUpgrade?.()
  }

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        border: '1px solid rgba(168,85,247,0.25)',
        background:
          'linear-gradient(110deg, rgba(26,22,37,0.82), rgba(18,14,28,0.92))',
        minHeight: 62,
      }}
    >
      {/* blurred payload */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          opacity: 0.28,
          filter: 'blur(3px)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'rgba(168,85,247,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 9,
              width: '75%',
              borderRadius: 6,
              background: C.white,
              marginBottom: 7,
            }}
          />

          <div
            style={{
              height: 7,
              width: '48%',
              borderRadius: 6,
              background: C.muted,
            }}
          />
        </div>
      </div>

      {/* overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '0 12px',
          background:
            'linear-gradient(90deg, rgba(18,14,28,0.1), rgba(18,14,28,0.84) 48%, rgba(18,14,28,0.98))',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#C084FC',
            whiteSpace: 'nowrap',
          }}
        >
          🔑 Pro Feature
        </span>

        <button
          onClick={handleUpgrade}
          style={{
            border: '1px solid rgba(236,72,153,0.35)',
            borderRadius: 8,
            padding: '7px 11px',
            background:
              'linear-gradient(90deg, rgba(236,72,153,0.95), rgba(168,85,247,0.95))',
            color: '#fff',
            fontWeight: 800,
            fontSize: 10,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Reveal Action
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY CARD
// ─────────────────────────────────────────────────────────────────────────────

function OpportunityCard({
  insight,
  type = 'opportunity',
}) {
  const isWarning = type === 'warning'

  return (
    <div
      style={{
        borderRadius: 16,
        padding: '17px 18px',
        background: isWarning
          ? 'rgba(248,113,113,0.07)'
          : 'rgba(16,185,129,0.07)',
        border: `1px solid ${
          isWarning
            ? 'rgba(248,113,113,0.22)'
            : 'rgba(16,185,129,0.22)'
        }`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: isWarning ? C.red : C.green,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 7,
        }}
      >
        {isWarning
          ? '⚠️ Worth Watching'
          : '💡 Biggest Opportunity'}
      </div>

      <div
        style={{
          fontSize: 13,
          color: C.white,
          lineHeight: 1.6,
        }}
      >
        {insight?.text ||
          (isWarning
            ? 'No major warning has been detected in your recent data.'
            : 'Keep importing history to uncover your strongest opportunity.')}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CreatorReport({
  analytics,
  tips = [],
  isPro = false,
  onUpgrade,
  engineInsights = null,
}) {
  // ───────────────────────────────────────────────────────────────────────────
  // EXISTING ANALYTICS ONLY
  // ───────────────────────────────────────────────────────────────────────────

  const totalUSD = Number(analytics?.totalUSD || 0)

  const hourlyRate = Number(
    analytics?.estimatedHourlyRate || 0
  )

  const totalTips = Number(
    analytics?.totalTips ||
    analytics?.tipCount ||
    tips.length ||
    0
  )

  const meaningfulSessions = Number(
    analytics?.meaningfulSessionCount || 0
  )

  const totalStreamMinutes = Number(
    analytics?.totalStreamMinutes || 0
  )

  const uniqueFanCount = Number(
    analytics?.uniqueFanCount || 0
  )

  const platforms = Array.isArray(analytics?.platforms)
    ? analytics.platforms
    : []

  const topTippers = Array.isArray(analytics?.topTippers)
    ? analytics.topTippers
    : []

  const insights = Array.isArray(analytics?.insights)
    ? analytics.insights
    : []

  const nextMoves = Array.isArray(analytics?.nextMoves)
    ? analytics.nextMoves
    : []

  const monthlyData = Array.isArray(analytics?.monthlyData)
    ? analytics.monthlyData
    : []

  // Existing canonical best-time result
  const canonicalBestWindow =
    analytics?.canonicalBestTimes?.bestWindow || null

  const canonicalEarlySignal =
    analytics?.canonicalBestTimes?.earlySignal || null

  // Existing canonical best platform result
  const topPlatform =
    analytics?.bestPlatformByRate || null

  const rankablePlatformCount =
    Number(analytics?.rankablePlatformCount || 0)

  // Existing monthly growth
  const latestMonth =
    monthlyData.length > 0
      ? monthlyData[monthlyData.length - 1]
      : null

  const monthGrowthPct =
    latestMonth?.growthPct ?? null

  // Existing insight system
  const warningInsight =
    insights.find(item => item?.icon === '📉') ||
    null

  const opportunityInsight =
    insights.find(item => item !== warningInsight) ||
    null

  // Existing maturity display
  const maturity = getReportMaturity(
    analytics,
    tips
  )

  // First recommendation remains free.
  // Additional recommendations become Pro.
  const freeMove =
    nextMoves.length > 0
      ? nextMoves[0]
      : null

  const lockedMoves =
    nextMoves.slice(1, 3)

  const track = (name, props) => {
    try {
      gtmTrack(name, props)
    } catch (_) {}
  }

  useEffect(() => {
    track('creator_report_viewed', {
      isPro,
      totalTips,
      meaningfulSessions,
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ───────────────────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ───────────────────────────────────────────────────────────────────────────

  if (!analytics && tips.length === 0) {
    return (
      <div
        style={{
          borderRadius: 22,
          padding: '54px 32px',
          textAlign: 'center',
          background: 'rgba(12,16,34,0.78)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div
          style={{
            fontSize: 42,
            marginBottom: 12,
          }}
        >
          🧾
        </div>

        <div
          style={{
            fontSize: 19,
            fontWeight: 900,
            color: C.white,
            marginBottom: 8,
          }}
        >
          Your Creator Report is ready for your data
        </div>

        <div
          style={{
            fontSize: 13,
            color: C.muted,
            maxWidth: 460,
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Import your streaming history and CamCash will turn
          your numbers into a personalized creator report.
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REPORT
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      {/* ───────────────────────────────────────────────────────────────────────
          HEADER
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          marginBottom: 18,
          borderRadius: 20,
          padding: '20px 22px',
          background:
            'linear-gradient(135deg, rgba(20,30,58,0.92), rgba(38,16,48,0.88))',
          border: '1px solid rgba(255,255,255,0.09)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 240,
            height: 240,
            right: -90,
            top: -130,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(34,211,238,0.12), transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 18,
            position: 'relative',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: C.white,
                marginBottom: 4,
              }}
            >
              🧾 Your Creator Report
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              Built from your imported streaming history —
              here&apos;s what your numbers actually say.
            </div>
          </div>

          <div
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              background: `${maturity.tone}12`,
              border: `1px solid ${maturity.tone}35`,
              color: maturity.tone,
              fontSize: 10,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {maturity.label}
          </div>
        </div>

        {/* Calibration */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 15,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Report Calibration
            </span>

            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: maturity.tone,
              }}
            >
              {maturity.score}%
            </span>
          </div>

          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${maturity.score}%`,
                height: '100%',
                borderRadius: 99,
                background:
                  'linear-gradient(90deg, #22D3EE, #A855F7, #EC4899)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          <div
            style={{
              fontSize: 10,
              color: C.dim,
              marginTop: 7,
            }}
          >
            {maturity.description}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          CORE STATS
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <StatCard
          index={0}
          icon="💰"
          label="Total Earnings"
          value={fmtUsd(totalUSD)}
          sub={
            monthGrowthPct !== null
              ? `${monthGrowthPct >= 0 ? '↑' : '↓'} ${Math.abs(monthGrowthPct)}% vs last month`
              : `${totalTips.toLocaleString()} tips tracked`
          }
        />

        <StatCard
          index={1}
          icon="⏱️"
          label="Avg $ / Hour"
          value={
            hourlyRate > 0
              ? fmtUsd(hourlyRate)
              : 'Building signal'
          }
          sub={
            analytics?.hourlyRateSessionCount
              ? `${analytics.hourlyRateSessionCount} qualifying sessions`
              : undefined
          }
          muted={hourlyRate <= 0}
        />

        <StatCard
          index={2}
          icon="🎬"
          label="Sessions"
          value={meaningfulSessions || 'Building'}
          sub={
            totalStreamMinutes
              ? `${fmtMinutes(totalStreamMinutes)} streamed`
              : 'Import more history for stronger patterns'
          }
          muted={!meaningfulSessions}
        />

        <StatCard
          index={3}
          icon="📅"
          label="Best Streaming Day"
          value={
            canonicalBestWindow?.localDay ||
            'More variance needed'
          }
          sub={
            canonicalBestWindow
              ? `${canonicalBestWindow.sessionCount || 0} qualifying sessions`
              : 'More history required to isolate a peak day'
          }
          muted={!canonicalBestWindow}
        />

        <StatCard
          index={0}
          icon="⏰"
          label="Best Streaming Time"
          value={
            canonicalBestWindow
              ? fmtHour(canonicalBestWindow.localHour)
              : canonicalEarlySignal
                ? fmtHour(canonicalEarlySignal.localHour) ||
                  'Early signal'
                : 'Analyzing'
          }
          sub={
            canonicalBestWindow
              ? `${fmtUsd(canonicalBestWindow.medianUsdPerHour || 0)}/hr median`
              : canonicalEarlySignal
                ? 'Early streaming signal'
                : 'More sessions required'
          }
          muted={!canonicalBestWindow}
        />

        <StatCard
          index={1}
          icon="👑"
          label="Top Supporter"
          value={
            topTippers[0]?.username ||
            'Building'
          }
          sub={
            topTippers[0]
              ? `${fmtUsd(topTippers[0].usd)} lifetime`
              : uniqueFanCount
                ? `${uniqueFanCount} fans tracked`
                : 'Import more history'
          }
          muted={!topTippers[0]}
        />

        <StatCard
          index={2}
          icon="🎯"
          label="Best Platform"
          value={
            topPlatform
              ? displayPlatform(topPlatform.platform)
              : 'Building'
          }
          sub={
            topPlatform
              ? `${fmtUsd(topPlatform.usdPerHour || 0)}/hr${
                  rankablePlatformCount > 1
                    ? ` · best of ${rankablePlatformCount}`
                    : ''
                }`
              : platforms.length
                ? `${platforms.length} platform${platforms.length === 1 ? '' : 's'} tracked`
                : 'Import platform data'
          }
          muted={!topPlatform}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          THE AHA MOMENT
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          marginBottom: 18,
          borderRadius: 18,
          padding: '18px 20px',
          background:
            'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(168,85,247,0.10))',
          border: '1px solid rgba(34,211,238,0.20)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: C.cyan,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 7,
          }}
        >
          ✨ What Your Data Discovered
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: C.white,
            marginBottom: 6,
          }}
        >
          {opportunityInsight?.text ||
            (canonicalBestWindow
              ? `Your strongest streaming signal appears around ${canonicalBestWindow.localDay || 'your best day'} at ${fmtHour(canonicalBestWindow.localHour) || 'your best hour'}.`
              : 'CamCash is still learning your strongest patterns.')}
        </div>

        <div
          style={{
            fontSize: 11,
            color: C.muted,
            lineHeight: 1.6,
          }}
        >
          {canonicalBestWindow
            ? 'This pattern is based on the streaming history you have imported so far.'
            : 'The more varied streaming history you import, the more precisely CamCash can identify your strongest opportunities.'}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          OPPORTUNITY + WARNING
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <OpportunityCard
          insight={opportunityInsight}
          type="opportunity"
        />

        <OpportunityCard
          insight={warningInsight}
          type="warning"
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          FREE NEXT BEST MOVE
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          borderRadius: 18,
          padding: '18px 20px',
          background: 'rgba(12,16,34,0.78)',
          border: '1px solid rgba(255,255,255,0.09)',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: C.white,
            }}
          >
            🎯 Your Next Best Move
          </div>

          {!isPro && nextMoves.length > 1 && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                color: C.purple,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              1 free action
            </div>
          )}
        </div>

        {freeMove ? (
          <div
            style={{
              padding: '13px 14px',
              borderRadius: 12,
              background:
                'linear-gradient(90deg, rgba(34,211,238,0.07), rgba(168,85,247,0.07))',
              border:
                '1px solid rgba(34,211,238,0.14)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 11,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                flex: '0 0 32px',
                borderRadius: 9,
                background: 'rgba(34,211,238,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              {freeMove.icon || '🎯'}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: C.white,
                  lineHeight: 1.6,
                }}
              >
                {freeMove.text}
              </div>

              <div
                style={{
                  marginTop: 7,
                  fontSize: 10,
                  color: C.cyan,
                  fontWeight: 800,
                }}
              >
                ✓ Included with your free report
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.025)',
              border:
                '1px solid rgba(255,255,255,0.06)',
              color: C.muted,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Keep importing streaming history and CamCash
            will build personalized next moves from your data.
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          PRO CONVERSION AREA
      ─────────────────────────────────────────────────────────────────────── */}

      {!isPro && (
        <div
          style={{
            borderRadius: 20,
            padding: '20px',
            marginBottom: 18,
            background:
              'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(236,72,153,0.09))',
            border:
              '1px solid rgba(168,85,247,0.22)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              right: -90,
              bottom: -150,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(236,72,153,0.16), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#C084FC',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 6,
              }}
            >
              ✨ Your Data Found More
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: C.white,
                marginBottom: 6,
              }}
            >
              Your free report found the pattern.
              Pro helps you act on it.
            </div>

            <div
              style={{
                fontSize: 11,
                color: C.muted,
                lineHeight: 1.6,
                maxWidth: 620,
                marginBottom: 15,
              }}
            >
              Unlock the additional personalized actions
              already generated from your streaming history.
            </div>

            {lockedMoves.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 15,
                }}
              >
                {lockedMoves.map((move, index) => (
                  <LockedAction
                    key={index}
                    icon={move?.icon || '🔒'}
                    title={lockedMoveLabel(move)}
                    source={`creator_report_locked_move_${index + 2}`}
                    onUpgrade={onUpgrade}
                  />
                ))}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => {
                  track(
                    'creator_report_upgrade_click',
                    {
                      source:
                        'creator_report_primary_cta',
                    }
                  )

                  onUpgrade?.()
                }}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 11,
                  padding: '11px 22px',
                  fontWeight: 900,
                  fontSize: 12,
                  color: '#06101A',
                  background:
                    'linear-gradient(90deg, #22D3EE, #A855F7, #EC4899)',
                  boxShadow:
                    '0 8px 28px rgba(168,85,247,0.20)',
                }}
              >
                ✨ Reveal My Next Moves
              </button>
            </div>

            <div
              style={{
                textAlign: 'center',
                marginTop: 8,
                fontSize: 9,
                color: C.dim,
              }}
            >
              Creator Pro · unlock the full intelligence layer
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          PRO USER: FULL ACTION LIST
      ─────────────────────────────────────────────────────────────────────── */}

      {isPro && nextMoves.length > 0 && (
        <div
          style={{
            borderRadius: 18,
            padding: '18px 20px',
            background: 'rgba(12,16,34,0.78)',
            border:
              '1px solid rgba(168,85,247,0.18)',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: C.white,
              marginBottom: 12,
            }}
          >
            ✨ Your Personalized Action Plan
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {nextMoves.slice(0, 5).map((move, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 11,
                  alignItems: 'flex-start',
                  padding: '11px 12px',
                  borderRadius: 10,
                  background:
                    'rgba(255,255,255,0.03)',
                  border:
                    '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                  }}
                >
                  {move?.icon || '🎯'}
                </span>

                <div
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: C.white,
                    lineHeight: 1.6,
                  }}
                >
                  {move?.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          DATA DEPTH
      ─────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            padding: '15px 17px',
            background: 'rgba(255,255,255,0.025)',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              textTransform: 'uppercase',
              fontWeight: 900,
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            📊 Data Tracked
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: C.white,
            }}
          >
            {totalTips.toLocaleString()}
          </div>

          <div
            style={{
              fontSize: 10,
              color: C.dim,
              marginTop: 4,
            }}
          >
            tips across {platforms.length || 0}{' '}
            platform{platforms.length === 1 ? '' : 's'}
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            padding: '15px 17px',
            background: 'rgba(255,255,255,0.025)',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              textTransform: 'uppercase',
              fontWeight: 900,
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            👥 Fans Tracked
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: C.white,
            }}
          >
            {uniqueFanCount || topTippers.length || '—'}
          </div>

          <div
            style={{
              fontSize: 10,
              color: C.dim,
              marginTop: 4,
            }}
          >
            from your imported history
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            padding: '15px 17px',
            background: 'rgba(255,255,255,0.025)',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              textTransform: 'uppercase',
              fontWeight: 900,
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            ⏱️ Streaming Time
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: C.white,
            }}
          >
            {fmtMinutes(totalStreamMinutes) || '—'}
          </div>

          <div
            style={{
              fontSize: 10,
              color: C.dim,
              marginTop: 4,
            }}
          >
            recorded across qualifying sessions
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          EARLY DATA EXPLANATION
      ─────────────────────────────────────────────────────────────────────── */}

      {maturity.score < 70 && (
        <div
          style={{
            borderRadius: 16,
            padding: '15px 17px',
            marginBottom: 18,
            background:
              'rgba(34,211,238,0.045)',
            border:
              '1px solid rgba(34,211,238,0.14)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: C.cyan,
              marginBottom: 5,
            }}
          >
            🔮 Keep Feeding Your Report
          </div>

          <div
            style={{
              fontSize: 11,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            {maturity.score < 35
              ? 'You are in the early-signal stage. CamCash can already show your earnings and initial patterns, but more varied sessions will help separate real trends from one-off results.'
              : 'Your report is developing stronger patterns. More sessions across different days and times will increase the reliability of your best-window insights.'}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          PRO FOOTER
      ─────────────────────────────────────────────────────────────────────── */}

      {isPro && (
        <div
          style={{
            textAlign: 'center',
            padding: '12px 0 4px',
            color: C.dim,
            fontSize: 9,
          }}
        >
          ✨ Creator Pro · Your report updates as new streaming
          history is imported.
        </div>
      )}
    </div>
  )
}
