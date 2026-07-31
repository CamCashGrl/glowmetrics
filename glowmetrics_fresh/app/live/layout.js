'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Sidebar from '../dashboard/Sidebar';

// Live Mode shares the real dashboard Sidebar (nav labels, Pro badge, sign
// out) instead of its own separate icon rail — same component, same user/
// plan data shape as the dashboard, just routed instead of tab-switched.
export default function LiveLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      setUser(u);
      supabase.from('profiles').select('plan').eq('id', u.id).maybeSingle()
        .then(({ data }) => { if (data) setIsPro(data.plan === 'pro' || data.plan === 'unlimited'); });
    });
  }, []);

  const handleTabChange = (tab) => {
    if (tab === 'live') { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    if (typeof window !== 'undefined') localStorage.setItem('camcash_tab', tab);
    router.push(`/dashboard?tab=${tab}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030812' }}>
      <Sidebar activeTab="live" onTabChange={handleTabChange} user={user} onSignOut={handleSignOut} isPro={isPro} />
      <div className="live-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minWidth: 0, boxSizing: 'border-box' }}>
        {children}
      </div>
      <style jsx global>{`
        @media (max-width: 768px) {
          .live-main { margin-left: 0 !important; width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
