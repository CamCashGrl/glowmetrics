'use client'
import { C, glassCard, sectionTitle } from './theme'

const fmtUsd = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const COLUMNS = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'platform', label: 'Platform', sortable: true },
  { key: 'incomeType', label: 'Income type', sortable: false },
  { key: 'username', label: 'Username', sortable: true },
  { key: 'tokens', label: 'Tokens', sortable: true },
  { key: 'usd', label: 'USD amount', sortable: true },
  { key: 'conversionMethod', label: 'Conversion method', sortable: false },
  { key: 'source', label: 'Source', sortable: false },
  { key: 'warnings', label: 'Notes / warnings', sortable: false },
]

export default function RecordsTable({ records, pagination, sortBy, sortDir, onSort, page, onPageChange, loading }) {
  return (
    <div style={{ ...glassCard, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={sectionTitle}>Detailed Earnings</div>
        {pagination && (
          <div style={{ fontSize: 12, color: C.muted }}>
            {pagination.totalRecords.toLocaleString('en-US')} record{pagination.totalRecords === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: C.muted }}>Loading records…</div>
      ) : (!records || records.length === 0) ? (
        <div style={{ fontSize: 13, color: C.muted }}>No earnings records match your current filters.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.muted, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => onSort(col.key) : undefined}
                      style={{ padding: '6px 8px', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                      role={col.sortable ? 'button' : undefined}
                      tabIndex={col.sortable ? 0 : undefined}
                      onKeyDown={col.sortable ? (e => { if (e.key === 'Enter' || e.key === ' ') onSort(col.key) }) : undefined}
                      aria-sort={sortBy === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {col.label}{sortBy === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 8px', color: C.white, whiteSpace: 'nowrap' }}>{r.localDate}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{r.platformDisplay}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{r.incomeType}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{r.username}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{r.tokens.toLocaleString('en-US')}</td>
                    <td style={{ padding: '7px 8px', color: C.white, fontWeight: 700 }}>{fmtUsd(r.usd)}</td>
                    <td style={{ padding: '7px 8px', color: C.dim, fontSize: 11.5, maxWidth: 220 }}>{r.conversionMethod}</td>
                    <td style={{ padding: '7px 8px', color: C.muted }}>{r.source === 'tips' ? 'Tips & imported' : 'Paid session'}</td>
                    <td style={{ padding: '7px 8px', color: C.gold, fontSize: 11.5 }}>{r.warnings?.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.text, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontSize: 12 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pagination.totalPages}
                aria-label="Next page"
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.text, cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page >= pagination.totalPages ? 0.4 : 1, fontSize: 12 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
