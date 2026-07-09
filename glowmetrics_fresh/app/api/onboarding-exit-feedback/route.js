import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const REASON_OPTIONS = [
  'confusing_step',
  'cant_find_csv',
  'platform_not_supported',
  'ran_into_error',
  'just_browsing',
  'other',
];

const FeedbackSchema = z.object({
  step_number: z.number().int().min(0).max(20),
  step_name: z.string().min(1).max(100),
  reason: z.enum(REASON_OPTIONS),
  free_text: z.string().max(1000).optional().nullable(),
});

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });

  // Derive user from server-side session — never trust a client-supplied user_id
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'You need to sign in to continue.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { step_number, step_name, reason, free_text } = parsed.data;

  const { error: insertError } = await supabase.from('onboarding_exit_feedback').insert({
    user_id: user.id, // from auth session, not client input
    step_number,
    step_name,
    reason,
    free_text: free_text || null,
  });

  if (insertError) {
    // Sanitized error — never return raw Supabase error to the client
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
