'use client'
import { track as canonicalTrack } from './track'

const fired = new Set()

// This module used to push straight to window.dataLayer and stop there, so
// every event defined in T below — the whole landing/signup funnel, the CSV
// upload events, paywall_viewed, upgrade_clicked — reached GA4 but was NEVER
// written to Supabase via /api/track.
//
// It now delegates to lib/track.js, which is the single analytics path. The
// gtag() call that used to sit alongside was removed together with the rest
// of the Google Tag config; window.gtag is no longer defined anywhere.
export function track(event, params = {}) {
  try {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'development') {
      console.log('[Track]', event, params)
    }
    canonicalTrack(event, params)
  } catch (e) {}
}

export function trackOnce(event, params = {}) {
  if (fired.has(event)) return
  fired.add(event)
  track(event, params)
}

export function getSource() {
  if (typeof window === 'undefined') return 'direct'
  const p = new URLSearchParams(window.location.search)
  return p.get('utm_source') ||
    (document.referrer
      ? (() => { try { return new URL(document.referrer).hostname } catch { return 'referral' } })()
      : 'direct')
}

export const T = {
  signupCtaClicked:      (page)          => track('signup_cta_clicked',       { page_path: page, traffic_source: getSource() }),
  // Fired when the visitor FOCUSES the email field — intent to type, not an
  // attempted signup. It was named 'signup_started', colliding with the
  // track('signup_started') the landing pages fire on form SUBMIT: one event
  // name for two different moments, so the funnel counted a click into the
  // input as an attempt. Renamed; 'signup_started' now means submit only.
  signupFormFocused:     (page)          => trackOnce('signup_form_focused',   { source_page: page, traffic_source: getSource() }),
  // Enriches the canonical 'signup_success' event rather than emitting a
  // second name for the same moment. The landing pages previously fired
  // track('signup_success') and T.signupCompleted() on one line, which would
  // double-count every signup now that both reach /api/track.
  signupCompleted:       (page)          => track('signup_success',            { signup_method: 'email', source_page: page, traffic_source: getSource() }),
  csvUploadStarted:      ()              => trackOnce('csv_upload_started',    { file_type: 'csv' }),
  csvUploadCompleted:    (rows, ms)      => track('csv_upload_completed',      { file_type: 'csv', rows_imported: rows || 0, import_duration: ms || 0 }),
  csvUploadFailed:       (err)           => track('csv_upload_failed',         { error_type: err || 'unknown' }),
  extensionInstallStart: ()              => trackOnce('extension_install_started', { browser: 'chrome' }),
  dashboardFirstView:    (method, plat)  => trackOnce('dashboard_first_view', { onboarding_method: method, platform: plat }),
  dashboardPopulated:    (plat, count)   => trackOnce('dashboard_populated',  { platform: plat, earnings_records_count: count }),
  dashboardSession:      (platCount)     => trackOnce('dashboard_session_started', { platform_count: platCount }),
  paywallViewed:         (feature)       => track('paywall_viewed',            { feature_name: feature }),
  upgradeClicked:        (feature)       => track('upgrade_clicked',           { feature_name: feature }),
}

export function captureAttribution() {
  try {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('camcash_attribution')) return // first touch wins
    const p = new URLSearchParams(window.location.search)
    const utm_source   = p.get('utm_source')   || null
    const utm_medium   = p.get('utm_medium')   || null
    const utm_campaign = p.get('utm_campaign') || null
    const utm_content  = p.get('utm_content')  || null
    const utm_term     = p.get('utm_term')     || null
    const ref = document.referrer || null
    localStorage.setItem('camcash_attribution', JSON.stringify({
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      referrer: ref,
      landing_page: window.location.pathname,
      captured_at: new Date().toISOString(),
    }))
  } catch {}
}

export default T
