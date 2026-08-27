'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — THE FIRST AHA
//
// The moment a creator should think "it actually found something about MY cam
// business". Extracted from app/onboarding/page.js so it renders without a
// Supabase client, which makes it verifiable in the render suite rather than
// only assertable as source text.
//
// It reads the canonical intelligence layer — the same one the dashboard reads
// — and states a pattern ONLY when the ladder says it is claimable. The screen
// this replaced rendered preview.bestHour: the single highest token-sum hour in
// the rows just parsed, with no minimum sample and no confidence tier, which on
// a small first import is one or two rows presented as a finding.
//
// It fabricates nothing and shows no staged progress. When there is no finding
// yet it says so and names the evidence that is missing.
// ═══════════════════════════════════════════════════════════════════════════

const CYAN = '#16F4FF'
const PINK = '#FF2BAE'
const GRAD = 'linear-gradient(90deg,#16F4FF 0%,#7C5CFF 48%,#FF2BAE 100%)'

/**
 * @param {Object}   props
 * @param {Object}  [props.discovery] - the strongest canonical discovery
 * @param {number}  [props.fanCount]  - repeat fans in the window
 * @param {number}  [props.topSupporters]
 * @param {boolean} [props.loading]
 */
export default function OnboardingAha({
  discovery = null, fanCount = 0, topSupporters = 0, loading = false,
}) {
  if (loading) {
    return (
      <div style={shell}>
        <div style={{ fontSize: 12.5, color: 'rgba(148,163,184,0.85)' }}>Reading your history…</div>
      </div>
    )
  }

  // Nothing the engine will stand behind yet — said plainly, with the real
  // next step rather than a softened claim.
  if (!discovery || !discovery.claimable) {
    return (
      <div style={shell}>
        <div style={label}>{discovery ? 'Still calibrating' : 'Your data is in'}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(203,213,225,0.88)', lineHeight: 1.65 }}>
          {discovery
            ? discovery.meaning
            : 'No pattern has enough evidence behind it yet — import more of your history and CamCash will tell you the moment one does.'}
        </div>
        {discovery?.nextMilestone && (
          <div style={{ marginTop: 9, fontSize: 12, color: CYAN }}>Next: {discovery.nextMilestone}.</div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      ...shell,
      border: '1px solid rgba(124,92,255,0.30)',
      background: 'linear-gradient(140deg,rgba(124,92,255,0.11),rgba(22,244,255,0.05))',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRAD }} />
      <div style={label}>{discovery.eyebrow}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 12 }}>
        {discovery.title}
      </div>

      <div style={{ display: 'flex', gap: 17, flexWrap: 'wrap', marginBottom: 12 }}>
        {(discovery.evidence || []).slice(0, 3).map(e => (
          <div key={e.label}>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: CYAN }}>{e.value}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.72)', marginTop: 2 }}>{e.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: 'rgba(203,213,225,0.9)', lineHeight: 1.65 }}>
        {discovery.meaning}
      </div>

      {fanCount > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(203,213,225,0.88)', lineHeight: 1.6 }}>
          <strong style={{ color: PINK }}>{fanCount} repeat fan{fanCount === 1 ? '' : 's'}</strong> tipped during it
          {topSupporters > 0 ? ` — ${topSupporters} ${topSupporters === 1 ? 'is' : 'are'} among your Top Supporters` : ''}.
        </div>
      )}

      {discovery.action && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#fff', lineHeight: 1.55 }}>
          <strong style={{ color: '#A78BFA' }}>Your next move · </strong>{discovery.action.label}.
        </div>
      )}
    </div>
  )
}

const shell = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(13,17,38,0.72)',
  padding: '16px 16px',
  marginBottom: 14,
  textAlign: 'left',
}

const label = {
  fontSize: 10,
  fontWeight: 800,
  color: CYAN,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  marginBottom: 7,
}
