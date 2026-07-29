'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { TRIGGER_LEVEL } from '../../lib/coaching/triggers';
import { dedupeById } from '../../lib/coaching/history';

const C = {
  border: 'rgba(255,255,255,0.08)', white: '#f1f5f9', muted: '#94a3b8',
  dim: '#475569', text: '#e2e8f0', green: '#10b981', red: '#f87171', cyan: '#22d3ee',
};

const LEVEL_BADGE = {
  critical: { bg: 'rgba(248,113,113,0.18)', text: '#f87171' },
  warning:  { bg: 'rgba(245,158,11,0.18)',  text: '#f59e0b' },
  success:  { bg: 'rgba(16,185,129,0.18)',  text: '#10b981' },
  info:     { bg: 'rgba(34,211,238,0.18)',  text: '#22d3ee' },
};

const STATUS_BADGE = {
  performed: { bg: 'rgba(16,185,129,0.18)', text: '#10b981', label: '✓ Performed' },
  skipped:   { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8', label: 'Skipped' },
};

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return '1 hour ago';
  return `${hrs} hours ago`;
}

const HistoryItem = memo(function HistoryItem({ prompt, onRespond, pending }) {
  const level = TRIGGER_LEVEL[prompt.type] || 'info';
  const levelBadge = LEVEL_BADGE[level] || LEVEL_BADGE.info;
  const statusBadge = prompt.action_status !== 'unmarked' ? STATUS_BADGE[prompt.action_status] : null;

  return (
    <li
      role="listitem"
      style={{
        padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${C.border}`, marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', background: levelBadge.bg, color: levelBadge.text }}>
          {prompt.category?.replace(/_/g, ' ') || prompt.type}
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>Shown {relativeTime(prompt.shown_at)}</span>
        {statusBadge && (
          <span aria-label={`Response: ${statusBadge.label}`} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, background: statusBadge.bg, color: statusBadge.text }}>
            {statusBadge.label}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 3 }}>{prompt.title}</div>
      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>{prompt.message}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {prompt.action_status === 'unmarked' ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => onRespond(prompt.id, 'performed')}
              style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: C.green, fontWeight: 700, fontSize: 11.5, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}
            >
              Performed
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onRespond(prompt.id, 'skipped')}
              style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.muted, fontWeight: 700, fontSize: 11.5, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}
            >
              Skipped
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRespond(prompt.id, prompt.action_status === 'performed' ? 'skipped' : 'performed')}
            style={{ padding: '4px 10px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: C.dim, fontWeight: 600, fontSize: 11, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}
          >
            Change response
          </button>
        )}
      </div>
    </li>
  );
});

// Compact, scrollable Coaching History card for the Live Mode page.
// Fetches only this session's coaching_events (never cross-session), lets
// the creator record/change Performed/Skipped, and persists immediately
// server-side — the active prompt in the AI Coach centerpiece stays the
// single source of truth for "what's active now"; this feed is strictly
// "what happened earlier."
export default function CoachingHistory({ sessionId, activePromptId, hasActiveSession }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [prompts, setPrompts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimeout = useRef(null);

  const fetchHistory = useCallback(async ({ before } = {}) => {
    if (!hasActiveSession) { setStatus('ready'); setPrompts([]); setHasMore(false); return; }
    try {
      const url = before ? `/api/live/coaching/history?before=${encodeURIComponent(before)}` : '/api/live/coaching/history';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { setStatus((prev) => (prev === 'loading' ? 'error' : prev)); return; }
      const data = await res.json();
      setStatus('ready');
      setHasMore(!!data.hasMore);
      setPrompts((prev) => dedupeById(before ? [...prev, ...(data.prompts || [])] : (data.prompts || [])));
    } catch (_) {
      setStatus((prev) => (prev === 'loading' ? 'error' : prev));
    }
  }, [hasActiveSession]);

  useEffect(() => {
    setStatus('loading');
    setPrompts([]);
    setHasMore(false);
    fetchHistory();
  }, [sessionId, fetchHistory]);

  // A new active prompt appearing is the signal that a new coaching_events
  // row was just created — refresh so it's picked up once it's no longer
  // the primary active prompt. This never touches the heartbeat or session
  // poll intervals; it's an independent, non-blocking fetch.
  useEffect(() => {
    if (hasActiveSession) fetchHistory();
  }, [activePromptId, hasActiveSession, fetchHistory]);

  const handleRespond = useCallback(async (eventId, newStatus) => {
    const previous = prompts;
    setPendingId(eventId);
    setPrompts((prev) => prev.map((p) => (p.id === eventId ? { ...p, action_status: newStatus, action_responded_at: new Date().toISOString() } : p)));
    try {
      const res = await fetch('/api/live/coaching/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status: newStatus }),
      });
      if (!res.ok) { setPrompts(previous); setStatus('respond_error'); setTimeout(() => setStatus('ready'), 4000); return; }
      const data = await res.json();
      if (data.event?.action_status) {
        setPrompts((prev) => prev.map((p) => (p.id === eventId ? { ...p, action_status: data.event.action_status, action_responded_at: data.event.action_responded_at } : p)));
      }
      setSavedFlash(true);
      clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setSavedFlash(false), 1600);
    } catch (_) {
      setPrompts(previous);
      setStatus('respond_error');
      setTimeout(() => setStatus('ready'), 4000);
    } finally {
      setPendingId(null);
    }
  }, [prompts]);

  useEffect(() => () => clearTimeout(flashTimeout.current), []);

  // The current active prompt (still unmarked/still shown in the AI Coach
  // centerpiece) is excluded here so it never renders twice — once it's
  // answered or replaced, the next fetch picks it up like any other row.
  const visiblePrompts = prompts.filter((p) => p.id !== activePromptId || p.action_status !== 'unmarked');

  return (
    <div style={{
      borderRadius: 16, padding: '20px 22px', marginBottom: 20,
      background: 'rgba(15,20,32,0.6)', border: `1px solid ${C.border}`,
    }}>
      <style jsx>{`
        .cc-history-scroll { max-height: 360px; }
        @media (max-width: 640px) {
          .cc-history-scroll { max-height: 300px; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: 0 }}>Coaching History</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {savedFlash && <span style={{ fontSize: 11, color: C.green }}>Saved</span>}
          <span style={{ fontSize: 11, color: C.dim }}>{prompts.length} prompt{prompts.length === 1 ? '' : 's'} this session</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
        Review coaching suggestions from this session and record whether you used them.
      </p>

      {status === 'respond_error' && (
        <div role="alert" style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>
          We could not update this coaching response. Please try again.
        </div>
      )}

      {!hasActiveSession && (
        <div style={{ fontSize: 12.5, color: C.dim, padding: '18px 4px' }}>
          Coaching history appears during a Live Mode session. Start streaming to begin collecting suggestions here.
        </div>
      )}

      {hasActiveSession && status === 'loading' && (
        <div style={{ fontSize: 12.5, color: C.muted, padding: '18px 4px' }}>Loading coaching history…</div>
      )}

      {hasActiveSession && status === 'error' && (
        <div role="alert" style={{ fontSize: 12.5, color: C.red, padding: '18px 4px' }}>
          We could not load coaching history. It will retry automatically.
        </div>
      )}

      {hasActiveSession && (status === 'ready' || status === 'respond_error') && visiblePrompts.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.dim, padding: '18px 4px' }}>
          No coaching prompts yet. Suggestions that appear during this session will be saved here so you can review and respond to them.
        </div>
      )}

      {hasActiveSession && (status === 'ready' || status === 'respond_error') && visiblePrompts.length > 0 && (
        <>
          <ul
            className="cc-history-scroll"
            tabIndex={0}
            aria-label="Coaching history, scrollable"
            style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', paddingRight: 4 }}
          >
            {visiblePrompts.map((prompt) => (
              <HistoryItem key={prompt.id} prompt={prompt} onRespond={handleRespond} pending={pendingId === prompt.id} />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                const oldest = prompts[prompts.length - 1];
                await fetchHistory({ before: oldest?.shown_at });
                setLoadingMore(false);
              }}
              style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.cyan, fontWeight: 700, fontSize: 11.5, cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore ? 'Loading…' : 'Load earlier prompts'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
