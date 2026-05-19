import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  const supabase = getSupabase();
  try {
    const { userId, sessionId, username, tokens, usd, platform, source } = await req.json();

    if (!userId || !username) {
      return Response.json({ error: 'userId and username are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('live_tips')
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        username,
        tokens: parseInt(tokens) || 0,
        usd: parseFloat(usd) || 0,
        source: source || platform || 'extension',
        received_at: new Date().toISOString(),
        deduplication_key: `${userId}-${username}-${tokens}-${Date.now()}`
      })
      .select();

    if (error) throw error;
    return Response.json({ success: true, tip: data[0] });
  } catch (error) {
    console.error('Live tip POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  const supabase = getSupabase();
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const since = searchParams.get('since');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    let query = supabase
      .from('live_tips')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(100);

    if (since) {
      query = query.gt('received_at', since);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ tips: data });
  } catch (error) {
    console.error('Live tip GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
