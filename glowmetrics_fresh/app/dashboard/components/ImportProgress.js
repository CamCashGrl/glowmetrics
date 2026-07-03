'use client'
import { useEffect, useState } from 'react'

const C = {
  cyan: '#22D3EE', pink: '#EC4899', white: '#F1F5F9', text: '#94A3B8', muted: '#475569',
}

const PROCESSING_MESSAGES = [
  'Reading your CSV…',
  'Detecting platform…',
  'Cleaning duplicate rows…',
  'Importing tips…',
  'Updating dashboard insights…',
]

const STEPS = [
  { key: 'validating', label: 'File received' },
  { key: 'parsing', label: 'Platform detected' },
  { key: 'importing', label: 'Tips cleaned' },
  { key: 'success', label: 'Dashboard updated' },
]

const STEP_INDEX = { validating: 0, parsing: 1, importing: 2, success: 3 }

function formatDateRange(fromIso, toIso) {
  if (!fromIso || !toIso) return null
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fromStr = fmt(from)
  const toStr = fmt(to)
  return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`
}

export default function ImportProgress({ status, result, error, onViewDashboard, onUploadAnother }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const isProcessing = status === 'validating' || status === 'parsing' || status === 'importing'

  useEffect(() => {
    if (!isProcessing) { setMsgIndex(0); return }
    const id = setInterval(() => setMsgIndex(i => (i + 1) % PROCESSING_MESSAGES.length), 1100)
    return () => clearInterval(id)
  }, [isProcessing])

  if (status === 'idle') return null

  const currentStepIndex = STEP_INDEX[status] ?? 0

  return (
    <div style={styles.card}>
      <style>{`
        @keyframes imp-spin { to { transform: rotate(360deg); } }
        @keyframes imp-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.82); } }
        @keyframes imp-bar-sweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes imp-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes imp-glow { 0%,100% { box-shadow: 0 0 20px rgba(34,211,238,0.22), 0 0 40px rgba(236,72,153,0.14); } 50% { box-shadow: 0 0 34px rgba(34,211,238,0.4), 0 0 60px rgba(236,72,153,0.28); } }
        @keyframes imp-sparkle { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-20px) scale(1.1); } }
        .imp-msg { animation: imp-fade-in 260ms ease both; }
        .imp-success-card { animation: imp-glow 2.6s ease-in-out infinite; }
        @media (max-width: 480px) {
          .imp-cta-row { flex-direction: column; }
        }
      `}</style>

      {isProcessing && (
        <>
          <div style={styles.headerRow}>
            <div style={styles.spinnerRing} />
            <div style={{ minWidth: 0 }}>
              <div style={styles.title}>Processing import…</div>
              <div key={msgIndex} className="imp-msg" style={styles.subtitle}>{PROCESSING_MESSAGES[msgIndex]}</div>
            </div>
          </div>
          <div style={styles.progressTrack}>
            <div style={styles.progressFill} />
          </div>
          <Checklist currentIndex={currentStepIndex} />
        </>
      )}

      {status === 'success' && (
        <div className="imp-success-card" style={styles.successCard}>
          <div style={styles.successIconWrap}>
            <div style={styles.successIcon}>✓</div>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ ...styles.sparkle, left: `${34 + i * 16}%`, animationDelay: `${i * 0.4}s` }} />
            ))}
          </div>
          <div style={styles.successTitle}>Your tip data is in 🎉</div>
          <div style={styles.successSubtitle}>CamCash is updating your earnings, fans, sessions, and best-time insights.</div>

          {result && (
            <div style={styles.summaryBox}>
              <SummaryLine result={result} />
            </div>
          )}

          <Checklist currentIndex={4} complete />

          <div className="imp-cta-row" style={styles.ctaRow}>
            <button onClick={onViewDashboard} style={styles.primaryBtn}>View Dashboard →</button>
            <button onClick={onUploadAnother} style={styles.secondaryBtn}>Upload More Data</button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorTitle}>Import failed. Please check your file format and try again.</div>
          {error && <div style={styles.errorDetail}>{error}</div>}
          <div className="imp-cta-row" style={styles.ctaRow}>
            <button onClick={onUploadAnother} style={styles.secondaryBtn}>Try Again</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryLine({ result }) {
  const parts = [`${result.inserted ?? 0} tips added`]
  if (result.skipped > 0) parts.push(`${result.skipped} duplicates skipped`)
  if (result.platform) parts.push(`${result.platform} detected`)
  const range = formatDateRange(result.dateFrom, result.dateTo)

  return (
    <>
      <div style={{ fontWeight: 700, color: C.white, fontSize: 13 }}>
        Import complete: {parts.join(', ')}.
      </div>
      {(range || typeof result.totalUsd === 'number') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {range && <Pill label="Date range" value={range} />}
          {typeof result.totalUsd === 'number' && result.totalUsd > 0 && (
            <Pill label="Earnings imported" value={`$${result.totalUsd.toFixed(2)}`} />
          )}
        </div>
      )}
    </>
  )
}

function Pill({ label, value }) {
  return (
    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11 }}>
      <span style={{ color: C.muted }}>{label}: </span>
      <span style={{ color: C.white, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function Checklist({ currentIndex, complete = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      {STEPS.map((step, i) => {
        const done = complete || i < currentIndex
        const active = !complete && i === currentIndex
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, lineHeight: 1,
              background: done ? 'linear-gradient(135deg, #22D3EE, #EC4899)' : 'rgba(255,255,255,0.06)',
              border: done ? 'none' : '1px solid rgba(255,255,255,0.15)',
              color: done ? '#05070f' : C.muted,
              animation: active ? 'imp-pulse 1.1s ease-in-out infinite' : 'none',
            }}>{done ? '✓' : ''}</span>
            <span style={{ fontSize: 12.5, color: done ? C.white : active ? C.text : C.muted, fontWeight: active ? 600 : 400 }}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  card: {
    marginTop: 16,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    padding: 22,
    boxSizing: 'border-box',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: 14 },
  spinnerRing: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    border: '3px solid rgba(255,255,255,0.08)',
    borderTopColor: C.cyan, borderRightColor: C.pink,
    animation: 'imp-spin 0.85s linear infinite',
  },
  title: { fontSize: 14, fontWeight: 700, color: C.white },
  subtitle: { fontSize: 12.5, color: C.text, marginTop: 3 },
  progressTrack: {
    position: 'relative', height: 6, borderRadius: 999, overflow: 'hidden',
    background: 'rgba(255,255,255,0.06)', marginTop: 18,
  },
  progressFill: {
    position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999,
    background: 'linear-gradient(90deg, #22D3EE, #EC4899)',
    animation: 'imp-bar-sweep 1.3s ease-in-out infinite',
  },
  successCard: { borderRadius: 10 },
  successIconWrap: { position: 'relative', textAlign: 'center', marginBottom: 14 },
  successIcon: {
    width: 52, height: 52, borderRadius: '50%', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900,
    color: '#05070f', background: 'linear-gradient(135deg, #22D3EE, #EC4899)',
    boxShadow: '0 0 26px rgba(34,211,238,0.45), 0 0 46px rgba(236,72,153,0.3)',
  },
  sparkle: {
    position: 'absolute', top: 0, width: 5, height: 5, borderRadius: '50%',
    background: C.cyan, boxShadow: `0 0 8px ${C.cyan}`, animation: 'imp-sparkle 1.8s ease-in-out infinite',
  },
  successTitle: { fontSize: 16, fontWeight: 800, color: C.white, textAlign: 'center' },
  successSubtitle: { fontSize: 12.5, color: C.text, textAlign: 'center', marginTop: 6, lineHeight: 1.5 },
  summaryBox: {
    marginTop: 16, padding: '12px 14px', borderRadius: 10,
    background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)',
  },
  ctaRow: { display: 'flex', gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #22D3EE, #EC4899)',
    boxShadow: '0 0 20px rgba(34,211,238,0.35), 0 0 40px rgba(236,72,153,0.25)',
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  errorCard: { textAlign: 'center' },
  errorIcon: { fontSize: 32, marginBottom: 10 },
  errorTitle: { fontSize: 14, fontWeight: 700, color: '#F87171' },
  errorDetail: { fontSize: 12.5, color: C.text, marginTop: 8, lineHeight: 1.5 },
}
