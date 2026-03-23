'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { getMe } from '@/lib/auth/client';
import { clearAuthSession } from '@/lib/auth/storage';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: getMe
  });

  useEffect(() => {
    if (isError) {
      clearAuthSession();
      router.replace('/sign-in');
    }
  }, [isError, router]);

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-panel neo-shadow surface-highlight float-soft rounded-[2rem] border border-white/50 px-8 py-7 text-center dark:border-white/10">
          <div className="mx-auto mb-4 h-16 w-16 rounded-[1.5rem] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(82,205,201,0.24),rgba(15,23,42,0.02))] shadow-[0_20px_40px_-18px_rgba(24,24,27,0.55)] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.16),rgba(56,189,248,0.38),rgba(2,6,23,0.1))]" />
          <p className="font-display text-lg font-semibold">Loading workspace...</p>
          <p className="mt-1 text-sm text-muted-foreground">Syncing tenant signals and operational layers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-3 md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1720px] gap-4 lg:gap-5">
        <Sidebar />
        <div className="glass-panel neo-shadow surface-highlight relative flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(82,205,201,0.18),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_65%)]" />
          <Topbar user={data} />
          <main className="relative flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
