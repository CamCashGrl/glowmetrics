'use client';

// Live Mode Preview — an interactive, fully local simulation of a real
// stream. Visual language mirrors the real /live page (same color tokens,
// card style, stat labels) since that's the canonical Live Mode surface,
// but every value here comes from usePreviewEngine — a local-only
// reducer. This page never imports supabase, useLiveSessionEngine, or any
// /api/live/* route (enforced by scripts/verify-preview-isolation.mjs).

import { useState } from 'react';
import Link from 'next/link';
import Button from '../../../components/ui/Button';
import { usePreviewEngine } from '../../../lib/livePreview/usePreviewEngine';
import { SCENARIOS, SCENARIO_ORDER } from '../../../lib/livePreview/scenarios';

const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
};

const glassCard = {
  background: 'rgba(15,20,32,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
};

const LEVEL_STYLE = {
  critical: { bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.38)', badge: 'rgba(248,113,113,0.22)', badgeText: C.red, tag: '🚨 CRITICAL ACTION' },
  warning: { bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.38)', badge: 'rgba(245,158,11,0.22)', badgeText: C.gold, tag: '⚠️ ALERT' },
  success: { bg: 'rgba(16,185,129,0.09)', border: 'rgba(16,185,129,0.38)', badge: 'rgba(16,185,129,0.22)', badgeText: C.green, tag: '🔥 MOMENTUM' },
  info: { bg: 'rgba(34,211,238,0.09)', border: 'rgba(34,211,238,0.38)', badge: 'rgba(34,211,238,0.22)', badgeText: C.cyan, tag: '💡 INSIGHT' },
};

function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export default function LiveModePreviewPage() {
  const p = usePreviewEngine();
  const [setupExpanded, setSetupExpanded] = useState(false);

  const activeStyle = p.activePrompt ? (LEVEL_STYLE[p.activePrompt.level] || LEVEL_STYLE.info) : null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui', color: C.white }}>
      <style>{`
        @keyframes cc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes cc-slide { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
            CamCash
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.purple, letterSpacing: 1 }}>PREVIEW MODE</span>
          </div>
        </div>
        <Link href="/live" style={{ padding: '7px 14px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 8, color: C.cyan, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
          Go to real Live Mode →
        </Link>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HEADER + DISCLAIMER ── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 4 }}>Preview Live Mode</div>
          <div style={{ fontSize: 13, color: C.text }}>Explore an example stream without connecting the extension or recording real data.</div>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <span style={{ fontSize: 12, color: C.purple, fontWeight: 700 }}>Example preview data — nothing is being recorded.</span>
          </div>
        </div>

        {/* ── COMPACT SETUP STRIP ── */}
        <div style={{ ...glassCard, borderRadius: 14, padding: '14px 18px', marginBottom: 18 }}>
          <button onClick={() => setSetupExpanded((e) => !e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', color: C.white, cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>How real Live Mode connects (1. Download → 2. Extract → 3. Load unpacked)</span>
            <span style={{ fontSize: 12, color: C.muted }}>{setupExpanded ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
          {setupExpanded && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
              {[
                { n: 1, title: 'Download the extension ZIP', body: 'Get camcash-extension.zip from the real Live Mode page.' },
                { n: 2, title: 'Extract the ZIP', body: 'Unzip it into its own folder.' },
                { n: 3, title: 'Load it in your browser', body: 'chrome://extensions → Developer mode → Load unpacked.' },
              ].map((s) => (
                <div key={s.n} style={{ flex: '1 1 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.35)', color: C.cyan, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{s.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{s.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SESSION BOUNDARY LESSON ── */}
        <div style={{ ...glassCard, borderRadius: 14, padding: '14px 18px', marginBottom: 18, border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
            {p.status === 'ended'
              ? 'Stop Live Mode when your broadcast ends so your duration and hourly calculations remain accurate.'
              : 'Start Live Mode when you begin broadcasting. CamCash measures your session from the moment you press Start until you press Stop.'}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Example: a 1-hour broadcast left running for 3 hours after you stop streaming reports 3 hours of duration — cutting your real hourly rate to a third of what you actually earned. Always press Stop when you go offline.
          </div>
        </div>

        {/* ── SIMULATED STATUS BAR ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'running' ? C.green : '#374151', boxShadow: p.status === 'running' ? `0 0 5px ${C.green}` : 'none' }} />
              <span style={{ fontSize: 11, color: C.muted }}>Connection</span>
              <span style={{ fontSize: 11, color: p.status === 'running' ? C.green : '#475569', fontWeight: 600 }}>{p.status === 'running' ? 'Heartbeat connected (example)' : p.status === 'ended' ? 'Session ended' : 'Not started'}</span>
            </div>
            {p.status === 'running' && (
              <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>Duration: {fmtDuration(p.elapsedSeconds)}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.status === 'idle' && (
              <Button onClick={p.start} style={{ padding: '7px 18px', fontSize: 12 }}>▶ Start simulated stream</Button>
            )}
            {p.status === 'running' && (
              <>
                <button onClick={p.togglePlay} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {p.playAuto ? '⏸ Pause sequence' : '▶ Play sequence'}
                </button>
                <button onClick={p.advance} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Advance ▶
                </button>
                <button onClick={p.stop} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  ⏹ Stop simulated stream
                </button>
              </>
            )}
            {p.status === 'ended' && (
              <button onClick={p.restart} style={{ padding: '7px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #22D3EE)', border: 'none', color: C.white, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                ↻ Restart preview
              </button>
            )}
          </div>
        </div>

        {(p.status === 'running' || p.status === 'ended') && (
          <>
            {/* ── SCENARIO SELECTOR ── */}
            {p.status === 'running' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {SCENARIO_ORDER.map((id) => {
                  const s = SCENARIOS[id];
                  const active = p.currentScenarioId === id;
                  return (
                    <button key={id} onClick={() => p.setScenario(id)}
                      style={{ padding: '7px 14px', borderRadius: 8, background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)', color: active ? C.purple : C.text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── SESSION PULSE ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Duration', value: fmtDuration(p.elapsedSeconds), color: C.text },
                { label: 'Current earnings', value: `$${p.totalUsd.toFixed(2)}`, color: C.green },
                { label: 'Tips', value: String(p.tipCount), color: C.cyan },
                { label: 'Unique tippers', value: String(p.uniqueTippers), color: C.gold },
                { label: 'Current pace', value: p.elapsedSeconds < 30 ? 'Calculating…' : `$${p.paceUsdPerHour.toFixed(2)}/hr`, color: p.elapsedSeconds < 30 ? C.muted : (p.paceUsdPerHour > 0 ? C.green : C.muted) },
                { label: 'Goal progress', value: `${p.goalProgress}% of ${p.goalTokens}t`, color: C.purple },
                { label: 'Last activity', value: p.secondsSinceActivity === null ? '—' : `${p.secondsSinceActivity}s ago`, color: C.text },
              ].map((m) => (
                <div key={m.label} style={{ ...glassCard, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 18, marginTop: -8 }}>Example preview data — nothing is being recorded.</div>

            {/* ── ACTIVE COACHING PROMPT ── */}
            {p.activePrompt ? (
              <div style={{ borderRadius: 16, padding: '20px 22px', marginBottom: 18, background: activeStyle.bg, border: `1px solid ${activeStyle.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.activePrompt.icon}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 6, background: activeStyle.badge, fontSize: 10, fontWeight: 800, color: activeStyle.badgeText, letterSpacing: 0.8, textTransform: 'uppercase' }}>{activeStyle.tag}</span>
                  <span style={{ fontSize: 10, color: C.dim }}>Example prompt</span>
                </div>
                <div style={{ fontSize: 13, color: activeStyle.badgeText, opacity: 0.9, marginBottom: 6, fontWeight: 600 }}>{p.activePrompt.title}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 14 }}>{p.activePrompt.compactMessage}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => p.respondActive('performed')} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    ✓ Performed
                  </button>
                  <button onClick={() => p.respondActive('skipped')} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Skip
                  </button>
                </div>
              </div>
            ) : p.status === 'running' && (
              <div style={{ ...glassCard, borderRadius: 16, padding: '18px 22px', marginBottom: 18, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                No active prompt — pick a scenario above to see one appear.
              </div>
            )}

            {/* ── TIP FEED + COACHING HISTORY ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 18 }}>
              <div style={{ ...glassCard, borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Live Activity (example)</div>
                {p.tips.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No tips yet — pick a scenario to see example tips arrive.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {p.tips.map((t) => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'cc-slide 0.3s ease' }}>
                        <span style={{ fontSize: 12, color: C.text }}>{t.username}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>${t.usd.toFixed(2)} <span style={{ color: C.muted, fontWeight: 400 }}>({t.tokens}t)</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...glassCard, borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Coaching History (example)</span>
                  <span style={{ fontSize: 10, color: C.dim }}>{p.history.length}</span>
                </div>
                {p.history.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Answered prompts will appear here.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {p.history.map((h) => (
                      <div key={h.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 12, color: C.white, fontWeight: 600, marginBottom: 6 }}>{h.compactMessage}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: h.status === 'performed' ? 'rgba(16,185,129,0.15)' : h.status === 'skipped' ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.12)', color: h.status === 'performed' ? C.green : h.status === 'skipped' ? C.muted : C.gold, fontWeight: 700 }}>
                            {h.status === 'performed' ? '✓ Performed' : h.status === 'skipped' ? 'Skipped' : 'Unmarked'}
                          </span>
                          <button onClick={() => p.changeHistoryResponse(h.id, h.status === 'performed' ? 'skipped' : 'performed')} style={{ fontSize: 10, color: C.cyan, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Change response
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── END STATE ── */}
            {p.status === 'ended' && (
              <div style={{ ...glassCard, borderRadius: 16, padding: '20px 22px', marginBottom: 18, border: '1px solid rgba(34,211,238,0.3)' }}>
                <div style={{ fontSize: 12, color: C.cyan, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, marginBottom: 8 }}>Example session ended</div>
                <div style={{ fontSize: 14, color: C.white, fontWeight: 700 }}>✅ Session ended — active time {fmtDuration(p.elapsedSeconds)}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>This is the same minimal confirmation the real Live Mode page shows today — nothing more elaborate is built yet.</div>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Link href="/live" style={{ textDecoration: 'none' }}>
            <Button style={{ padding: '12px 32px', fontSize: 14 }}>Start a real Live Mode session →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
