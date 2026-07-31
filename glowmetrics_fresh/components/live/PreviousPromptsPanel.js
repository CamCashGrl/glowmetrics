"use client"
import { useState } from 'react'
import { LM } from './theme'
import { TRIGGER_ICON, promptConfidence } from '../../lib/coaching/triggers'

function timeLabel(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const STATUS_META = {
  performed: { label: 'Performed', color: LM.green, icon: '✓' },
  skipped: { label: 'Skipped', color: LM.textMuted, icon: '—' },
  unmarked: { label: 'Needs response', color: LM.orange, icon: '●' },
};

function PromptRow({ prompt, onRespond, busyId, expanded, onToggle }) {
  const meta = STATUS_META[prompt.action_status] || STATUS_META.unmarked;
  const isOpen = expanded === prompt.id;
  const needsResponse = prompt.action_status === 'unmarked';
  return (
    <div style={{
      padding: '13px 12px', marginBottom: 8, borderRadius: 12,
      background: needsResponse ? 'rgba(255,155,34,0.06)' : LM.card,
      border: `1px solid ${needsResponse ? 'rgba(255,155,34,0.25)' : LM.border}`,
      animation: 'lm-slide-in 0.3s ease',
    }}>
      <button
        onClick={() => onToggle(prompt.id)}
        aria-expanded={isOpen}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'inherit' }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} aria-hidden="true">{TRIGGER_ICON[prompt.type] || '💡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: LM.text }}>{prompt.title}</span>
            <span style={{ fontSize: 11, color: LM.textMuted, flexShrink: 0 }}>{timeLabel(prompt.shown_at)}</span>
          </div>
          <div style={{ fontSize: 12, color: LM.textSecondary, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {prompt.compact_message || prompt.message}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{ color: meta.color, fontSize: 11 }}>{meta.icon}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
            </span>
            <span style={{ fontSize: 11, color: LM.textMuted }}>· {promptConfidence(prompt.type)}% confidence</span>
          </div>
        </div>
        <span style={{ color: LM.textMuted, fontSize: 13, flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} aria-hidden="true">›</span>
      </button>
      {isOpen && needsResponse && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginLeft: 26 }}>
          <button
            onClick={() => onRespond(prompt.id, 'performed')}
            disabled={busyId === prompt.id}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: LM.magenta, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: busyId === prompt.id ? 0.6 : 1 }}
          >
            ✓ Mark as Performed
          </button>
          <button
            onClick={() => onRespond(prompt.id, 'skipped')}
            disabled={busyId === prompt.id}
            style={{ padding: '6px 12px', borderRadius: 8, background: LM.surface, border: `1px solid ${LM.borderStrong}`, color: LM.textSecondary, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: busyId === prompt.id ? 0.6 : 1 }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'needs_response', label: 'Needs response' },
  { id: 'performed', label: 'Performed' },
  { id: 'skipped', label: 'Skipped' },
];

// Tall, independently-scrolling panel. Fetches from GET
// /api/live/coaching/history (paginated, newest-first, DB-backed) — a
// separate read path from the single "current prompt" GET /api/live/coaching
// uses, so an older/expired/already-answered prompt is still reachable and
// resolvable here (never just an in-memory ref that resets on refresh).
export default function PreviousPromptsPanel({
  prompts, needsResponseCount, totalCount, loading, filter, onFilterChange,
  onRespond, busyId, onClearAll, onLoadMore, hasMore, onViewFullHistory,
}) {
  const [expanded, setExpanded] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <aside
      aria-label="Previous coaching prompts"
      style={{
        border: `1px solid ${LM.magenta}`, borderRadius: 14, background: LM.panel,
        display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480,
        maxHeight: 'calc(100vh - 140px)', overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${LM.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: LM.text }}>Previous Prompts</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setFilterOpen((o) => !o)} aria-label="Filter prompts" aria-expanded={filterOpen}
              style={{ background: 'none', border: 'none', color: LM.textMuted, cursor: 'pointer', fontSize: 13 }}>
              ⚙
            </button>
            <button onClick={onClearAll} style={{ background: 'none', border: 'none', color: LM.magenta, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Clear All
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: LM.textMuted, marginTop: 6 }}>
          {totalCount} prompt{totalCount === 1 ? '' : 's'}{needsResponseCount > 0 ? ` · ${needsResponseCount} need${needsResponseCount === 1 ? 's' : ''} response` : ''}
        </div>
        {filterOpen && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => onFilterChange(f.id)}
                style={{
                  padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: filter === f.id ? 'rgba(232,42,184,0.16)' : 'transparent',
                  border: `1px solid ${filter === f.id ? LM.magenta : LM.border}`,
                  color: filter === f.id ? LM.magenta : LM.textMuted,
                }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px', scrollbarWidth: 'thin' }}>
        {loading && prompts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: LM.textMuted, fontSize: 13 }}>Loading…</div>
        ) : prompts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: LM.textMuted, fontSize: 13 }}>No prompts yet this session.</div>
        ) : (
          <>
            {prompts.map((p) => (
              <PromptRow key={p.id} prompt={p} onRespond={onRespond} busyId={busyId} expanded={expanded} onToggle={(id) => setExpanded((e) => (e === id ? null : id))} />
            ))}
            {hasMore && (
              <button onClick={onLoadMore} style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', color: LM.cyan, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Load more
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${LM.border}`, flexShrink: 0 }}>
        <button onClick={onViewFullHistory} style={{
          width: '100%', padding: '11px 0', borderRadius: 10, background: LM.surface, border: `1px solid ${LM.borderStrong}`,
          color: LM.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          View Full History
        </button>
      </div>
    </aside>
  )
}
