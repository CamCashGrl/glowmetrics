import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    const total = count || 0
    const remaining = Math.max(0, 100 - total)
    const earlyAdopterOpen = total < 100
    return Response.json({ total, remaining, earlyAdopterOpen })
  } catch (e) {
    // Fallback so page still renders if env vars not set yet
    return Response.json({ total: 0, remaining: 100, earlyAdopterOpen: true })
  }
}
