'use client';
import { useRouter, usePathname } from 'next/navigation';

export default function LiveLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#040812',
    }}>
      {children}
    </div>
  );
}
