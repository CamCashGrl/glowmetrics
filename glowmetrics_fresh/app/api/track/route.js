import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    const body = await request.json()
    const { event_name, properties = {}, session_id, url } = body

    if (!event_name) return new Response('Missing event_name', { status: 400 })

    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      session_id,
      event_name,
      properties,
      url,
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 })
  }
}
