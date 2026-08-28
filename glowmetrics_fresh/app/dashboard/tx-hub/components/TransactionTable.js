"use client"
import { C, card, TYPE_COLORS, platformColor } from '../theme'
import { money, number, shortDateLabel, timeLabel } from '../lib/format'

const COLUMNS = [
  { id: 'date', label: 'Date', sortable: true },
  { id: 'platform', label: 'Platform', sortable: true },
  { id: 'username', label: 'Username', sortable: true },
  { id: 'type', label: 'Type', sortable: true },
  { id: 'tokens', label: 'Tokens', sortable: false },
  { id: 'amount', label: 'USD', sortable: true },
  { id: 'status', label: 'Status', sortable: false },
  { id: 'session', label: 'Session', sortable: false },
]

function SortHeader({ col, sortBy, sortDir, onSort }) {
  const active = sortBy === col.id
  return (
    <th
      onClick={() => col.sortable && onSort(col.id)}
      style={{
        textAlign: col.id === 'amount' || col.id === 'tokens' ? 'right' : 'left',
        padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: active ? C.cyan : C.muted,
        cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {col.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

function StatusPill({ status }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
      background: 'rgba(34,197,94,0.12)', color: C.green, border: '1px solid rgba(34,197,94,0.3)',
      textTransform: 'capitalize',
    }}>{status}</span>
  )
}

function TypePill({ label }) {
  const color = TYPE_COLORS[label] || C.muted
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, padding: '3px 9px', borderRadius: 100, background: `${color}18`, border: `1px solid ${color}40` }}>
      {label}
    </span>
  )
}

function MobileCard({ tx, onClick }) {
  return (
    <button onClick={onClick} style={{
      ...card({ padding: 14, textAlign: 'left', width: '100%', cursor: 'pointer' }),
      display: 'flex', flexDirection: 'column', gap: 6, border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, color: C.white, fontSize: 14 }}>{tx.username}</div>
        <div style={{ fontWeight: 800, color: C.cyan, fontSize: 15 }}>{money(tx.usd)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: platformColor(tx.platform) }}>{tx.platform}</span>
          <TypePill label={tx.typeLabel} />
        </div>
        <StatusPill status={tx.status} />
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>{shortDateLabel(tx.dateTime)} · {timeLabel(tx.dateTime)}</div>
    </button>
  )
}

export default function TransactionTable({
  rows, total, page, pageSize, sortBy, sortDir, onSort, onPageChange, onSelect, loading, locked, lockedMessage,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div style={{ ...card({ padding: 0, overflow: 'hidden' }), marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Transactions</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {total > 0 ? `${rangeStart}–${rangeEnd} of ${number(total)}` : ''}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 8 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          No transactions match your filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="tx-desktop-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLUMNS.map(col => (
                    <SortHeader key={col.id} col={col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(tx => (
                  <tr key={tx.id} onClick={() => onSelect(tx)} style={{
                    borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 13, color: C.text, whiteSpace: 'nowrap' }}>
                      {shortDateLabel(tx.dateTime)}<span style={{ color: C.muted }}> · {timeLabel(tx.dateTime)}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: platformColor(tx.platform), whiteSpace: 'nowrap' }}>
                      {tx.platform}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: C.white, whiteSpace: 'nowrap' }}>{tx.username}</td>
                    <td style={{ padding: '12px 14px' }}><TypePill label={tx.typeLabel} /></td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: C.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {tx.tokens ? `${number(tx.tokens)} tokens` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, color: C.white, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {money(tx.usd)}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusPill status={tx.status} /></td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                      {tx.sessionLabel || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="tx-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: 10, padding: 14 }}>
            {rows.map(tx => <MobileCard key={tx.id} tx={tx} onClick={() => onSelect(tx)} />)}
          </div>

          {locked && (
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, background: C.cyanSoft, fontSize: 12, color: C.cyan, fontWeight: 600 }}>
              {lockedMessage || 'Upgrade to Creator Pro to see your complete transaction history.'}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={pagerBtn(page <= 1)}>← Prev</button>
            <span style={{ fontSize: 12, color: C.muted }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} style={pagerBtn(page >= totalPages)}>Next →</button>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 860px) {
          .tx-desktop-table { display: none; }
          .tx-mobile-cards { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

function pagerBtn(disabled) {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)',
    color: disabled ? C.faint : C.text, cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
