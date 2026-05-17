// app/live/page.js - LIVE MODE DASHBOARD
// Real-time view of current streaming session

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LiveMode() {
  const [session, setSession] = useState(null);
  const [liveData, setLiveData] = useState({
    tips: [],
    whales: {},
    momentum: { trend: 'stable', lastMinuteAmount: 0 },
    totalEarnings: 0,
    totalTips: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initLiveStream();
  }, []);

  async function initLiveStream() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/auth';
        return;
      }

      // Subscribe to real-time tips
      const tipChannel = supabase
        .channel(`live_tips:user_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_tips',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.new) {
              updateLiveData(payload.new, user.id);
            }
          }
        )
        .subscribe();

      // Load existing tips for current session
      await loadCurrentSession(user.id);
      setLoading(false);

      return () => {
        supabase.removeChannel(tipChannel);
      };
    } catch (error) {
      console.error('Error initializing live stream:', error);
    }
  }

  async function loadCurrentSession(userId) {
    try {
      // Get active session
      const { data: sessions } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (sessions) {
        setSession(sessions);

        // Load tips for this session
        const { data: tips } = await supabase
          .from('live_tips')
          .select('*')
          .eq('session_id', sessions.id)
          .order('received_at', { ascending: false });

        if (tips) {
          processTips(tips);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }

  function processTips(tips) {
    const whales = {};
    let totalEarnings = 0;

    tips.forEach(tip => {
      totalEarnings += parseFloat(tip.usd || 0);

      if (!whales[tip.username]) {
        whales[tip.username] = { tips: 0, lastSeen: null };
      }
      whales[tip.username].tips += tip.tokens;
      whales[tip.username].lastSeen = tip.received_at;
    });

    // Calculate momentum
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentTips = tips.filter(t => {
      const tipTime = new Date(t.received_at).getTime();
      return tipTime > oneMinuteAgo;
    });

    const lastMinuteAmount = recentTips.reduce((sum, t) => sum + parseFloat(t.usd || 0), 0);
    const momentum = determineMomentum(lastMinuteAmount);

    setLiveData({
      tips: tips.slice(0, 20),
      whales,
      momentum,
      totalEarnings,
      totalTips: tips.length,
    });

    generateAlerts(tips, whales, momentum);
  }

  function updateLiveData(newTip, userId) {
    setLiveData(prev => ({
      ...prev,
      tips: [newTip, ...prev.tips].slice(0, 50),
      totalEarnings: prev.totalEarnings + parseFloat(newTip.usd || 0),
      totalTips: prev.totalTips + 1,
    }));
  }

  function determineMomentum(lastMinuteAmount) {
    // This would normally compare to previous minute
    if (lastMinuteAmount > 200) return { trend: 'heating', lastMinuteAmount };
    if (lastMinuteAmount < 50) return { trend: 'cooling', lastMinuteAmount };
    return { trend: 'stable', lastMinuteAmount };
  }

  function generateAlerts(tips, whales, momentum) {
    const newAlerts = [];

    // Whale alert
    if (tips.length > 0) {
      const lastTip = tips[0];
      if (parseFloat(lastTip.usd) > 100) {
        newAlerts.push({
          type: 'whale',
          emoji: '🐋',
          message: `${lastTip.username} tipped $${parseFloat(lastTip.usd).toFixed(2)}`,
          action: 'Greet immediately'
        });
      }
    }

    // Momentum alerts
    if (momentum.trend === 'heating' && momentum.lastMinuteAmount > 200) {
      newAlerts.push({
        type: 'heating',
        emoji: '🔥',
        message: 'Room is HEATING UP',
        action: 'Start teasing or game NOW'
      });
    }

    if (momentum.trend === 'cooling' && tips.filter(t => {
      const tipTime = new Date(t.received_at).getTime();
      return tipTime > Date.now() - 60000;
    }).length === 0) {
      newAlerts.push({
        type: 'cooling',
        emoji: '❄️',
        message: 'Momentum dropping',
        action: 'Launch countdown game'
      });
    }

    setAlerts(newAlerts.slice(0, 3));
  }

  if (loading) {
    return (
      <div style={{
        background: '#0a0814',
        color: '#e2e8f0',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: '18px', color: '#a855f7' }}>Loading live stream...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0814 0%, #1a0a2e 100%)',
      color: '#e2e8f0',
      minHeight: '100vh',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
        padding: '16px 24px',
        borderRadius: '12px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>🎬 Live Mode</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#22c55e',
            animation: 'pulse 2s infinite',
          }} />
          STREAMING
        </div>
      </div>

      {/* Momentum Banner */}
      <MomentumBanner momentum={liveData.momentum} />

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '20px',
      }}>
        {/* Left: Alerts + Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Alerts */}
          <Section title="🧠 Coach Alerts">
            {alerts.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                No active alerts
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} />
                ))}
              </div>
            )}
          </Section>

          {/* Quick Metrics */}
          <Section title="💰 Metrics">
            <MetricsGrid data={liveData} />
          </Section>
        </div>

        {/* Right: Whales + Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Whale Tracking */}
          {Object.keys(liveData.whales).length > 0 && (
            <Section title="🐋 Top Spenders">
              {Object.entries(liveData.whales)
                .sort(([, a], [, b]) => b.tips - a.tips)
                .slice(0, 5)
                .map(([username, data]) => (
                  <WhaleCard key={username} username={username} data={data} />
                ))}
            </Section>
          )}

          {/* Tips Feed */}
          <Section title="📝 Tip Feed">
            {liveData.tips.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                Waiting for tips...
              </div>
            ) : (
              <TipsFeed tips={liveData.tips} />
            )}
          </Section>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

function MomentumBanner({ momentum }) {
  let icon, text, className, color;

  if (momentum.trend === 'heating') {
    icon = '🔥';
    text = 'HEATING UP';
    className = 'heating';
    color = '#ef4444';
  } else if (momentum.trend === 'cooling') {
    icon = '❄️';
    text = 'COOLING DOWN';
    className = 'cooling';
    color = '#3b82f6';
  } else {
    icon = '➡️';
    text = 'STABLE';
    className = 'stable';
    color = '#a855f7';
  }

  return (
    <div style={{
      background: `rgba(${color === '#ef4444' ? '239, 68, 68' : color === '#3b82f6' ? '59, 130, 246' : '168, 85, 247'}, 0.15)`,
      border: `2px solid rgba(${color === '#ef4444' ? '239, 68, 68' : color === '#3b82f6' ? '59, 130, 246' : '168, 85, 247'}, 0.3)`,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{ fontSize: '28px' }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '16px', color }}>
          Room Momentum: {text}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          ${momentum.lastMinuteAmount.toFixed(2)} in last minute
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(168, 85, 247, 0.08)',
      border: '1px solid rgba(168, 85, 247, 0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'rgba(168, 85, 247, 0.1)',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
        fontWeight: 'bold',
        color: '#a855f7',
        fontSize: '13px',
      }}>
        {title}
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const bgColor = alert.type === 'whale' ? 'rgba(217, 119, 6, 0.1)' : 
                  alert.type === 'heating' ? 'rgba(239, 68, 68, 0.1)' :
                  'rgba(59, 130, 246, 0.1)';

  const borderColor = alert.type === 'whale' ? '#fbbf24' :
                      alert.type === 'heating' ? '#ef4444' :
                      '#3b82f6';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '12px',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        {alert.emoji} {alert.message}
      </div>
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#cbd5e1',
      }}>
        💡 {alert.action}
      </div>
    </div>
  );
}

function MetricsGrid({ data }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
    }}>
      <MetricCard label="Total Earnings" value={`$${data.totalEarnings.toFixed(2)}`} />
      <MetricCard label="Tips Count" value={data.totalTips} />
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(168, 85, 247, 0.2)',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {value}
      </div>
    </div>
  );
}

function WhaleCard({ username, data }) {
  return (
    <div style={{
      background: 'rgba(217, 119, 6, 0.15)',
      border: '1px solid rgba(217, 119, 6, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>
          🐋 {username}
        </div>
        <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>
          {data.tips} tokens
        </div>
      </div>
      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
        Last seen: {formatTime(data.lastSeen)}
      </div>
    </div>
  );
}

function TipsFeed({ tips }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxHeight: '300px',
      overflowY: 'auto',
    }}>
      {tips.map((tip, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
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
  );
}

function formatTime(timestamp) {
  if (!timestamp) return 'never';
  const now = new Date();
  const then = new Date(timestamp);
  const diff = now - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
