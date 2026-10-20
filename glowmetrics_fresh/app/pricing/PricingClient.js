'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteFooter from '../components/SiteFooter'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/track'
import { PRO_MONTHLY_PRICE, PRO_ANNUAL_PRICE } from '../../lib/planLimits'
import styles from './pricing.module.css'

const annualSavings = (PRO_MONTHLY_PRICE * 12 - PRO_ANNUAL_PRICE).toFixed(2)
const savingsPercent = Math.round((1 - PRO_ANNUAL_PRICE / (PRO_MONTHLY_PRICE * 12)) * 100)
const freeFeatures = [
  'Detailed analytics for 1 selected platform, rolling 31 days',
  'Recent 31-day Platform Comparison across supported platforms',
  'Top 3 fans and basic fan insights',
  'Upload and store supported-platform history, including older data',
  'Locked advanced previews built from your real data',
  '2 Live Mode starts per UTC Monday–Sunday week',
  '30 active minutes per stream; paused time does not count',
]
const proFeatures = [
  'Full stored history across all supported platforms',
  'Complete fan leaderboard, searchable profiles and deeper CRM insights',
  'Stream Planner and Money Map',
  'Advanced timing and earning-pattern insights',
  'Full Platform Comparison and historical trends',
  'Advanced Live Mode recaps and unlimited Live Mode',
  'Paid/private-session analytics where supported',
  'Older stored data unlocked',
]
const comparisons = [
  ['Detailed analytics', '1 selected platform · rolling 31 days', '1 selected platform · rolling 31 days', 'All supported platforms · full stored history'],
  ['Platform Comparison', 'Recent 31-day slices', 'Recent 31-day slices', 'Full comparison and deeper history where supported'],
  ['Fan intelligence', 'Top 3 fans + basic insights', 'Basic insights + real-data upgrade previews', 'Complete leaderboard, searchable profiles + CRM intelligence'],
  ['Live Mode', '2 starts per UTC week · 30 active minutes each', '2 sessions total over 7 days · 30 active minutes each', 'Unlimited, subject to product safety and technical rules'],
  ['Stream Planner / Money Map', 'Locked; previews where available', 'Locked; previews where available', 'Full access'],
  ['Advanced insights', 'Locked teasers from real data', 'Real-data Pro previews', 'Full supported insights and advanced recaps'],
  ['Older history', 'Stored; detailed analytics capped at 31 days', 'Stored; detailed analytics capped at 31 days', 'Full stored history unlocked'],
]
const faqs = [
  ['Does Free delete my older history?', 'No. Upload and store supported-platform history for future unlock. Free shows detailed analytics for one selected platform over a rolling 31 days, plus recent Platform Comparison. Paid Pro unlocks the full stored history.'],
  ['What does the 7-day trial include?', 'Explore CamCash using your real streaming data: one selected analytics platform, a rolling 31-day window, and two Live Mode sessions total during the trial, up to 30 active minutes each. Paused time does not count. Full stored history, multi-platform detailed analytics and unlimited Live Mode unlock after the trial when your paid subscription is active.'],
  ['When will I be charged?', 'A card is required to start a trial. No charge today. After 7 days, your selected plan renews at $9.99/month or $99/year unless you cancel before the trial ends. Manage or cancel through your dashboard.'],
  ['How much does annual Pro save?', `Twelve monthly payments total $119.88. Annual Pro costs $99, saving $${annualSavings} per year (about ${savingsPercent}%). Both paid plans include the same features.`],
  ['Which platforms are supported?', 'CamCash supports Chaturbate, BongaCams and MyFreeCams. Feature availability, including private-session analytics, depends on the data supported by each platform.'],
  ['Is my analytics data private?', 'Your analytics are private to your account. CamCash does not sell your personal analytics data. See the Privacy Policy for details.'],
]

export default function PricingClient() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const viewed = useRef(false)

  useEffect(() => {
    if (!viewed.current) { track('pricing_page_viewed'); viewed.current = true }
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) { setUser(session?.user || null); setAuthReady(true) }
    }).catch(() => { if (mounted) setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) { setUser(session?.user || null); setAuthReady(true) }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function startTrial(planType) {
    if (loading) return
    track('pricing_plan_selected', { plan_type: planType })
    track(planType === 'standard_annual' ? 'pricing_annual_clicked' : 'pricing_monthly_clicked', { plan_type: planType })
    track('pricing_trial_clicked', { plan_type: planType })
    setLoading(planType)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push(`/landing?plan=${encodeURIComponent(planType)}`); return }
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan_type: planType }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to open checkout. Please try again.')
      window.location.assign(data.url)
    } catch (err) { setError(err.message || 'Unable to open checkout. Please try again.') }
    finally { setLoading(null) }
  }

  const dashboardOrSignup = user ? '/dashboard' : '/landing'
  return <div className={styles.page}>
    <header className={styles.nav}>
      <a className={styles.brand} href="/" aria-label="CamCash home">Cam<span>Cash</span><small>™</small></a>
      <a className={styles.navLink} href={dashboardOrSignup}>{user ? 'Back to Dashboard' : 'Create Free Account'} <span aria-hidden="true">↗</span></a>
    </header>
    <main>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>YOUR DATA. YOUR NEXT BEST MOVE.</p>
        <h1>Know what to stream.<br />Know who spends.<br /><span>Know when to go live.</span></h1>
        <p className={styles.lead}>CamCash turns your streaming history into clear decisions about earnings, fans, platforms, timing, and your next best move.</p>
        <p className={styles.tagline}>Start with Free. Unlock the full picture with Pro.</p>
        <a href="#plans" className={styles.textLink}>Find your plan <span aria-hidden="true">↓</span></a>
      </section>

      <section id="plans" className={styles.plans} aria-label="CamCash pricing plans">
        <article className={styles.card}>
          <p className={styles.badge}>A useful place to start</p>
          <h2>Free</h2><p className={styles.price}>$0<span>/ forever</span></p>
          <p className={styles.cardIntro}>Build your history. See what your last 31 days can tell you.</p>
          <a className={styles.secondaryButton} href={dashboardOrSignup} onClick={() => track('pricing_plan_selected', { plan_type: 'free' })}>{user ? 'Continue Free' : 'Start Free'}</a>
          <p className={styles.billing}>No card required.</p>
          <ul>{freeFeatures.map(feature => <li key={feature}>{feature}</li>)}</ul>
        </article>
        {[
          { id: 'standard_monthly', title: 'Pro Monthly', badge: 'Most Flexible', price: `$${PRO_MONTHLY_PRICE.toFixed(2)}`, period: '/ month', intro: 'Your full picture, with the flexibility of monthly billing.' },
          { id: 'standard_annual', title: 'Pro Annual', badge: `Best Value · Save ${savingsPercent}%`, price: `$${PRO_ANNUAL_PRICE}`, period: '/ year', intro: `Same paid Pro features. Save $${annualSavings} a year versus monthly.`, annual: true },
        ].map(plan => <article key={plan.id} className={`${styles.card} ${plan.annual ? styles.annualCard : ''}`}>
          <p className={`${styles.badge} ${plan.annual ? styles.valueBadge : ''}`}>{plan.badge}</p>
          <h2>{plan.title}</h2><p className={styles.price}>{plan.price}<span>{plan.period}</span></p>
          <p className={styles.cardIntro}>{plan.intro}</p>
          <button className={plan.annual ? styles.primaryButton : styles.secondaryButton} onClick={() => startTrial(plan.id)} disabled={!authReady || loading !== null} aria-label={`Start 7-Day Trial — ${plan.title}`}>
            {loading === plan.id ? 'Opening checkout…' : 'Start 7-Day Trial'}
          </button>
          <p className={styles.billing}>Then {plan.price}{plan.period}. Card required.</p>
          <p className={styles.paidLabel}>When your paid Pro subscription is active:</p>
          <ul>{proFeatures.map(feature => <li key={feature}>{feature}</li>)}</ul>
        </article>)}
      </section>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section id="trial" className={styles.trial} aria-labelledby="trial-title">
        <div><p className={styles.eyebrow}>TRY CAMCASH PRO FOR 7 DAYS</p><h2 id="trial-title">See what your real data can uncover.</h2>
          <p>The trial includes <strong>1 selected analytics platform, rolling 31 days, and 2 Live Mode sessions total</strong> across the entire trial, up to <strong>30 active minutes each</strong>. Paused time does not count. Explore available real-data previews before committing.</p>
          <p>After the trial, paid Pro unlocks multi-platform detailed analytics, full stored history and unlimited Live Mode.</p>
        </div>
        <p className={styles.terms}>No charge today. Cancel before the trial ends to avoid a charge. Starting a trial means agreeing to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>. Your selected plan renews at $9.99/month or $99/year.</p>
      </section>

      <section className={styles.comparison} aria-labelledby="comparison-title">
        <p className={styles.eyebrow}>WHAT CHANGES WHEN YOU UPGRADE</p>
        <h2 id="comparison-title">The data stays. The picture gets bigger.</h2>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Plan comparison, scroll horizontally on small screens">
          <table><caption>Free, 7-day trial and active paid Pro features</caption>
            <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">7-Day Trial</th><th scope="col">Paid Pro</th></tr></thead>
            <tbody>{comparisons.map(([feature, ...values]) => <tr key={feature}><th scope="row">{feature}</th>{values.map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className={styles.unlock}>
        <p className={styles.eyebrow}>YOU’VE BUILT THE DATA. UNLOCK THE PATTERNS.</p>
        <h2>Your older uploads stay here.<br />Pro unlocks the full history.</h2>
        <p>Compare the last 31 days for free. Reveal deeper fan, timing and earning patterns from your stored history with paid Pro.</p>
        <a href="#plans" className={styles.textLink}>Explore Pro plans <span aria-hidden="true">↗</span></a>
      </section>
      <section className={styles.faq} aria-labelledby="faq-title"><h2 id="faq-title">A few things worth knowing.</h2>
        {faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
      <section className={styles.finalCta}><h2>Start with your next best move.</h2><p>Useful for free. A fuller picture when you’re ready.</p><a className={styles.primaryButton} href={dashboardOrSignup}>{user ? 'Go to Dashboard' : 'Start Free'}</a></section>
    </main>
    <SiteFooter />
  </div>
}
