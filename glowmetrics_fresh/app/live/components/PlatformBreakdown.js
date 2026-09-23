'use client'
import { useState, useEffect } from 'react'

/**
 * PlatformBreakdown: Live earnings display per platform
 *
 * Shows real-time breakdown of:
 * - Earnings per platform (USD)
 * - Tip count per platform
 * - Platform status (active/inactive)
 * - Percentage of total earnings
 */
export default function PlatformBreakdown({ platformStats = [], totalUSD = 0, currentlyStreaming = null }) {
  const [expandedPlatform, setExpandedPlatform] = useState(null)

  const PLATFORM_COLORS = {
    Chaturbate: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', icon: '💬' },
    BongaCams: { bg: 'rgba(168, 85, 247, 0.1)', border: '#a855f7', icon: '🎭' },
    MyFreeCams: { bg: 'rgba(249, 115, 22, 0.1)', border: '#f97316', icon: '✨' },
    Stripchat: { bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', icon: '💃' },
    CamSoda: { bg: 'rgba(34, 211, 238, 0.1)', border: '#22d3ee', icon: '🥤' },
    Unknown: { bg: 'rgba(148, 163, 184, 0.1)', border: '#94a3b8', icon: '❓' },
  }

  const containerStyle = {
    background: 'rgba(15,20,32,0.75)',
    border: '1px solid rgba(168,85,247,0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 0 40px rgba(59,130,246,0.15)',
  }

  const headerStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const platformRowStyle = (platform) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '8px',
    background: PLATFORM_COLORS[platform]?.bg || PLATFORM_COLORS.Unknown.bg,
    border: `1px solid ${PLATFORM_COLORS[platform]?.border || PLATFORM_COLORS.Unknown.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    opacity: currentlyStreaming === platform ? 1 : 0.7,
  })

  const statsContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    gap: '12px',
  }

  const platformNameStyle = {
    fontSize: '13px',
    fontWeight: '500',
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }

  const statValueStyle = {
    fontSize: '12px',
    color: '#cbd5e1',
    textAlign: 'right',
  }

  const usdValueStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981',
  }

  const percentageStyle = {
    fontSize: '11px',
    color: '#94a3b8',
  }

  const statusIndicatorStyle = (isActive) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: isActive ? '#10b981' : '#64748b',
    display: 'inline-block',
    marginRight: '4px',
    animation: isActive ? 'cc-pulse 2s infinite' : 'none',
  })

  const emptyStateStyle = {
    textAlign: 'center',
    padding: '20px',
    color: '#64748b',
    fontSize: '13px',
  }

  if (!platformStats || platformStats.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          📊 Platform Earnings (Live)
        </div>
        <div style={emptyStateStyle}>
          Waiting for tips... Platform breakdown will appear here
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        📊 Platform Earnings (Live)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {platformStats.map((stat) => {
          const percentage =
            totalUSD > 0
              ? ((stat.totalUSD / totalUSD) * 100).toFixed(0)
              : 0
          const isActive = currentlyStreaming === stat.platform
          const platformColor = PLATFORM_COLORS[stat.platform] || PLATFORM_COLORS.Unknown

          return (
            <div
              key={stat.platform}
              style={platformRowStyle(stat.platform)}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'translateX(4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isActive ? '1' : '0.7'
                e.currentTarget.style.transform = 'translateX(0)'
              }}
              onClick={() =>
                setExpandedPlatform(
                  expandedPlatform === stat.platform ? null : stat.platform
                )
              }
            >
              <div style={statsContainerStyle}>
                <div style={platformNameStyle}>
                  <span style={statusIndicatorStyle(isActive)} />
                  <span>{platformColor.icon}</span>
                  <span>{stat.platform}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <div style={usdValueStyle}>${stat.totalUSD.toFixed(2)}</div>
                <div style={statValueStyle}>
                  {stat.tipCount} tip{stat.tipCount !== 1 ? 's' : ''} ({percentage}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {totalUSD > 0 && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#cbd5e1',
          }}
        >
          <span>Total Earnings (This Session)</span>
          <span style={{ fontWeight: '600', color: '#10b981' }}>
            ${totalUSD.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
