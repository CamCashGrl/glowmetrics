// app/api/auth/login/route.js
import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'chrome-extension://dbmfnbekgohfemdglbjcefcdkcpccadf',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return Response.json(
        { error: error.message || 'Invalid credentials' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (!data.user || !data.session) {
      return Response.json(
        { error: 'Authentication failed' },
        { status: 401, headers: CORS_HEADERS }
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
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || data.user.email?.split('@')[0],
        avatar_url: profile?.avatar_url
      }
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('Login endpoint error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
