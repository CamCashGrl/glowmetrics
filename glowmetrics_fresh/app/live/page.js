'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LiveMode() {
  const [session, setSession] = useState(null);
  const [tips, setTips] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not logged in. Go to /auth first.');
        setLoading(false);
        return;
      }

      const { data: activeSession, error: sessionError } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError) {
        setError('No active streaming session. Start streaming first!');
        setLoading(false);
        return;
      }

      setSession(activeSession);

      const { data: existingTips } = await supabase
        .from('live_tips')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('received_at', { ascending: false });

      if (existingTips) {
        setTips(existingTips);
        const total = existingTips.reduce((sum, t) => sum + parseFloat(t.usd || 0), 0);
        setEarnings(total);
      }

      const channel = supabase
        .channel(`live_tips_${activeSession.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_tips',
            filter: `session_id=eq.${activeSession.id}`
          },
          (payload) => {
            const newTip = payload.new;
            setTips(prev => [newTip, ...prev]);
            setEarnings(prev => prev + parseFloat(newTip.usd || 0));
          }
        )
        .subscribe();

      setLoading(false);

      return () => supabase.removeChannel(channel);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', color: '#e2e8f0', background: '#0a0814', minHeight: '100vh' }}>
        Loading Live Mode...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444', background: '#0a0814', minHeight: '100vh' }}>
        ❌ {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: '#0a0814', color: '#e2e8f0', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '20px' }}>🎬 Live Mode</h1>

      <div style={{
        background: 'rgba(168, 85, 247, 0.1)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
          Session Earnings
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#a855f7',
          marginBottom: '8px',
        }}>
          ${earnings.toFixed(2)}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {tips.length} tips received
        </div>
      </div>

      <div style={{
        background: 'rgba(168, 85, 247, 0.1)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'rgba(168, 85, 247, 0.15)',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
          fontWeight: 'bold',
          fontSize: '13px',
          color: '#a855f7',
        }}>
          📝 Live Tips Feed
        </div>

        <div style={{ padding: '16px' }}>
          {tips.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center' }}>
              Waiting for tips... Go live and start earning!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {tips.map((tip, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}>
                  <span style={{ fontWeight: 'bold' }}>{tip.username}</span>
                  <span style={{ color: '#a855f7', fontWeight: 'bold' }}>
                    ${parseFloat(tip.usd || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ color: '#a855f7', textDecoration: 'none', fontSize: '12px' }}>
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
