import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../../lib/supabase-server'

export async function POST(request) {
  try {
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { surveyData } = await request.json()

    // Fetch full user profile before deletion
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Calculate months active
    const createdAt = new Date(profile.created_at)
    const now = new Date()
    const monthsActive = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24 * 30))

    // Archive the account (preserve all data)
    await supabase.from('deleted_accounts_archive').insert({
      user_id: user.id,
      email: user.email,
      created_at_original: profile.created_at,
      last_plan: profile.plan,
      subscription_status_at_deletion: profile.subscription_status,
      months_active_at_deletion: monthsActive,
      total_lifetime_revenue_usd: 0, // Would calculate from payment_events if needed
      reason_for_deletion: surveyData?.reason || 'user_initiated',
      survey_answers: surveyData || {},
      archived_profile_snapshot: profile,
      archived_metadata: {
        deletion_reason: surveyData?.reason,
        deletion_notes: surveyData?.details,
        stripe_customer_id: profile.stripe_customer_id,
        total_revenue: 0
      }
    })

    // Record the deletion event
    await supabase.from('user_lifecycle_events').insert({
      user_id: user.id,
      event_type: 'account_deleted',
      old_value: profile.subscription_status,
      new_value: 'deleted',
      reason: surveyData?.reason || 'user_initiated',
      properties: surveyData || {},
      stripe_event_id: `account_delete_${Date.now()}`
    })

    // Record exit survey
    await supabase.from('user_exit_surveys').insert({
      user_id: user.id,
      survey_type: 'account_deletion',
      reason: surveyData?.reason || 'no_reason_provided',
      details: surveyData?.details || null,
      survey_answers: surveyData || {},
      user_email: user.email,
      user_plan: profile.plan,
      months_active: monthsActive
    })

    // Soft delete: mark account as inactive but preserve all data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        account_active: false,
        subscription_stop_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to mark account as deleted:', updateError)
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    // Note: We do NOT delete the auth user here because that's irreversible.
    // The account is marked as inactive/deleted in our database.
    // The user would need to contact support to truly delete their auth record if needed.

    return NextResponse.json({
      success: true,
      message: 'Your account has been deleted. All your data has been preserved for compliance purposes.',
      deletedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
