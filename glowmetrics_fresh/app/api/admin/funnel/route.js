import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'

// Server side of the internal activation funnel (/analytics).
//
// WHY THIS EXISTS
// /analytics was a client page that queried Supabase directly with the
// browser anon key and no authentication of any kind. It read cross-user
// data -- beta_users counts, every user_id in tips, analytics_events, and
// other creators' profiles (display_name, chaturbate_username) -- and
// labelled itself "internal only" while being reachable by anyone who
// typed the URL. Whether each query returned rows depended entirely on
// whichever RLS policy happened to be on each table; the page itself
// enforced nothing.
//
// This route moves every one of those queries behind the same admin gate
// the rest of /admin already uses (HMAC gm_admin cookie -> verifyAdminToken),
// and runs them with the service-role key server side so the browser never
// holds a credential that can read across users.

const STEP_ORDER = ['platform', 'username', 'paste', 'csv', 'preview', 'loading', 'live', 'step4', 'done']
const STEP_LABELS = {
  platform: 'Chose platform',
  username: 'Entered CB username',
  paste: 'Pasted tip history',
  csv: 'Chose CSV upload',
  preview: 'Reviewed preview',
  loading: 'Import processing',
  live: 'Live mode screen',
  step4: 'Post-import choice',
  done: 'Saw completion screen',
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = sb()

  const { count: signups } = await supabase
    .from('beta_users')
    .select('*', { count: 'exact', head: true })

  const { count: onboarded } = await supabase
    .from('beta_users')
    .select('*', { count: 'exact', head: true })
    .eq('onboarding_complete', true)

  const { data: tipsData } = await supabase
    .from('tips')
    .select('user_id')
    .limit(1000)

  const activated = new Set(tipsData?.map(t => t.user_id) || []).size

  const { data: stepEvents } = await supabase
    .from('analytics_events')
    .select('user_id, properties, created_at')
    .eq('event_name', 'onboarding_step_viewed')
    .order('created_at', { ascending: false })
    .limit(2000)

  const { data: completedEvents } = await supabase
    .from('analytics_events')
    .select('user_id')
    .eq('event_name', 'onboarding_completed')
  const completedSet = new Set((completedEvents || []).map(e => e.user_id))

  const reachedByStep = {}
  const lastStepByUser = new Map()
  for (const e of stepEvents || []) {
    const step = e.properties?.step
    if (!e.user_id || !step) continue
    if (!reachedByStep[step]) reachedByStep[step] = new Set()
    reachedByStep[step].add(e.user_id)
    if (!lastStepByUser.has(e.user_id)) {
      lastStepByUser.set(e.user_id, { step, platform: e.properties?.platform, at: e.created_at })
    }
  }

  const stepFunnel = STEP_ORDER
    .map(step => ({ step, label: STEP_LABELS[step], value: reachedByStep[step]?.size || 0 }))
    .filter(s => s.value > 0)

  const userIds = [...lastStepByUser.keys()].filter(id => !completedSet.has(id))
  let profileById = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, chaturbate_username')
      .in('id', userIds)
    profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  }

  const dropoffs = userIds
    .map(id => {
      const last = lastStepByUser.get(id)
      const p = profileById[id]
      return {
        userId: id,
        label: p?.chaturbate_username || p?.display_name || `${id.slice(0, 8)}…`,
        ...last,
      }
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20)

  return NextResponse.json({
    totals: { signups: signups || 0, onboarded: onboarded || 0, activated },
    stepFunnel,
    dropoffs,
  })
}
