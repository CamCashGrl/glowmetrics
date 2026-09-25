import { createClient } from '@supabase/supabase-js'
import { emailTemplates, sendEmail } from '../../../../lib/emailTemplates'

/**
 * POST /api/emails/send-platform-connected
 *
 * Sends platform connected confirmation email
 * Triggered when user adds their first platform connection
 *
 * Body: { userId: string, platform: string }
 */
export async function POST(request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { userId, platform } = await request.json()

    if (!userId || !platform) {
      return Response.json({ error: 'userId and platform required' }, { status: 400 })
    }

    // Get user email and profile
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    const user = users?.find(u => u.id === userId)

    if (!user?.email) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, platform_connected_email_sent_at')
      .eq('id', userId)
      .single()

    // Don't resend if already sent
    if (profile?.platform_connected_email_sent_at) {
      return Response.json({ success: false, reason: 'Email already sent' }, { status: 200 })
    }

    const displayName = profile?.display_name || user.email.split('@')[0]
    const template = emailTemplates.platformConnected
    const emailBody = template.getBody(displayName, platform)

    // Send email
    const result = await sendEmail(user.email, template.subject, emailBody)

    if (result.success) {
      // Mark as sent
      await supabaseAdmin
        .from('profiles')
        .update({ platform_connected_email_sent_at: new Date().toISOString() })
        .eq('id', userId)

      return Response.json({ success: true, messageId: result.messageId })
    } else {
      console.error('Failed to send platform connected email:', result.error)
      return Response.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('[send-platform-connected] Error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
