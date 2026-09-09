'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { initializeAnalytics } from '../../lib/analytics-client';

export default function AuthListener() {
  const hasInitialized = useRef(false);
  const notifiedUsers = useRef(new Set());

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Initialize analytics
    initializeAnalytics();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_UP' && session?.user) {
        const userId = session.user.id;
        const email = session.user.email;
        const displayName = session.user.user_metadata?.display_name || email;

        // Prevent duplicate notifications
        if (notifiedUsers.current.has(userId)) return;
        notifiedUsers.current.add(userId);

        try {
          // Send signup notification email
          const response = await fetch('/api/notify/signup-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              email,
              displayName,
            }),
          });

          if (!response.ok) {
            console.error('Failed to send signup email:', response.statusText);
          }
        } catch (err) {
          console.error('Error sending signup email:', err);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return null;
}
