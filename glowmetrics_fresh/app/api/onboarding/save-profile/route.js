import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Verify the user is actually logged in
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { chaturbate_username, chaturbate_stats_token, broadcaster_type } = body

    if (!chaturbate_username || !chaturbate_stats_token) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        chaturbate_username: chaturbate_username.trim(),
        chaturbate_stats_token: chaturbate_stats_token.trim(),
        chaturbate_token_type: 'stats',
        broadcaster_type: broadcaster_type || 'female',
      })
      .select()
      .single()

    if (error) {
      console.error('Profile save error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
