import { createClient } from '@supabase/supabase-js';

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = origin.startsWith('chrome-extension://')
    ? origin
    : 'https://www.camcashgrl.com';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req) {
  const cors = corsHeaders(req);
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400, headers: cors }
      );
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return Response.json(
        { error: error.message || 'Invalid credentials' },
        { status: 401, headers: cors }
      );
    }

    if (!data.user || !data.session) {
      return Response.json(
        { error: 'Authentication failed' },
        { status: 401, headers: cors }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, id, avatar_url')
      .eq('id', data.user.id)
      .single();

    return Response.json({
      success: true,
      session: {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
      },
      user: {
        id:         data.user.id,
        email:      data.user.email,
        username:   profile?.username || data.user.email?.split('@')[0],
        avatar_url: profile?.avatar_url,
      },
    }, { headers: cors });

  } catch (err) {
    console.error('Login error:', err);
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: 500, headers: cors }
    );
  }
}
