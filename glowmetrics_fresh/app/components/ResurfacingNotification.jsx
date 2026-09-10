/**
 * ResurfacingNotification Component
 *
 * Displays Pro Live Mode resurfacing notifications in the live events feed.
 * Shows evidence of returning Whale/Regular fans with calculated metrics.
 *
 * Props:
 * - notification: { tier, username, platform, dormancyDays, gapDeviation, evidenceQuality, returnMessage }
 * - isHighPriority: boolean (Whale = true, others = false)
 */

const C = {
  bg: '#040812',
  card: 'rgba(15,20,32,0.75)',
  border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7',
  cyan: '#22d3ee',
  green: '#10b981',
  white: '#f1f5f9',
  muted: '#94a3b8',
  gold: '#f59e0b'
}

export default function ResurfacingNotification({ notification, isHighPriority }) {
  if (!notification) return null

  const tierEmoji = {
    whale: '🐋',
    regular: '👥',
    highValue: '⭐',
    other: '👤'
  }

  const bgColor = isHighPriority
    ? 'rgba(34,211,238,0.15)'
    : 'rgba(168,85,247,0.1)'

  const borderColor = isHighPriority
    ? 'rgba(34,211,238,0.3)'
    : 'rgba(168,85,247,0.2)'

  return (
    <div style={{
      background: bgColor,
      border: `2px solid ${borderColor}`,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      boxShadow: isHighPriority ? '0 0 20px rgba(34,211,238,0.2)' : 'none',
      animation: isHighPriority ? 'pulse 2s infinite' : 'none'
    }}>
      {/* Header: Tier + Username */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
      }}>
        <span style={{ fontSize: 20 }}>
          {tierEmoji[notification.resurfacingType] || '👤'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            color: C.white,
            fontWeight: 700,
            fontSize: 14
          }}>
            {notification.username}
          </div>
          <div style={{
            color: C.muted,
            fontSize: 11
          }}>
            {notification.platform.toUpperCase()} • {notification.tier} Tier
          </div>
        </div>
        <div style={{
          background: isHighPriority ? 'rgba(34,211,238,0.2)' : 'rgba(168,85,247,0.2)',
          color: isHighPriority ? C.cyan : C.purple,
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600
        }}>
          🔄 Returning
        </div>
      </div>

      {/* Message: Dormancy indicator */}
      <div style={{
        color: C.cyan,
        fontSize: 13,
        marginBottom: 10,
        fontStyle: 'italic',
        paddingLeft: 28
      }}>
        {notification.returnMessage}
      </div>

      {/* Evidence: Calculated metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        paddingLeft: 28,
        fontSize: 12
      }}>
        <div>
          <div style={{ color: C.muted, marginBottom: 2 }}>Dormancy Period</div>
          <div style={{ color: C.white, fontWeight: 600 }}>
            {notification.dormancyDays} days
          </div>
        </div>

        <div>
          <div style={{ color: C.muted, marginBottom: 2 }}>Gap vs Personal Average</div>
          <div style={{ color: C.white, fontWeight: 600 }}>
            {notification.gapDeviation}x their typical pattern
          </div>
        </div>

        {notification.evidenceQuality && (
          <>
            <div>
              <div style={{ color: C.muted, marginBottom: 2 }}>Observation Count</div>
              <div style={{ color: C.white, fontWeight: 600 }}>
                {notification.evidenceQuality.observationCount} tips
              </div>
            </div>

            <div>
              <div style={{ color: C.muted, marginBottom: 2 }}>Confidence</div>
              <div style={{
                color: notification.evidenceQuality.confidenceLevel === 'high'
                  ? C.green
                  : notification.evidenceQuality.confidenceLevel === 'moderate'
                    ? C.gold
                    : C.muted,
                fontWeight: 600,
                textTransform: 'capitalize'
              }}>
                {notification.evidenceQuality.confidenceLevel} ({notification.evidenceQuality.score})
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(34,211,238,0.2); }
          50% { box-shadow: 0 0 40px rgba(34,211,238,0.4); }
        }
      `}</style>
    </div>
  )
}
