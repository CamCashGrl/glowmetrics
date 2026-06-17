import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { chaturbate_username, chaturbate_stats_token, broadcaster_type, user_id } = body

    if (!user_id || !chaturbate_username || !chaturbate_stats_token) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use anon key — RLS policies (auth.uid() = id) handle authorization
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user_id,
        chaturbate_username: chaturbate_username.trim(),
        chaturbate_stats_token: chaturbate_stats_token.trim(),
        chaturbate_token_type: 'stats',
        broadcaster_type: broadcaster_type || 'female',
      })
      .select()
      .single()

    if (error) {
      console.error('Upsert error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
