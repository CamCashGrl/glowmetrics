"use client"
import React, { useState } from 'react'
import {
  computeCrossPlatformMetrics,
  computeHourlyPattern,
  buildEfficiencyMatrix,
  computePlatformCardStats,
  calculateSessionTypeBreakdown,
  calculateDayOfWeekBreakdown,
  calculatePeakHours,
  calculateTopFans,
  calculateDataMilestones,
} from '../../lib/platformIntelligence'

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171"
}

const PLATFORM_EMOJI = {
  Chaturbate: "🟣", BongaCams: "🔴", MyFreeCams: "🟠",
  CamSoda: "🟢", Stripchat: "🔵", Flirt4Free: "💜"
}

const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

const fmt$ = (n) => `$${(n || 0).toFixed(2)}`
const fmtN = (n) => new Intl.NumberFormat('en-US').format(Math.round(n || 0))

// ============================================
// UNIFIED VIEW: Cross-Platform Overview
// ============================================

function UnifiedView({ crossPlatform, tips, paidSessions, isPro }) {
  const { platformStats, totalUSD, totalTips, totalHours, totalUsdPerHour, topByRevenue, topByEfficiency, topFans } = crossPlatform
  const hourlyPattern = computeHourlyPattern(tips, paidSessions)
  const efficiencyMatrix = buildEfficiencyMatrix(platformStats)

  const maxHourly = Math.max(...hourlyPattern.map(h => h.usd), 1)

  return (
    <div className="platforms-page">
      {/* HEADER */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 6 }}>📊 Platform Intelligence</h1>
        <p style={{ fontSize: 13, color: C.muted }}>Unified view across all your platforms</p>
      </div>

      {/* SUMMARY SNAPSHOT */}
      {platformStats.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { icon: "💰", label: "Total Earned", value: fmt$(totalUSD), sub: `${totalTips} tips`, color: C.gold },
            { icon: "⏱️", label: "Total Hours", value: `${totalHours}h`, sub: `${platformStats.length} platforms`, color: C.cyan },
            { icon: "⚡", label: "$/Hour", value: totalUsdPerHour ? fmt$(totalUsdPerHour) : "—", sub: "combined efficiency", color: C.green },
            { icon: "🏆", label: "Top Platform", value: topByRevenue?.platform || "—", sub: fmt$(topByRevenue?.usd || 0), color: C.pink },
          ].map(({ icon, label, value, sub, color }) => (
            <div key={label} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{icon} {label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* EFFICIENCY MATRIX */}
      {efficiencyMatrix.length > 1 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 20 }}>⚡ Efficiency Comparison</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: 12, color: C.muted, fontSize: 11, fontWeight: 700 }}>Platform</th>
                  <th style={{ textAlign: "right", padding: 12, color: C.muted, fontSize: 11, fontWeight: 700 }}>Revenue</th>
                  <th style={{ textAlign: "right", padding: 12, color: C.muted, fontSize: 11, fontWeight: 700 }}>$/Hour</th>
                  <th style={{ textAlign: "center", padding: 12, color: C.muted, fontSize: 11, fontWeight: 700 }}>vs Avg</th>
                </tr>
              </thead>
              <tbody>
                {efficiencyMatrix.map((row, i) => (
                  <tr key={row.platform} style={{ borderBottom: i < efficiencyMatrix.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <td style={{ padding: 12, color: C.white, fontSize: 13, fontWeight: 600 }}>
                      {PLATFORM_EMOJI[row.platform] || "🎥"} {row.platform}
                    </td>
                    <td style={{ textAlign: "right", padding: 12, color: C.gold, fontSize: 13, fontWeight: 600 }}>
                      {fmt$(row.usd)}
                    </td>
                    <td style={{ textAlign: "right", padding: 12, color: C.cyan, fontSize: 13, fontWeight: 600 }}>
                      {row.usdPerHour ? fmt$(row.usdPerHour) : "—"}
                    </td>
                    <td style={{ textAlign: "center", padding: 12 }}>
                      <span style={{ color: row.efficiencyVsAvg > 0 ? C.green : row.efficiencyVsAvg < 0 ? C.red : C.muted, fontSize: 12, fontWeight: 700 }}>
                        {row.efficiencyVsAvg > 0 ? '+' : ''}{row.efficiencyVsAvg}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TIMING INTELLIGENCE */}
      {hourlyPattern.length > 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 20 }}>🕐 Peak Earning Hours</h2>
          <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflowX: "auto", height: 80 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const data = hourlyPattern.find(x => x.hour === h) || { usd: 0, count: 0 }
              const intensity = data.usd / maxHourly
              const bg = intensity === 0
                ? "rgba(255,255,255,0.04)"
                : intensity < 0.33
                ? "rgba(34,211,238,0.2)"
                : intensity < 0.66
                ? "rgba(34,211,238,0.55)"
                : "rgba(34,211,238,0.95)"
              const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`
              return (
                <div key={h} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto" }} title={`${label}: ${fmt$(data.usd)}`}>
                  <div style={{ width: 16, height: 60, borderRadius: 3, background: bg, border: `1px solid ${C.border}` }} />
                  {h % 6 === 0 && <div style={{ fontSize: 9, color: C.muted }}>{label}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TOP FANS */}
      {topFans.length > 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 20 }}>👥 Top Supporters</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topFans.map((fan, i) => (
              <div key={fan.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>#{i + 1} {fan.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.pink }}>{fmt$(fan.usd)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {platformStats.length === 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No platform data yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Import your CSV files to see unified insights</div>
        </div>
      )}

      {isPro === false && (
        <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(168,85,247,0.1)", border: `1px solid ${C.purple}80`, marginTop: 28 }}>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 700 }}>✦ Upgrade to Pro</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Unlock historical trends, ML recommendations, and forecasting</div>
        </div>
      )}
    </div>
  )
}

// ============================================
// SPLIT VIEW: Single Platform Deep Dive
// ============================================

function SplitView({ selectedPlatform, platforms, tips, paidSessions, isPro }) {
  if (!selectedPlatform) return null

  const stats = computePlatformCardStats(selectedPlatform, tips, paidSessions)
  const sessionTypes = calculateSessionTypeBreakdown(tips, paidSessions, selectedPlatform)
  const daysOfWeek = calculateDayOfWeekBreakdown(tips, paidSessions, selectedPlatform)
  const peakHours = calculatePeakHours(tips, paidSessions, selectedPlatform)
  const topFans = calculateTopFans(tips, paidSessions, selectedPlatform)

  if (!stats.hasData) {
    return (
      <div className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No data for {selectedPlatform}</div>
        <div style={{ fontSize: 13, color: C.muted }}>Import CSV data from this platform to see insights</div>
      </div>
    )
  }

  const maxDayUSD = Math.max(...daysOfWeek.map(d => d.usd), 1)

  return (
    <div className="platforms-page">
      {/* HEADER */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 6 }}>
          {PLATFORM_EMOJI[selectedPlatform] || "🎥"} {selectedPlatform} Deep Dive
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>Platform-specific analysis and opportunities</p>
      </div>

      {/* KEY METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { icon: "💰", label: "Earned", value: fmt$(stats.usd), color: C.gold },
          { icon: "🎁", label: "Tips", value: fmtN(stats.tipCount), color: C.pink },
          { icon: "⏱️", label: "Hours", value: `${stats.hours}h`, color: C.cyan },
          { icon: "⚡", label: "$/Hour", value: stats.usdPerHour ? fmt$(stats.usdPerHour) : "—", color: C.green },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="dash-card" style={{ ...glassCard, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{icon} {label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* SESSION TYPE BREAKDOWN */}
      {sessionTypes.length > 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 }}>📊 Revenue by Type</h2>
          {sessionTypes.map((type, i) => (
            <div key={type.type} style={{ marginBottom: i < sessionTypes.length - 1 ? 12 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.text }}>{type.type}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.cyan }}>{type.pct}% • {fmt$(type.usd)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${type.pct}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DAY OF WEEK BREAKDOWN */}
      {daysOfWeek.some(d => d.count > 0) && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 }}>📅 Earnings by Day</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {daysOfWeek.map(day => (
              <div key={day.day} style={{ textAlign: "center", padding: 12, background: day.count > 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: day.count > 0 ? C.cyan : C.muted, marginBottom: 6 }}>{day.day.slice(0, 3)}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmt$(day.usd)}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{day.count} {day.count === 1 ? 'tip' : 'tips'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PEAK HOURS */}
      {peakHours.length > 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 }}>🕐 Peak Hours (Top 7)</h2>
          {peakHours.map((hour, i) => (
            <div key={hour.hour} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, marginBottom: i < peakHours.length - 1 ? 8 : 0, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: C.text }}>{hour.hourLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>{fmt$(hour.usd)}</span>
            </div>
          ))}
        </div>
      )}

      {/* TOP FANS */}
      {topFans.length > 0 && (
        <div className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 }}>👥 Top Supporters</h2>
          {topFans.map((fan, i) => (
            <div key={fan.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, marginBottom: i < topFans.length - 1 ? 8 : 0, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: C.text }}>#{i + 1} {fan.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.pink }}>{fmt$(fan.usd)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT: UNIFIED/SPLIT TOGGLE
// ============================================

export default function PlatformsIntelligence({ platforms = [], tips = [], paidSessions = [], isPro = false }) {
  const [view, setView] = useState('unified')
  const [selectedPlatform, setSelectedPlatform] = useState(platforms[0] || null)

  const crossPlatform = computeCrossPlatformMetrics(platforms, tips, paidSessions)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* VIEW TOGGLE + PLATFORM SELECTOR */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
          {[
            { val: 'unified', label: '📊 Unified View' },
            { val: 'split', label: '🎯 Deep Dive' }
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setView(val)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                transition: "all 0.15s",
                background: view === val ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "transparent",
                color: view === val ? C.white : C.muted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'split' && platforms.length > 1 && (
          <select
            value={selectedPlatform || ''}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.white,
              cursor: "pointer",
            }}
          >
            <option value="" disabled>Select platform...</option>
            {platforms.map(p => (
              <option key={p} value={p}>{PLATFORM_EMOJI[p] || '🎥'} {p}</option>
            ))}
          </select>
        )}
      </div>

      {/* RENDER ACTIVE VIEW */}
      {view === 'unified' ? (
        <UnifiedView crossPlatform={crossPlatform} tips={tips} paidSessions={paidSessions} isPro={isPro} />
      ) : (
        <SplitView selectedPlatform={selectedPlatform} platforms={platforms} tips={tips} paidSessions={paidSessions} isPro={isPro} />
      )}
    </div>
  )
}
