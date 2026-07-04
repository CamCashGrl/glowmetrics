"use client"
import React from "react"
import { C, glassCard } from "./dashboardTheme"

export default function DataTab({ tips, tokenRates, setTokenRates, showRateEditor, setShowRateEditor, tipPage, setTipPage, dateFrom, setDateFrom, dateTo, setDateTo, deleteTip, setShowDeleteConfirm }) {
  return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white }}>📝 Edit Data</h1>

            {/* TOKEN RATE CONFIGURATOR */}
            <div style={{ ...glassCard, borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showRateEditor ? 16 : 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>⚙️ Token → USD Rates</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Configurable per platform. Default is $0.05/token (Chaturbate standard)</div>
                </div>
                <button onClick={() => setShowRateEditor(v => !v)} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: C.cyan, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {showRateEditor ? "▲ Close" : "✏️ Edit Rates"}
                </button>
              </div>
              {showRateEditor && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                    {Object.entries(tokenRates).map(([plat, rate]) => (
                      <div key={plat} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>{plat}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: C.muted }}>$</span>
                          <input
                            type="number" step="0.001" min="0.001" max="1"
                            value={rate}
                            onChange={e => setTokenRates(r => ({ ...r, [plat]: parseFloat(e.target.value) || 0.05 }))}
                            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "6px 8px", color: C.white, fontSize: 13, outline: "none" }}
                          />
                          <span style={{ fontSize: 11, color: C.muted }}>/token</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, padding: "8px 12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8 }}>
                    💡 Chaturbate pays $0.05/token to broadcasters. BongaCams, Stripchat, and others vary — check your payout page. Changes apply to new uploads only.
                  </div>
                </div>
              )}
            </div>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑️ Delete All Tips</button>
            </div>

            <div style={{ ...glassCard, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Filter by date:</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>From</span>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTipPage(0) }}
                  min={tips.length ? new Date(Math.min(...tips.map(t => new Date(t.date_time)))).toISOString().split('T')[0] : ''}
                  max={dateTo || new Date().toISOString().split('T')[0]}
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.white, fontSize: 13, colorScheme: "dark" }} />
                <span style={{ fontSize: 12, color: C.muted }}>To</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setTipPage(0) }}
                  min={dateFrom || (tips.length ? new Date(Math.min(...tips.map(t => new Date(t.date_time)))).toISOString().split('T')[0] : '')}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.white, fontSize: 13, colorScheme: "dark" }} />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setTipPage(0) }}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 12, cursor: "pointer" }}>
                  ✕ Clear
                </button>
              )}
            </div>

            {(() => {
              const filtered = tips.filter(t => {
                const d = new Date(t.date_time)
                if (dateFrom && d < new Date(dateFrom)) return false
                if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
                return true
              })
              const PAGE = 100
              const totalPages = Math.ceil(filtered.length / PAGE)
              const pageTips = filtered.slice(tipPage * PAGE, (tipPage + 1) * PAGE)

              return (
                <>
                  <div style={{ ...glassCard, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 24 }}>
                    <div style={{ fontSize: 14, color: C.muted }}>Showing <span style={{ color: C.white, fontWeight: 600 }}>{filtered.length}</span> tips{(dateFrom || dateTo) ? ' (filtered)' : ''}</div>
                    <div style={{ fontSize: 14, color: C.muted }}>Total: <span style={{ color: C.green, fontWeight: 700 }}>${filtered.reduce((s, t) => s + t.usd, 0).toFixed(2)}</span></div>
                  </div>

                  <div style={{ ...glassCard, borderRadius: 14, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Date", "Username", "Platform", "Amount", "Tokens", "Type", "Actions"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageTips.map((t, i) => (
                          <tr key={t.id || i} className="whale-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "12px 16px", color: C.white, fontSize: 12 }}>{new Date(t.date_time).toLocaleDateString()}</td>
                            <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{t.username}</td>
                            <td style={{ padding: "12px 16px", color: C.muted }}>{t.platform}</td>
                            <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${t.usd.toFixed(2)}</td>
                            <td style={{ padding: "12px 16px", color: C.cyan }}>{t.tokens}</td>
                            <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{t.tip_type}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <button onClick={() => deleteTip(t.id)} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: C.red, fontSize: 11, cursor: "pointer" }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalPages > 1 && (
                      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <button onClick={() => setTipPage(p => Math.max(0, p - 1))} disabled={tipPage === 0}
                          style={{ padding: "7px 18px", borderRadius: 8, background: tipPage === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: tipPage === 0 ? C.muted : C.white, fontSize: 13, cursor: tipPage === 0 ? "not-allowed" : "pointer" }}>
                          ← Prev
                        </button>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          Page <span style={{ color: C.white, fontWeight: 600 }}>{tipPage + 1}</span> of <span style={{ color: C.white, fontWeight: 600 }}>{totalPages}</span>
                          <span style={{ marginLeft: 12 }}>({tipPage * PAGE + 1}–{Math.min((tipPage + 1) * PAGE, filtered.length)} of {filtered.length})</span>
                        </div>
                        <button onClick={() => setTipPage(p => Math.min(totalPages - 1, p + 1))} disabled={tipPage >= totalPages - 1}
                          style={{ padding: "7px 18px", borderRadius: 8, background: tipPage >= totalPages - 1 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: tipPage >= totalPages - 1 ? C.muted : C.white, fontSize: 13, cursor: tipPage >= totalPages - 1 ? "not-allowed" : "pointer" }}>
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
  )
}
