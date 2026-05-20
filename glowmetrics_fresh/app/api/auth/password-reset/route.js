// app/api/auth/password-reset/route.js
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Send password reset email via Supabase Auth
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://camcashgrl.com'}/auth/reset-password`
      }
    );

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not (security)
      return Response.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.'
      });
    }

    return Response.json({
      success: true,
      message: 'Password reset link sent to your email'
    });

  } catch (error) {
    console.error('Password reset endpoint error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
