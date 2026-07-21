import { isProPlan } from './constants'

// Reuses the same profiles.plan field the rest of the dashboard already
// gates on (see app/dashboard/page.js: `profile?.plan === 'pro' || 'unlimited'`).
// No second payment/entitlement system.
export async function getIsProUser(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load plan for entitlement check', error.message)
    return false
  }
  return isProPlan(data?.plan)
}
