'use client';

import { useEffect, useRef, useState } from 'react';

// Shared "Coaching Prompts" feed — used identically on the public /live page
// and the dashboard's Live Mode tab. Reads the same coaching_events history
// both surfaces already write to (via GET /api/live/coaching/history) and
// lets the user mark any still-unanswered prompt as Completed or Skipped
// through the same respond_to_coaching_event RPC the main prompt card
// already uses (POST /api/live/coaching/respond) — this is the one place
// that response can come from for a given prompt, same invariant as the
// primary prompt card and the extension overlay.
//
// Deliberately self-contained: does its own polling and its own respond
// calls, so dropping it into any page only requires an `active` flag —
// no prop-drilling of session state, no risk of a second, disagreeing copy
// of this history existing anywhere.
//
// This is also the first piece of "which prompts actually get acted on"
// tracking — action_status + action_responded_at are already persisted per
// prompt; this UI is what makes a user's response to any past prompt (not
// just the currently-active one) actually reach the database.

const TRIGGER_ICON = {
  dead_air_critical: '🚨', dead_air_high: '⚠️', pace_below: '📉', pace_above: '🔥',
  stream_fatigue: '😴', goal_push: '🎯', goal_hit: '🎉', whale_prox: '🐋', whale_dep: '🐳',
};

const C = {
  muted: '#94a3b8', text: '#e2e8f0', dim: '#475569',
  green: '#10b981', red: '#f87171',
};

function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function CoachingPromptFeed({ active }) {
  const [prompts, setPrompts] = useState([]);
  const respondingRef = useRef(new Set());
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!active) { setPrompts([]); return; }
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/live/coaching/history', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setPrompts(data.prompts || []);
      } catch (_) { /* one failed poll is never surfaced — the next tick retries */ }
    };

    fetchHistory();
    const id = setInterval(fetchHistory, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [active]);

  const respond = async (eventId, status) => {
    if (respondingRef.current.has(eventId)) return;
    respondingRef.current.add(eventId);
    forceRender((n) => n + 1);

    // Optimistic update — rolled back on failure, matching the same pattern
    // the primary prompt card already uses.
    const previous = prompts;
    setPrompts((prev) => prev.map((p) => (p.id === eventId ? { ...p, action_status: status } : p)));

    try {
      const res = await fetch('/api/live/coaching/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status }),
      });
      if (!res.ok) setPrompts(previous);
    } catch (_) {
      setPrompts(previous);
    } finally {
      respondingRef.current.delete(eventId);
      forceRender((n) => n + 1);
    }
  };

  if (!active || prompts.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(15,20,32,0.75)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 18, backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>
        🎯 Coaching Prompts
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {prompts.map((p) => {
          const isPending = respondingRef.current.has(p.id);
          const answered = p.action_status === 'performed' || p.action_status === 'skipped';
          return (
            <div key={p.id} style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: '7px 9px',
              borderRadius: 8, background: 'rgba(255,255,255,0.03)',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{TRIGGER_ICON[p.type] || 'ℹ️'}</span>
              <span style={{ fontSize: 11.5, color: C.text, flex: 1, lineHeight: 1.4 }}>
                {p.compact_message || p.message}
              </span>
              <span style={{ fontSize: 9, color: C.dim, whiteSpace: 'nowrap' }}>{timeAgo(p.shown_at)}</span>
              {answered ? (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                  color: p.action_status === 'performed' ? C.green : C.muted,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {p.action_status === 'performed' ? '✓ Done' : 'Skipped'}
                </span>
              ) : (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => respond(p.id, 'performed')}
                    disabled={isPending}
                    style={{
                      fontSize: 9, fontWeight: 700, padding: '4px 7px', borderRadius: 6,
                      background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)',
                      color: C.green, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => respond(p.id, 'skipped')}
                    disabled={isPending}
                    style={{
                      fontSize: 9, fontWeight: 700, padding: '4px 7px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                      color: C.muted, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
