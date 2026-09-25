import { createClient } from '@supabase/supabase-js'
import { emailTemplates, sendEmail } from '../../../../lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/emails/send-day7-final
 *
 * Sends day 7 final pitch email to users who signed up exactly 7 days ago
 * Should be triggered by a cron job daily
 *
 * Query params:
 *   - userId (optional): Send to specific user (for testing)
 *   - dryRun (optional): Set to "true" to preview without sending
 */
export async function POST(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const dryRun = url.searchParams.get('dryRun') === 'true'

    // Calculate 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStart = new Date(sevenDaysAgo.setHours(0, 0, 0, 0)).toISOString()
    const sevenDaysAgoEnd = new Date(sevenDaysAgo.setHours(23, 59, 59, 999)).toISOString()

    let query = supabaseAdmin
      .from('profiles')
      .select('id, display_name, email:id(email), created_at, day7_email_sent_at')
      .gte('created_at', sevenDaysAgoStart)
      .lte('created_at', sevenDaysAgoEnd)
      .is('day7_email_sent_at', null)

    if (userId) {
      query = query.eq('id', userId)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error('Query error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!profiles?.length) {
      return Response.json({ success: true, sent: 0, message: 'No users to email' })
    }

    const results = []

    for (const profile of profiles) {
      try {
        // Get user email
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
        const user = users?.find(u => u.id === profile.id)

        if (!user?.email) {
          results.push({ userId: profile.id, success: false, reason: 'User email not found' })
          continue
        }

        if (dryRun) {
          results.push({ userId: profile.id, success: true, reason: 'DRY RUN - not actually sending' })
          continue
        }

        const displayName = profile.display_name || user.email.split('@')[0]
        const template = emailTemplates.day7Final
        const emailBody = template.getBody(displayName)

        const result = await sendEmail(user.email, template.subject, emailBody)

        if (result.success) {
          await supabaseAdmin
            .from('profiles')
            .update({ day7_email_sent_at: new Date().toISOString() })
            .eq('id', profile.id)

          results.push({ userId: profile.id, success: true, messageId: result.messageId })
        } else {
          results.push({ userId: profile.id, success: false, reason: result.error })
        }
      } catch (err) {
        results.push({ userId: profile.id, success: false, reason: err.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    return Response.json({
      success: true,
      sent: successCount,
      total: results.length,
      results: dryRun ? results : undefined,
    })
  } catch (error) {
    console.error('[send-day7-final] Error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
