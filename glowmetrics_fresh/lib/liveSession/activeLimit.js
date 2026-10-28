import { shapeLiveSession } from './shape'

// Free streams end at 35 ACTIVE minutes. The database decides (Pro check,
// paused time, exact end instant) in enforce_live_active_limit(); this only
// asks it, from every route a running page or the extension keeps hitting.
// A pg_cron sweep ends streams nobody is polling, so a failed call here is
// logged and the request carries on rather than breaking a heartbeat.
export async function enforceActiveLimit(supabase) {
  const { data, error } = await supabase.rpc('enforce_live_active_limit')
  if (error) {
    console.error('[live-session] enforce_live_active_limit', error)
    return null
  }
  // A plpgsql composite NULL arrives as an object of null fields.
  return data?.id ? shapeLiveSession(data) : null
}

const LIMIT_NOTICE_WINDOW_MS = 10 * 60 * 1000

// The caller's most recent stream if the Free limit ended it in the last
// 10 minutes — whichever path ended it (this route, another tab, the sweep).
export async function recentLimitEndedSession(supabase, userId) {
  const { data } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data || data.session_resolution_type !== 'free_active_limit') return null
  if (Date.now() - new Date(data.ended_at).getTime() > LIMIT_NOTICE_WINDOW_MS) return null
  return shapeLiveSession(data)
}
