'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Cable,
  ChartColumnBig,
  ClipboardList,
  Cpu,
  FileBarChart2,
  FileDigit,
  FileKey2,
  FileStack,
  Gauge,
  Layers3,
  LayoutGrid,
  LifeBuoy,
  Orbit,
  PanelsTopLeft,
  Radar,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/clients', label: 'Clients', icon: BriefcaseBusiness },
  { href: '/devices', label: 'Devices', icon: Cpu },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/alerts/rules', label: 'Alert Rules', icon: Radar },
  { href: '/tickets', label: 'Tickets', icon: ClipboardList },
  { href: '/scripts', label: 'Scripts', icon: FileDigit },
  { href: '/scripts/executions', label: 'Script Runs', icon: Activity },
  { href: '/automations', label: 'Automations', icon: Orbit },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: ScrollText },
  { href: '/contracts', label: 'Contracts', icon: FileStack },
  { href: '/billing', label: 'Billing', icon: ChartColumnBig },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/audit', label: 'Audit Logs', icon: ShieldCheck },
  { href: '/patch-management', label: 'Patch Mgmt', icon: Layers3 },
  { href: '/remote-access', label: 'Remote Access', icon: PanelsTopLeft },
  { href: '/integrations', label: 'Integrations', icon: Cable },
  { href: '/settings', label: 'Settings', icon: Settings2 },
  { href: '/api-keys', label: 'API Keys', icon: FileKey2 },
  { href: '/onboarding', label: 'Onboarding', icon: Sparkles }
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <aside className="hidden w-[296px] shrink-0 lg:block">
      <div className="glass-panel neo-shadow surface-highlight sticky top-5 flex h-[calc(100vh-2.5rem)] flex-col rounded-[2rem] border border-white/50 p-4 dark:border-white/10">
        <div className="mb-6 rounded-[1.6rem] border border-white/50 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="mb-4 flex items-center gap-3">
            <div className="float-soft flex h-12 w-12 items-center justify-center rounded-[1.3rem] bg-[conic-gradient(from_210deg,_rgba(82,205,201,0.95),_rgba(255,157,102,0.92),_rgba(82,205,201,0.92))] shadow-[0_20px_35px_-18px_rgba(13,148,136,0.85)]">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">Easyli SaaS</p>
              <h1 className="font-display text-xl font-semibold">Control Deck</h1>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[1.2rem] border border-black/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(82,205,201,0.14))] px-3 py-2 text-xs dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(56,189,248,0.14))]">
            <span className="hud-dot ml-3 text-emerald-600 dark:text-emerald-400">Live sync</span>
            <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] dark:bg-white/10">
              Ops
            </span>
          </div>
        </div>

        <div className="mb-3 px-2 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">Workspace</div>
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-[1.1rem] px-3 py-3 text-sm transition-all duration-200',
                  active
                    ? 'border border-white/60 bg-[linear-gradient(135deg,rgba(82,205,201,0.2),rgba(255,255,255,0.88))] text-foreground shadow-[0_18px_32px_-20px_rgba(13,148,136,0.6)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(56,189,248,0.22),rgba(15,23,42,0.95))]'
                    : 'border border-transparent text-muted-foreground hover:border-white/50 hover:bg-white/55 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5'
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-[0.95rem] border transition-all duration-200',
                    active
                      ? 'border-white/70 bg-white/80 text-teal-700 dark:border-white/10 dark:bg-white/10 dark:text-cyan-300'
                      : 'border-black/5 bg-white/50 text-muted-foreground group-hover:text-foreground dark:border-white/10 dark:bg-white/5'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-[1.5rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.48))] p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
          <div className="mb-2 flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-teal-600 dark:text-cyan-300" />
            <p className="font-display text-sm font-semibold">Experience Layer</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Modernized surfaces, ambient depth and live operational context tuned for faster scanning.
          </p>
          <div className="signal-beam mt-4 h-1 rounded-full bg-[linear-gradient(90deg,rgba(82,205,201,0.8),rgba(255,157,102,0.8))] dark:bg-[linear-gradient(90deg,rgba(56,189,248,0.8),rgba(251,146,60,0.8))]" />
        </div>
      </div>
    </aside>
  );
}
