// app/api/extension/tips/route.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user profile to find their streamer username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('username, id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Parse extension request
    const body = await req.json();
    const { username, amount, platform, timestamp } = body;

    if (!username || !amount || !platform) {
      return Response.json(
        { error: 'Missing required fields: username, amount, platform' },
        { status: 400 }
      );
    }

    // Convert to live_tips format
    const tipData = {
      user_id: user.id,
      username: username.trim(),
      tokens: parseInt(amount, 10),
      usd: 0, // Extension doesn't provide USD, can calculate later
      platform: platform.toLowerCase(),
      source: 'extension',
      received_at: timestamp || new Date().toISOString(),
      deduplication_key: `${user.id}-${username}-${amount}-${Date.now()}`
    };

    // Insert into live_tips
    const { data, error } = await supabaseAdmin
      .from('live_tips')
      .insert(tipData)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return Response.json(
        { error: 'Failed to save tip' },
        { status: 500 }
      );
    }

    // Also insert into tips table for historical record
    await supabaseAdmin
      .from('tips')
      .insert({
        user_id: user.id,
        username: username.trim(),
        tokens: parseInt(amount, 10),
        platform: platform.toLowerCase(),
        date_time: timestamp || new Date().toISOString()
      })
      .select();

    return Response.json({
      success: true,
      tip: data[0],
      message: `Tip from ${username} synced to dashboard`
    });

  } catch (error) {
    console.error('Extension tip endpoint error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const since = searchParams.get('since');

    let query = supabaseAdmin
      .from('live_tips')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt('received_at', since);
    }

    const { data, error } = await query;

    if (error) throw error;

    return Response.json({
      tips: data,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Extension GET error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
