'use client'
import { useState, useEffect } from 'react'

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171"
}

const glowAnimation = `
  @keyframes subGlow {
    0%, 100% {
      box-shadow: 0 0 8px rgba(168,85,247,0.4), inset 0 0 8px rgba(168,85,247,0.2);
      border-color: rgba(168,85,247,0.4);
    }
    50% {
      box-shadow: 0 0 16px rgba(168,85,247,0.6), inset 0 0 12px rgba(168,85,247,0.3);
      border-color: rgba(168,85,247,0.6);
    }
  }

  .sub-manager-hover {
    animation: subGlow 2s ease-in-out infinite;
  }
`

export default function SubscriptionManager({ isPro = false, subscriptionData = null, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(subscriptionData)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!subscriptionData) {
      fetchSubscriptionData()
    }
  }, [subscriptionData])

  const fetchSubscriptionData = async () => {
    try {
      const res = await fetch('/api/user/subscription', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        const subData = await res.json()
        setData(subData)
      }
    } catch (e) {
      console.error('Failed to fetch subscription:', e)
      setError('Could not load subscription details')
    }
  }

  const handleOpenPortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
      } else {
        setError(json.error || 'Failed to open billing portal')
      }
    } catch (e) {
      setError('Failed to open billing portal')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return C.green
      case 'trialing': return C.cyan
      case 'past_due': return C.red
      case 'canceled': return C.muted
      default: return C.text
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return '✓ Active'
      case 'trialing': return '🎁 Trial'
      case 'past_due': return '⚠️ Past Due'
      case 'canceled': return '✕ Canceled'
      default: return status
    }
  }

  if (!isPro) {
    return (
      <>
        <style>{glowAnimation}</style>
        <div style={{
          padding: "16px 12px", borderRadius: 9,
          background: "rgba(124,92,255,0.08)", border: "1px solid rgba(124,92,255,0.3)",
          marginBottom: 8
        }}>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>
            Upgrade to Pro to unlock full analytics, historical data, and advanced insights.
          </div>
          <a href="/pricing" style={{
            display: "inline-block", width: "100%", padding: "8px 12px",
            borderRadius: 6, background: C.purple, color: C.white, textDecoration: "none",
            fontSize: 12, fontWeight: 700, textAlign: "center", cursor: "pointer",
            border: "none", transition: "all 0.2s"
          }} onMouseEnter={e => e.target.style.transform = "scale(1.02)"} onMouseLeave={e => e.target.style.transform = "scale(1)"}>
            ✦ Upgrade to Pro
          </a>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{glowAnimation}</style>
      <div
        className={isHovered ? "sub-manager-hover" : ""}
        style={{
          display: "flex", flexDirection: "column", gap: 10,
          padding: "12px", borderRadius: 9,
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.25)",
          marginBottom: 8,
          transition: "all 0.3s ease-in-out",
          cursor: "pointer"
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* Status Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11 }}>✦</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.purple }}>Pro plan active</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: getStatusColor(data?.subscription_status || 'active'),
          textTransform: 'uppercase', letterSpacing: 0.5
        }}>
          {getStatusLabel(data?.subscription_status || 'active')}
        </span>
      </div>

      {/* Next Billing Date */}
      {data?.plan_expires_at && (
        <div style={{
          fontSize: 10, color: C.text,
          background: "rgba(255,255,255,0.04)", padding: "8px", borderRadius: 6
        }}>
          <div style={{ color: "#7d8aa3", marginBottom: 2 }}>Next billing date</div>
          <div style={{ color: C.cyan, fontWeight: 700 }}>
            {formatDate(data.plan_expires_at)}
          </div>
        </div>
      )}

      {/* Plan Type */}
      {data?.billing_cycle && (
        <div style={{
          fontSize: 10, color: C.text,
          background: "rgba(255,255,255,0.04)", padding: "8px", borderRadius: 6
        }}>
          <div style={{ color: "#7d8aa3", marginBottom: 2 }}>Billing cycle</div>
          <div style={{ color: C.white, fontWeight: 600, textTransform: 'capitalize' }}>
            {data.billing_cycle}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={handleOpenPortal} disabled={loading}
          style={{
            flex: 1, padding: "8px 10px", borderRadius: 6,
            background: C.purple, color: C.white, border: "none",
            fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: "all 0.2s", opacity: loading ? 0.7 : 1
          }}
          onMouseEnter={e => !loading && (e.target.style.background = "#9d4edd")}
          onMouseLeave={e => !loading && (e.target.style.background = C.purple)}
        >
          {loading ? 'Opening...' : '⚙️ Manage'}
        </button>
        <a href="/pricing" style={{
          flex: 1, padding: "8px 10px", borderRadius: 6,
          background: "rgba(34,211,238,0.15)", color: C.cyan, border: "none",
          fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
          textDecoration: 'none', transition: "all 0.2s"
        }}
          onMouseEnter={e => e.target.style.background = "rgba(34,211,238,0.25)"}
          onMouseLeave={e => e.target.style.background = "rgba(34,211,238,0.15)"}
        >
          📊 Plans
        </a>
      </div>

      {error && (
        <div style={{
          fontSize: 10, color: C.red,
          background: "rgba(248,113,113,0.1)", padding: "8px", borderRadius: 6
        }}>
          {error}
        </div>
      )}

        <div style={{
          fontSize: 9, color: "#7d8aa3", textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4
        }}>
          💡 Click "Manage" to change payment method, upgrade billing cycle, or cancel
        </div>
      </div>
    </>
  )
}
