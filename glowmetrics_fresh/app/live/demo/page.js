'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
};

const glassCard = {
  background: 'rgba(15,20,32,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)',
};

const DEMO_TIPPERS = [
  { username: 'VenusRain',   tokens: 100,  usd: 5.00  },
  { username: 'DarkFox99',   tokens: 500,  usd: 25.00 },
  { username: 'PixelKing',   tokens: 50,   usd: 2.50  },
  { username: 'NightBlaze',  tokens: 200,  usd: 10.00 },
  { username: 'CrimsonWave', tokens: 1000, usd: 50.00 },
  { username: 'StarDust7',   tokens: 25,   usd: 1.25  },
  { username: 'LunarFox',    tokens: 75,   usd: 3.75  },
];

const DEMO_COACHES = [
  { icon: '🔥', context: 'Tip frequency is up — room energy above your normal pace',    action: "Don't break the energy — keep doing exactly what you're doing" },
  { icon: '💎', context: 'DarkFox99 is 38% of your session revenue',                    action: 'Give them personal attention and an exclusive offer for their next tip' },
  { icon: '🎯', context: 'Goal is at 78% — the room is primed',                         action: 'Announce your reward out loud right now and keep the energy high' },
  { icon: '🐋', context: 'CrimsonWave usually tips every ~4 minutes',                   action: '6 min since their last tip — call them out right now!' },
  { icon: '⚡', context: 'Revenue pace is above your normal rate',                      action: 'Raise your goal amount NOW while the room is hot' },
];

export default function LiveDemoPage() {
  const [demoTips, setDemoTips]           = useState([]);
  const [demoRevenue, setDemoRevenue]     = useState(0);
  const [demoCoachIdx, setDemoCoachIdx]   = useState(0);
  const [showExtModal, setShowExtModal]   = useState(false);
  const [extStep, setExtStep]             = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode]           = useState('signin');
  const [authEmail, setAuthEmail]         = useState('');
  const [authPassword, setAuthPassword]   = useState('');
  const [authError, setAuthError]         = useState('');
  const [authLoading, setAuthLoading]     = useState(false);

  // Simulate live tips rolling in
  useEffect(() => {
    let idx = 0;
    let rev = 0;
    const iv = setInterval(() => {
      const t = DEMO_TIPPERS[idx % DEMO_TIPPERS.length];
      idx++;
      rev = parseFloat((rev + t.usd).toFixed(2));
      setDemoRevenue(rev);
      setDemoTips(prev => [{ ...t, ts: Date.now(), id: idx }, ...prev].slice(0, 6));
      setDemoCoachIdx(c => (c + 1) % DEMO_COACHES.length);
    }, 3200);
    return () => clearInterval(iv);
  }, []);

  const handleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        window.location.href = '/live';
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const coach = DEMO_COACHES[demoCoachIdx];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui', color: C.white }}>
      <style>{`
        @keyframes cc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes cc-bar   { from{opacity:0.5;} to{opacity:1;} }
        @keyframes cc-slide { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes cc-glow  { 0%,100%{box-shadow:0 0 8px currentColor;} 50%{box-shadow:0 0 20px currentColor;} }
      `}</style>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.88)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0f1420', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 0 60px rgba(168,85,247,0.2)', position: 'relative' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💎</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 4 }}>
                {authMode === 'signin' ? 'Sign in to CamCash' : 'Create free account'}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Save your data, unlock full analytics</div>
            </div>
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {['signin', 'signup'].map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthError(''); }} style={{ flex: 1, padding: '9px 0', background: authMode === m ? 'rgba(168,85,247,0.2)' : 'transparent', border: 'none', color: authMode === m ? C.purple : C.muted, fontWeight: authMode === m ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input type="email" placeholder="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: C.white, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: C.white, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            {authError && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, textAlign: 'center' }}>{authError}</div>}
            <button onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '13px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 15, cursor: authLoading ? 'not-allowed' : 'pointer', opacity: authLoading ? 0.7 : 1, boxShadow: '0 0 24px rgba(168,85,247,0.3)' }}>
              {authLoading ? 'Please wait…' : authMode === 'signin' ? 'Sign In →' : 'Create Account →'}
            </button>
          </div>
        </div>
      )}

      {/* ── EXT MODAL ── */}
      {showExtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(14px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {(() => {
            const steps = [
              { icon: '📂', title: 'Open your Downloads folder',  body: 'Find the file camcash-extension.zip that just downloaded to your computer.' },
              { icon: '📦', title: 'Extract / Unzip the file',    body: 'Right-click the zip → "Extract All" (Windows) or double-click (Mac). You\'ll get a folder called camcash-extension.' },
              { icon: '🌐', title: 'Open Chrome Extensions',      body: 'In Chrome, go to chrome://extensions in the address bar and press Enter.' },
              { icon: '🔧', title: 'Enable Developer Mode',       body: 'Toggle on "Developer mode" in the top-right corner of the Extensions page.' },
              { icon: '📁', title: 'Load the extension',          body: 'Click "Load unpacked" → navigate to and select the extracted camcash-extension folder.' },
              { icon: '✅', title: 'You\'re live!',               body: 'Click the CamCash icon in your Chrome toolbar. Start streaming on Chaturbate — tips appear in your dashboard automatically.' },
            ];
            const isLast = extStep === steps.length - 1;
            const s = steps[extStep];
            return (
              <div style={{ background: '#0f1420', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 420, boxShadow: '0 0 60px rgba(168,85,247,0.2)', position: 'relative' }}>
                <button onClick={() => { setShowExtModal(false); setExtStep(0); }} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Step {extStep + 1} of {steps.length}</div>
                <div style={{ fontSize: 48, marginBottom: 14, textAlign: 'center' }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 10, textAlign: 'center' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, textAlign: 'center', marginBottom: 28 }}>{s.body}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{ width: i === extStep ? 20 : 6, height: 6, borderRadius: 3, background: i === extStep ? C.purple : i < extStep ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s ease' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {extStep > 0 && (
                    <button onClick={() => setExtStep(s => s - 1)} style={{ flex: 1, padding: '11px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ← Back
                    </button>
                  )}
                  {!isLast ? (
                    <button onClick={() => setExtStep(s => s + 1)} style={{ flex: 2, padding: '11px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                      Next →
                    </button>
                  ) : (
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => { setShowExtModal(false); setExtStep(0); setAuthMode('signup'); setShowAuthModal(true); }} style={{ width: '100%', padding: '11px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
                        Sign up to save & sync data →
                      </button>
                      <button onClick={() => { setShowExtModal(false); setExtStep(0); }} style={{ width: '100%', padding: '9px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        Continue in guest mode
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── DEMO HEADER ── */}
      <div style={{ background: 'rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.15)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.2)', fontSize: 10, fontWeight: 800, color: C.purple, letterSpacing: 1 }}>DEMO MODE</div>
          <span style={{ fontSize: 12, color: C.muted }}>This is a live simulation — sign in to use your real data</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowAuthModal(true)} style={{ padding: '7px 18px', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            Sign In / Sign Up
          </button>
          <a href="/" style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: C.muted, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
            ← Home
          </a>
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── DEMO HERO ── */}
        <div style={{ borderRadius: 16, padding: '28px 32px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(38,16,72,0.97), rgba(58,22,92,0.97))', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 0 60px rgba(168,85,247,0.2)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)', animation: 'cc-bar 2s ease infinite alternate' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green, boxShadow: `0 0 10px ${C.green}`, animation: 'cc-pulse 1.2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 1 }}>LIVE AI COACH DEMO</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(168,85,247,0.7)', fontWeight: 700, marginBottom: 6 }}>{coach.icon} {coach.context}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.white, lineHeight: 1.5, maxWidth: 520, animation: 'cc-slide 0.4s ease' }} key={demoCoachIdx}>
                {coach.action}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Revenue',     value: `$${demoRevenue.toFixed(2)}`, color: C.green  },
                { label: 'Tips/min',    value: '0.94',                       color: C.cyan   },
                { label: 'Rev/hr',      value: '$68',                        color: C.gold   },
                { label: 'Opportunity', value: '74/100',                     color: C.purple },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DEMO FEED + CTA ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>

          {/* Live tip feed simulation */}
          <div style={{ ...glassCard, borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Live Tip Feed — Demo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demoTips.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Tips will appear here as your stream progresses…</div>
              )}
              {demoTips.map((tip, i) => (
                <div key={tip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 9, background: i === 0 ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.02)', border: i === 0 ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.04)', animation: i === 0 ? 'cc-slide 0.35s ease' : 'none', opacity: 1 - i * 0.12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 14 }}>{tip.usd >= 10 ? '🐋' : '💰'}</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#c084fc' : C.white }}>{tip.username}</span>
                      {i === 0 && <span style={{ fontSize: 10, color: '#c084fc', marginLeft: 8, fontWeight: 800 }}>NEW ✨</span>}
                    </div>
                    <span style={{ fontSize: 11, color: C.cyan }}>{tip.tokens}t</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: tip.usd >= 10 ? C.gold : C.green }}>${tip.usd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ borderRadius: 14, padding: '22px 20px', background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(168,85,247,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔐</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 8 }}>This is a demo</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, marginBottom: 18 }}>Sign in to connect your real stream. Your actual tips, coaching, and session data will appear here automatically.</div>
              <button onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }} style={{ width: '100%', padding: '12px 0', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 8, boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
                Create Free Account →
              </button>
              <button onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }} style={{ width: '100%', padding: '10px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                Sign In
              </button>
              <a href="/live" style={{ display: 'block', padding: '9px 0', background: 'transparent', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 10, color: C.cyan, fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
                🔴 Go to Live Page →
              </a>
            </div>
            <div style={{ borderRadius: 14, padding: '18px 20px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🧩</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 6 }}>Auto-capture tips</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>Install the Chrome extension — tips appear here the moment they land.</div>
              <a href="/camcash-extension.zip" download="camcash-extension.zip" onClick={() => { setShowExtModal(true); setExtStep(0); }} style={{ display: 'block', padding: '9px 0', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>
                📥 Download Extension
              </a>
            </div>
          </div>
        </div>

        {/* ── FEATURES PREVIEW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { icon: '⚡', title: 'Real-time coaching',    desc: 'AI tells you exactly what to do as your room shifts — goals, whales, silence, momentum.' },
            { icon: '🎯', title: 'Goal pace predictor',   desc: "See if you're on track to hit your token goal at your current tip rate." },
            { icon: '🏆', title: 'Personal best tracker', desc: "Compare today's revenue against your all-time session record live." },
            { icon: '🐋', title: 'Whale alerts',          desc: 'Instantly notified when a high-value tipper is dominating your session revenue.' },
            { icon: '🚨', title: 'Silence detection',     desc: 'Alerts when the room stalls with a ranked list of recovery actions.' },
            { icon: '⏳', title: 'Peak hour countdown',   desc: 'Know when your historically highest-earning window is ending.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ ...glassCard, borderRadius: 12, padding: '16px 16px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
