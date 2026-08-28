// Presentation-only helpers — no financial calculation lives here. All
// numbers arrive already computed from /api/tx-hub (which itself defers to
// lib/txHub.js). This file only formats them for display.

export function money(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function compactMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return money(n)
}

export function pct(n, { withSign = true } = {}) {
  if (n == null || Number.isNaN(n)) return null
  const sign = withSign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function number(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

export function dateLabel(iso, opts = {}) {
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts })
}

export function shortDateLabel(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function timeLabel(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export function todayIso() {
  return isoDate(new Date())
}

export function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

export function presetToRange(presetId) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (presetId) {
    case 'today':
      return { from: isoDate(startOfToday), to: isoDate(startOfToday) }
    case 'yesterday': {
      const y = new Date(startOfToday); y.setDate(y.getDate() - 1)
      return { from: isoDate(y), to: isoDate(y) }
    }
    case '7d':
      return { from: daysAgoIso(6), to: todayIso() }
    case '30d':
      return { from: daysAgoIso(29), to: todayIso() }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: isoDate(start), to: todayIso() }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: isoDate(start), to: isoDate(end) }
    }
    default:
      return { from: daysAgoIso(29), to: todayIso() }
  }
}
