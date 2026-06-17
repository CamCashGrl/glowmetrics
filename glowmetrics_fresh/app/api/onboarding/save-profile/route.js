import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request) {
  try {
    const cookieStore = cookies()

    // Read the Supabase auth token directly from cookies
    const accessToken = cookieStore.get('sb-hlsdlaibnayzbfflxclj-auth-token')?.value

    let userId = null

    if (accessToken) {
      try {
        const parsed = JSON.parse(accessToken)
        userId = parsed?.user?.id || null
      } catch {}
    }

    // Fallback: try the supabase admin client to verify via bearer token
    if (!userId) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        const { data: { user } } = await adminClient.auth.getUser(token)
        userId = user?.id || null
      }
    }

    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { chaturbate_username, chaturbate_stats_token, broadcaster_type } = body

    if (!chaturbate_username || !chaturbate_stats_token) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        chaturbate_username: chaturbate_username.trim(),
        chaturbate_stats_token: chaturbate_stats_token.trim(),
        chaturbate_token_type: 'stats',
        broadcaster_type: broadcaster_type || 'female',
      })
      .select()
      .single()

    if (error) {
      console.error('Profile upsert error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
