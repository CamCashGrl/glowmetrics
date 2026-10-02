import { NextResponse } from 'next/server'

// Cron endpoint — never statically optimize this (see the same note in
// app/api/cron/expire-goodwill-trials/route.js).
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const origin = new URL(req.url).origin
  let digest = null
  let digestError = null
  try {
    const res = await fetch(`${origin}/api/notify/digest`)
    digest = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to call digest:', err.message)
    digestError = err.message
  }

  let goodwillExpiry = null
  let goodwillExpiryError = null
  try {
    const res = await fetch(`${origin}/api/cron/expire-goodwill-trials`)
    goodwillExpiry = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to expire goodwill trials:', err.message)
    goodwillExpiryError = err.message
  }

  let subscriptionDrift = null
  let subscriptionDriftError = null
  try {
    const res = await fetch(`${origin}/api/cron/check-subscription-drift`)
    subscriptionDrift = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to check subscription drift:', err.message)
    subscriptionDriftError = err.message
  }

  let webhookFailures = null
  let webhookFailuresError = null
  try {
    const res = await fetch(`${origin}/api/cron/check-webhook-failures`)
    webhookFailures = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to check webhook failures:', err.message)
    webhookFailuresError = err.message
  }

  let dailySummary = null
  let dailySummaryError = null
  try {
    const res = await fetch(`${origin}/api/cron/notify-daily-summary`)
    dailySummary = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send daily summary:', err.message)
    dailySummaryError = err.message
  }

  let trialAlerts = null
  let trialAlertsError = null
  try {
    const res = await fetch(`${origin}/api/cron/notify-trial-alerts`)
    trialAlerts = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send trial alerts:', err.message)
    trialAlertsError = err.message
  }

  let conversionReport = null
  let conversionReportError = null
  try {
    const res = await fetch(`${origin}/api/cron/notify-conversions`)
    conversionReport = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send conversion report:', err.message)
    conversionReportError = err.message
  }

  let emailFailures = null
  let emailFailuresError = null
  try {
    const res = await fetch(`${origin}/api/cron/check-email-failures`)
    emailFailures = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to check email failures:', err.message)
    emailFailuresError = err.message
  }

  let trialExpiry3Day = null
  let trialExpiry3DayError = null
  try {
    const res = await fetch(`${origin}/api/cron/send-trial-expiry-3day`)
    trialExpiry3Day = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send trial expiry 3day emails:', err.message)
    trialExpiry3DayError = err.message
  }

  let trialExpiry1Day = null
  let trialExpiry1DayError = null
  try {
    const res = await fetch(`${origin}/api/cron/send-trial-expiry-1day`)
    trialExpiry1Day = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send trial expiry 1day emails:', err.message)
    trialExpiry1DayError = err.message
  }

  let trialExpired = null
  let trialExpiredError = null
  try {
    const res = await fetch(`${origin}/api/cron/send-trial-expired`)
    trialExpired = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send trial expired emails:', err.message)
    trialExpiredError = err.message
  }

  let subscriptionTips = null
  let subscriptionTipsError = null
  try {
    const res = await fetch(`${origin}/api/cron/send-subscription-tips`)
    subscriptionTips = await res.json()
  } catch (err) {
    console.error('[cron/daily] Failed to send subscription tips:', err.message)
    subscriptionTipsError = err.message
  }

  return NextResponse.json({
    success: !digestError && !goodwillExpiryError && !subscriptionDriftError && !webhookFailuresError && !dailySummaryError && !trialAlertsError && !conversionReportError && !emailFailuresError && !trialExpiry3DayError && !trialExpiry1DayError && !trialExpiredError && !subscriptionTipsError,
    digest, digestError,
    goodwillExpiry, goodwillExpiryError,
    subscriptionDrift, subscriptionDriftError,
    webhookFailures, webhookFailuresError,
    dailySummary, dailySummaryError,
    trialAlerts, trialAlertsError,
    conversionReport, conversionReportError,
    emailFailures, emailFailuresError,
    trialExpiry3Day, trialExpiry3DayError,
    trialExpiry1Day, trialExpiry1DayError,
    trialExpired, trialExpiredError,
    subscriptionTips, subscriptionTipsError,
  })
}
