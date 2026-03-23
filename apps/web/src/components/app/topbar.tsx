'use client';

import type { MeResponse } from '@/lib/auth/client';
import { Breadcrumbs } from './breadcrumbs';
import { NotificationCenter } from './notification-center';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Topbar({ user }: { user: MeResponse }) {
  return (
    <header className="relative border-b border-black/5 px-4 py-4 dark:border-white/10 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground shadow-[0_10px_25px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/5">
              Command Surface
            </span>
            <span className="rounded-full bg-[linear-gradient(90deg,rgba(82,205,201,0.16),rgba(255,157,102,0.16))] px-3 py-1 text-xs text-foreground/80 dark:bg-[linear-gradient(90deg,rgba(56,189,248,0.14),rgba(251,146,60,0.14))]">
              Tenant: {user.tenant?.name ?? 'Platform'}
            </span>
          </div>
          <div className="space-y-1">
            <Breadcrumbs />
            <p className="text-sm text-muted-foreground">
              Live overview for <span className="font-medium text-foreground">{user.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/5">
            <span className="hud-dot ml-3 text-emerald-600 dark:text-emerald-400">Realtime sync</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-2 py-2 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/5">
            <NotificationCenter />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
