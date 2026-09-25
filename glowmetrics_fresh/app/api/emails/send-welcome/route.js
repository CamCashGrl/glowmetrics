import { createClient } from '@supabase/supabase-js'
import { emailTemplates, sendEmail } from '../../../../lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/emails/send-welcome
 *
 * Sends welcome email to new user
 * Called after user signup in auth callback flow
 *
 * Body: { userId: string }
 */
export async function POST(request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user email and profile info
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    const user = users?.find(u => u.id === userId)

    if (!user?.email) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, welcome_email_sent_at')
      .eq('id', userId)
      .single()

    // Don't resend if already sent
    if (profile?.welcome_email_sent_at) {
      return Response.json({ success: false, reason: 'Email already sent' }, { status: 200 })
    }

    const displayName = profile?.display_name || user.email.split('@')[0]
    const template = emailTemplates.welcome
    const emailBody = template.getBody(user.email, displayName)

    // Send email
    const result = await sendEmail(user.email, template.subject, emailBody)

    if (result.success) {
      // Mark as sent in profiles
      await supabaseAdmin
        .from('profiles')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('id', userId)

      return Response.json({ success: true, messageId: result.messageId })
    } else {
      console.error('Failed to send welcome email:', result.error)
      return Response.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('[send-welcome] Error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
