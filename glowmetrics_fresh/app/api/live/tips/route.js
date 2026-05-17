import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { userId, sessionId, username, tokens, usd, platform, source } = await req.json();

    const { data, error } = await supabase
      .from('live_tips')
      .insert({
        user_id: userId,
        session_id: sessionId,
        username,
        tokens: parseInt(tokens) || 0,
        usd: parseFloat(usd) || 0,
        received_at: new Date().toISOString(),
        deduplication_key: `${username}-${tokens}-${Date.now()}`
      })
      .select();

    if (error) throw error;
    return Response.json({ success: true, tip: data[0] });
  } catch (error) {
    console.error('Live tip error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
