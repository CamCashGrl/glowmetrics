import { Resend } from 'resend'
import { z } from 'zod'
import { createSupabaseRouteClient } from '../../../lib/supabase-server'

const SENTIMENT_OPTIONS = ['love_it', 'good', 'okay', 'frustrated', 'broken']
const CATEGORY_OPTIONS = [
  'bug',
  'feature_request',
  'confusing',
  'performance',
  'data_analytics',
  'ui_design',
  'other',
]

const FeedbackSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sentiment: z.enum(SENTIMENT_OPTIONS).optional().nullable(),
  category: z.enum(CATEGORY_OPTIONS).optional().nullable(),
  page_url: z.string().max(500).optional().nullable(),
  page_title: z.string().max(200).optional().nullable(),
})

export async function POST(req) {
  const supabase = createSupabaseRouteClient()

  // Derive the user from the authenticated session — never trust a
  // client-supplied user_id or plan.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'You need to sign in to continue.' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { message, sentiment, category, page_url, page_title } = parsed.data

  // Plan is read from the user's own profile row server-side — the client
  // cannot spoof it by sending its own `plan` field.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const { error: insertError } = await supabase.from('feedback').insert({
    user_id: user.id, // from auth session, not client input
    message,
    sentiment: sentiment || null,
    category: category || null,
    plan: profile?.plan || null,
    page_url: page_url || null,
    page_title: page_title || null,
  })

  if (insertError) {
    // Database persistence is the primary requirement — if it fails, report
    // the failure rather than silently falling back to email-only.
    console.error('Feedback insert error:', insertError.message)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  // Email notification is secondary — it must never block or fail the
  // already-successful database write.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'CamCash Feedback <welcome@camcashgrl.com>',
      to: 'daphneoncam@gmail.com',
      subject: '💬 New CamCash Feedback',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#7C5CFF,#EC4899);display:inline-flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px;">💬</div>
    <h1 style="color:#F1F5F9;font-size:22px;font-weight:900;margin:0;">New CamCash Feedback</h1>
  </div>

  <div style="background:rgba(15,20,32,0.9);border:1px solid rgba(124,92,255,0.25);border-radius:14px;padding:24px;margin-bottom:20px;">
    <p style="color:#94A3B8;font-size:12px;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
    <p style="color:#F1F5F9;font-size:15px;line-height:1.7;margin:0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>

  <div style="background:rgba(15,20,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px;">
    ${sentiment ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Sentiment:</strong> ${sentiment}</p>` : ''}
    ${category ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Category:</strong> ${category}</p>` : ''}
    ${page_url ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Page:</strong> ${page_url}</p>` : ''}
    ${page_title ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Title:</strong> ${page_title}</p>` : ''}
    <p style="color:#64748B;font-size:13px;margin:0;"><strong style="color:#94A3B8;">User ID:</strong> ${user.id}</p>
  </div>

  <div style="text-align:center;padding-top:24px;">
    <p style="color:#334155;font-size:12px;margin:0;">CamCash · camcashgrl.com</p>
  </div>
</div>
</body>
</html>`,
    })
  } catch (err) {
    // Email is secondary — the feedback row is already saved, so a failed
    // notification email must not surface as an error to the user.
    console.error('Feedback email error:', err.message)
  }

  return Response.json({ success: true })
}
