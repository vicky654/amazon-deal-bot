'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getToken } from '../lib/auth';
import AdminShell from './AdminShell';

export default function AuthGuard({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isLogin  = pathname === '/admin/login';

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token && !isLogin) {
      router.replace('/admin/login');
    } else {
      setReady(true);
    }
  }, [isLogin, router]);

  // Login page — full-screen, no shell
  if (isLogin) {
    return <>{children}</>;
  }

  // Checking auth — brief blank while redirecting
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-xl animate-pulse">
            🔥
          </div>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
