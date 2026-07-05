"use client"
import Button from "../../components/ui/Button"

// ============================================
// CONFIRMATION MODAL COMPONENT
// ============================================

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", orange: "#FB923C",
  white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const ConfirmationModal = ({ result, onConfirm, onCancel }) => {
  const { confirmation, stats, platform } = result
  
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20, overflowY: "auto"
    }}>
      <div style={{
        background: C.card, border: `2px solid ${C.cyan}`,
        borderRadius: 14, padding: 32, maxWidth: 700,
        maxHeight: "90vh", overflowY: "auto"
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>📊</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: C.white, marginBottom: 8 }}>
            Confirm Import
          </h2>
          <p style={{ fontSize: 14, color: C.muted }}>
            Please verify this data before importing
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Total Tips</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.cyan }}>{confirmation.totalTips}</div>
          </div>
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Total Revenue</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>${confirmation.totalRevenue}</div>
          </div>
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Date Range</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{stats.dateRange.earliest}</div>
            <div style={{ fontSize: 11, color: C.muted }}>to {stats.dateRange.latest}</div>
          </div>
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Platform</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.pink }}>{platform}</div>
          </div>
        </div>

        {confirmation.topTipper && (
          <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: C.gold, marginBottom: 4 }}>🏆 Top Tipper</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{confirmation.topTipper.username}</div>
            <div style={{ fontSize: 14, color: C.muted }}>${confirmation.topTipper.amount} total</div>
          </div>
        )}

        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 12 }}>
            📋 Sample Data (first 5 rows)
          </h3>
          <div style={{ fontSize: 12, fontFamily: "monospace" }}>
            {confirmation.sampleRows.map((row, i) => (
              <div key={i} style={{
                padding: "8px 0",
                borderBottom: i < confirmation.sampleRows.length - 1 ? `1px solid ${C.border}` : "none",
                color: C.text
              }}>
                <div style={{ color: C.cyan }}>{row.date}</div>
                <div style={{ color: C.white, fontWeight: 600 }}>{row.username}</div>
                <div style={{ color: C.green }}>{row.amount}</div>
              </div>
            ))}
          </div>
        </div>

        {result.warningMessage && (
          <div style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}>{result.warningMessage}</div>
            {result.skipped && result.skipped.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 13, color: C.muted, cursor: "pointer" }}>View skipped rows</summary>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {result.skipped.slice(0, 5).map((issue, i) => (
                    <div key={i} style={{ marginBottom: 4, color: C.text }}>
                      Row {issue.row}: {issue.problems.join(', ')}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px 24px", borderRadius: 8,
            background: C.card2, border: `1px solid ${C.border}`,
            color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer"
          }}>
            Cancel
          </button>
          <Button onClick={() => onConfirm(result.data)} style={{ flex: 1 }}>
            ✓ Confirm & Import
          </Button>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: C.muted }}>
          Your data will be imported exactly as shown above
        </div>
      </div>
    </div>
  )
}

// ============================================
// ERROR MODAL
// ============================================

const ErrorModal = ({ error, suggestions, issues, onClose }) => {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20, overflowY: "auto"
    }}>
      <div style={{
        background: C.card, border: `2px solid ${C.red}`,
        borderRadius: 14, padding: 32, maxWidth: 700,
        maxHeight: "90vh", overflowY: "auto"
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: C.red, marginBottom: 8 }}>Upload Stopped</h2>
          <p style={{ fontSize: 16, color: C.white }}>{error.message}</p>
        </div>

        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.cyan, marginBottom: 12 }}>🔧 How to Fix:</h3>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{error.fix}</div>
        </div>

        {suggestions && suggestions.length > 0 && (
          <div style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.orange, marginBottom: 8 }}>💡 We found:</h3>
            {suggestions.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>
                <span style={{ color: C.red }}>"{s.found}"</span> →
                <span style={{ color: C.green }}> "{s.suggest}"</span>
                <div style={{ fontSize: 12, color: C.muted, marginLeft: 16 }}>{s.reason}</div>
              </div>
            ))}
          </div>
        )}

        {issues && issues.length > 0 && (
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20, maxHeight: 300, overflowY: "auto" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 8 }}>🔍 Problems Found:</h3>
            {issues.slice(0, 10).map((issue, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ color: C.red, fontWeight: 600 }}>Row {issue.row}:</div>
                <ul style={{ marginLeft: 20, fontSize: 12 }}>
                  {issue.problems.map((p, j) => (
                    <li key={j} style={{ color: C.muted }}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
            {issues.length > 10 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>... and {issues.length - 10} more issues</div>
            )}
          </div>
        )}

        <Button onClick={onClose} style={{ width: "100%" }}>
          Got It - I'll Fix My CSV
        </Button>
      </div>
    </div>
  )
}

export { ConfirmationModal, ErrorModal }
