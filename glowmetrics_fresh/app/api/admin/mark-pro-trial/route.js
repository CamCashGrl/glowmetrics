/**
 * Admin endpoint to mark users as pro for free trial access.
 * Requires admin authentication via cookie.
 *
 * POST /api/admin/mark-pro-trial
 * {
 *   "emails": ["email1@example.com", "email2@example.com"],
 *   "trial_days": 7
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function POST(req) {
  try {
    // Verify admin authentication via cookie
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('gm_admin')?.value

    if (!adminToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify token matches expected value
    const adminSecret = process.env.ADMIN_SECRET || 'b58cc2f103a1acf0eb15e795f1ff4dc95a360961d86973cd026d4a015d73f560'
    if (adminToken !== adminSecret) {
      return Response.json({ error: 'Invalid admin token' }, { status: 401 })
    }

    const { emails, trial_days = 7 } = await req.json()

    if (!Array.isArray(emails) || emails.length === 0) {
      return Response.json({ error: 'emails array required' }, { status: 400 })
    }

    if (!Number.isInteger(trial_days) || trial_days <= 0) {
      return Response.json({ error: 'trial_days must be positive integer' }, { status: 400 })
    }

    // Get auth users for these emails
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      return Response.json({ error: 'Failed to load users' }, { status: 500 })
    }

    const results = []
    const trialExpiresAt = new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000).toISOString()

    for (const email of emails) {
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

      if (!user) {
        results.push({ email, status: 'not_found', message: 'User not found' })
        continue
      }

      // Check current profile status
      const { data: profile, error: getError } = await supabase
        .from('profiles')
        .select('plan, plan_expires_at')
        .eq('id', user.id)
        .single()

      if (getError) {
        results.push({ email, status: 'error', message: `Failed to fetch profile: ${getError.message}` })
        continue
      }

      // Update profile to pro with trial expiry
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          plan: 'pro',
          plan_expires_at: trialExpiresAt,
          plan_expiry_notified_at: null, // Reset notification flag
        })
        .eq('id', user.id)

      if (updateError) {
        results.push({ email, status: 'error', message: `Update failed: ${updateError.message}` })
        continue
      }

      results.push({
        email,
        user_id: user.id,
        status: 'success',
        old_plan: profile?.plan || 'free',
        new_plan: 'pro',
        trial_expires_at: trialExpiresAt,
      })
    }

    return Response.json({
      success: true,
      trial_days,
      trial_expires_at: trialExpiresAt,
      updated_count: results.filter(r => r.status === 'success').length,
      results,
    })
  } catch (error) {
    console.error('Admin mark-pro-trial error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
