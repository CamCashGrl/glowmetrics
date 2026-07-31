"use client"

// Shared, presentational top stats strip — account-level/historical metrics
// only (Total Earned, Estimated $/Hour, Momentum, Best Platform, Peak
// Window) plus the Shop/Go Live actions. Used by both the dashboard's sticky
// command bar and the Live Mode page header so the numbers and their
// underlying calculations never diverge. Takes fully-computed values as
// props — it does no data fetching or metric calculation itself.
export default function TopStatsStrip({
  revenue,
  hourlyRateUnlocked,
  hourlyRate,
  hourlyRateSubtext,
  hourlyRateTooltip,
  onHourlyRateLockedClick,
  momentumLabel,
  momentumColor,
  atPeak,
  bestPlatform,
  peakWindowLabel,
  peakEtaLabel,
  onShopClick,
  shopHref = '/shop',
  onGoLiveClick,
  compact = false,
}) {
  const safeRevenue = (!isNaN(revenue) && isFinite(revenue)) ? revenue : 0
  const safeHourly = (!isNaN(hourlyRate) && isFinite(hourlyRate)) ? hourlyRate : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 48, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 20, borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#8a93ab', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>Total Earned</div>
          <div style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#60a5fa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>
            ${safeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div title={hourlyRateTooltip} style={{ fontSize: 10, color: '#8a93ab', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 2, cursor: 'help' }}>Estimated $/Hour</div>
          {hourlyRateUnlocked ? (
            <div title={hourlyRateSubtext} style={{ fontSize: 18, fontWeight: 900, color: '#22D3EE', whiteSpace: 'nowrap', cursor: 'help' }}>${safeHourly.toFixed(2)}</div>
          ) : (
            <div onClick={onHourlyRateLockedClick} title={hourlyRateSubtext} style={{ fontSize: 13, fontWeight: 700, color: '#7d8aa3', whiteSpace: 'nowrap', cursor: onHourlyRateLockedClick ? 'pointer' : 'default' }}>🔒 Locked</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#8a93ab', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>Momentum</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: momentumColor, whiteSpace: 'nowrap', animation: atPeak ? 'cmd-pulse 1.5s infinite' : 'none' }}>{momentumLabel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#8a93ab', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>Platform</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa', whiteSpace: 'nowrap' }}>{bestPlatform || '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#8a93ab', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>Peak Window</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: atPeak ? '#10B981' : '#fbbf24', whiteSpace: 'nowrap' }}>
            {peakWindowLabel ? `${peakWindowLabel}${peakEtaLabel ? ` · ${peakEtaLabel}` : ''}` : '—'}
          </div>
        </div>
      </div>
      <div style={{ paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 8 }}>
        <a href={shopHref} onClick={onShopClick} style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderRadius: 11, background: 'linear-gradient(90deg, #16F4FF 0%, #7C5CFF 48%, #FF2BAE 100%)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', boxShadow: '0 0 14px rgba(22,244,255,0.3)', letterSpacing: 0.3 }}>
          🛍️ Shop
        </a>
        {onGoLiveClick && (
          <button onClick={onGoLiveClick} style={{ padding: '8px 20px', borderRadius: 11, background: 'linear-gradient(135deg,#10B981,#22D3EE)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 14px rgba(16,185,129,0.3)', letterSpacing: 0.3 }}>
            ⚡ Go Live
          </button>
        )}
      </div>
    </div>
  )
}
