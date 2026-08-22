'use client'
// ============================================================
// CAMCASH — ONBOARDING CONVERSION
//
// Two components, both shared so onboarding does not grow its own upgrade
// system. Onboarding already had one (ProUpsellModal), and it had drifted into
// saying things that are not true — that multi-platform is a Pro feature, when
// Free supports three, in a modal that then told the creator to "continue with
// up to 3 platforms" four lines later.
//
// WHY THE UPGRADE MOMENT COMES AFTER THE IMPORT
// A plan-selection screen shown BEFORE the creator has seen their own data is
// asking them to value a product they have not experienced. The same ask, made
// ten seconds later against "$462.12 of your earnings history is already here",
// is a completely different proposition — the number is theirs, it is real, and
// they just watched us find it. So the strong moment is placed after the first
// import, and the plan comparison is offered there rather than as a gate in
// front of the funnel.
//
// Nothing here computes anything. Both components render figures measured by
// app/api/upload/route.js from the real uploaded file, and render NOTHING when
// there is no measured value — silence is correct when we have no argument.
// ============================================================

import { UnlockButton } from '../../app/dashboard/components/LockedModule'
import { PRO_PRICE_MONTHLY_LABEL, PRO_PRICE_NOTE } from '../../lib/constants'
import { FREE_MAX_PLATFORMS, FREE_HISTORY_DAYS } from '../../lib/planLimits'

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtInt = (n) => Number(n || 0).toLocaleString()

/**
 * The post-import upgrade moment (PART 14).
 *
 * Renders only when the creator's own upload contains locked value. No locked
 * value means no card — never a generic "upgrade!" prompt to fill the space.
 */
export function UpgradeMoment({ locked, onUpgrade, onContinueFree }) {
  const usd = Number(locked?.totalUsd || 0)
  const tips = Number(locked?.tips || 0)
  if (!(tips > 0)) return null

  return (
    <section className="cc-moment" data-cc-surface="onboarding_locked_history">
      <div className="cc-moment-eyebrow">We found more in your data</div>

      {usd > 0 ? (
        <>
          <div className="cc-moment-amount">{fmtUsd(usd)}</div>
          <div className="cc-moment-label">of additional history is available to analyze</div>
        </>
      ) : (
        <>
          <div className="cc-moment-amount">{fmtInt(tips)}</div>
          <div className="cc-moment-label">more tips are available to analyze</div>
        </>
      )}

      <p className="cc-moment-body">
        You already uploaded it and it&apos;s saved to your account. Free analyzes your most
        recent {FREE_HISTORY_DAYS} days per platform — Pro unlocks the rest instantly,
        with no re-upload.
      </p>

      <div className="cc-moment-actions">
        <UnlockButton surface="onboarding_locked_history" size="lg" onClick={onUpgrade}>
          Unlock Pro
        </UnlockButton>
        <button type="button" className="cc-moment-secondary" onClick={onContinueFree}>
          Continue with Free
        </button>
      </div>
      <div className="cc-moment-price">{PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}</div>
    </section>
  )
}

/**
 * Honest Free/Pro comparison (PART 13).
 *
 * Pro is visually stronger, but Free is described accurately and generously —
 * three platforms, a rolling window, full CSV uploads, stored history. Framing
 * Free as a crippled trial is what produces churn and refunds; it also happens
 * to be false here, since Free is a genuinely useful product.
 */
export function PlanComparison({ onChooseFree, onChoosePro, compact = false }) {
  const FREE = [
    `${FREE_MAX_PLATFORMS} supported platforms`,
    `${FREE_HISTORY_DAYS}-day rolling analytics, per platform`,
    'Full CSV imports — upload any date range',
    'Your older history stored, never deleted',
    'Core dashboard and fan tracking',
  ]
  const PRO = [
    'Everything in Free',
    'Full historical analytics on everything you have imported',
    'Additional platforms beyond your Free slots',
    'Advanced earning insights and session intelligence',
    'Deeper fan intelligence',
    'Cross-platform comparison',
    'Live coaching',
  ]

  return (
    <div className={`cc-plans${compact ? ' cc-plans--compact' : ''}`}>
      <div className="cc-plan">
        <div className="cc-plan-name">Free</div>
        <div className="cc-plan-price">$0<span>/month</span></div>
        <ul className="cc-plan-list">
          {FREE.map(f => <li key={f}><span aria-hidden="true">✓</span>{f}</li>)}
        </ul>
        <button type="button" className="cc-plan-btn cc-plan-btn--free" onClick={onChooseFree}>
          Start Free
        </button>
      </div>

      <div className="cc-plan cc-plan--pro">
        <div className="cc-plan-badge">Recommended</div>
        <div className="cc-plan-name cc-plan-name--pro">Creator Pro</div>
        <div className="cc-plan-price">
          {PRO_PRICE_MONTHLY_LABEL.replace('/mo', '')}<span>/month</span>
        </div>
        <ul className="cc-plan-list">
          {PRO.map(f => <li key={f}><span aria-hidden="true">✓</span>{f}</li>)}
        </ul>
        <UnlockButton surface="plan_comparison" onClick={onChoosePro} style={{ width: '100%' }}>
          Start Pro
        </UnlockButton>
        <div className="cc-plan-note">{PRO_PRICE_NOTE}</div>
      </div>
    </div>
  )
}
