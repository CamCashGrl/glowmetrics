'use client'
import { C, glassCard, sectionTitle } from './theme'

const SEVERITY_COLOR = { warning: C.gold, info: C.muted, danger: C.red }

export default function DataQualityPanel({ issues }) {
  return (
    <div style={{ ...glassCard, padding: 20, marginBottom: 20 }}>
      <div style={sectionTitle}>Review Before Export</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        Nothing below has been changed, removed, or hidden from your totals — these notes are here so you can review
        anything unusual before exporting.
      </div>

      {(!issues || issues.length === 0) ? (
        <div style={{ fontSize: 13, color: C.green }}>No data-quality issues were detected for this period.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issues.map((issue, i) => (
            <li
              key={i}
              style={{
                display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${SEVERITY_COLOR[issue.severity] || C.dim}22`,
              }}
            >
              <span style={{ color: SEVERITY_COLOR[issue.severity] || C.muted, fontSize: 14, lineHeight: '18px' }}>•</span>
              <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
