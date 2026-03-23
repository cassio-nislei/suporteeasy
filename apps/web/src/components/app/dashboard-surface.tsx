'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  Bot,
  Gauge,
  HardDrive,
  Layers3,
  Radar,
  ShieldAlert,
  Sparkles,
  Wallet
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/auth/client';
import { billingMonthlySummary, getDashboardOverview, listPatches, listRemoteSessions, type DeviceStatusEvent } from '@/lib/api/operations';
import { useDeviceStatusSocket } from '@/lib/realtime/use-device-status-socket';
import {
  GaugeRing,
  ProgressRail,
  StatTile,
  VerticalMetricChart,
  aggregateMetric,
  formatCompact,
  formatCurrency,
  formatPercent,
  type ChartDatum
} from './dashboard-visuals';

export function DashboardSurface() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const overviewQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview
  });

  const billingSummaryQuery = useQuery({
    queryKey: ['dashboard-billing-summary'],
    queryFn: () => billingMonthlySummary({})
  });

  const patchQuery = useQuery({
    queryKey: ['dashboard-patches'],
    queryFn: () => listPatches({ page: 1, limit: 1 })
  });

  const remoteQuery = useQuery({
    queryKey: ['dashboard-remote-sessions'],
    queryFn: () => listRemoteSessions({ page: 1, limit: 1, status: 'active' })
  });

  const onStatusUpdate = useCallback(
    (_event: DeviceStatusEvent) => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    [queryClient]
  );

  useDeviceStatusSocket(meQuery.data?.tenantId, onStatusUpdate);

  const counts = overviewQuery.data?.counts;
  const metrics = overviewQuery.data?.latestMetrics ?? [];
  const tenantName = meQuery.data?.tenant?.name ?? 'Your Tenant';
  const totalDevices = counts?.devices.total ?? 0;
  const onlineDevices = counts?.devices.online ?? 0;
  const offlineDevices = counts?.devices.offline ?? 0;
  const unknownDevices = counts?.devices.unknown ?? 0;
  const onlineRate = totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0;
  const cpu = aggregateMetric(metrics, 'cpu');
  const ram = aggregateMetric(metrics, 'ram');
  const disk = aggregateMetric(metrics, 'disk');

  const fleetStatus: Array<ChartDatum> = [
    { label: 'Online', value: onlineDevices, tone: 'bg-teal-500', detail: 'Heartbeat stable' },
    { label: 'Offline', value: offlineDevices, tone: 'bg-rose-500', detail: 'Recovery attention' },
    { label: 'Unknown', value: unknownDevices, tone: 'bg-amber-400', detail: 'Pending telemetry' }
  ];

  const revenueSignals: Array<ChartDatum> = [
    { label: 'Recognized', value: billingSummaryQuery.data?.revenue?.recognized ?? 0, tone: 'bg-teal-500', detail: 'Booked this month' },
    { label: 'Projected', value: billingSummaryQuery.data?.revenue?.projected ?? 0, tone: 'bg-sky-500', detail: 'Expected run-rate' },
    { label: 'Outstanding', value: billingSummaryQuery.data?.invoices?.outstanding ?? 0, tone: 'bg-amber-500', detail: 'Needs collection' },
    { label: 'MRR', value: billingSummaryQuery.data?.subscriptions?.recurringMonthly ?? 0, tone: 'bg-orange-500', detail: 'Recurring subscriptions' }
  ];

  const executionSignals: Array<ChartDatum> = [
    { label: 'Queued Scripts', value: counts?.scripts?.queued ?? 0, tone: 'bg-cyan-500', detail: 'Awaiting dispatch' },
    { label: 'Running Scripts', value: counts?.scripts?.running ?? 0, tone: 'bg-teal-500', detail: 'Active execution' },
    { label: 'Failed Scripts', value: counts?.scripts?.failed ?? 0, tone: 'bg-rose-500', detail: 'Needs review' },
    { label: 'Automation Failures', value: counts?.automations?.failedLast24h ?? 0, tone: 'bg-orange-500', detail: 'Last 24h' }
  ];

  const pressureSignals: Array<ChartDatum> = [
    { label: 'Open Tickets', value: counts?.tickets.open ?? 0, tone: 'bg-sky-500', detail: 'Current backlog' },
    { label: 'Critical Alerts', value: counts?.alerts.criticalOpen ?? 0, tone: 'bg-rose-500', detail: 'Immediate action' },
    { label: 'SLA At Risk', value: counts?.sla.atRisk ?? 0, tone: 'bg-amber-500', detail: 'Near breach' },
    { label: 'SLA Breached', value: counts?.sla.breached ?? 0, tone: 'bg-orange-500', detail: 'Out of policy' }
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="glass-panel neo-shadow surface-highlight perspective-card overflow-hidden border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.58))] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.72))]">
          <CardContent className="relative p-0">
            <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[linear-gradient(90deg,rgba(82,205,201,0.18),rgba(255,157,102,0.24))] px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-foreground/75 dark:bg-[linear-gradient(90deg,rgba(56,189,248,0.18),rgba(251,146,60,0.24))]">Ops Horizon</span>
                  <span className="rounded-full border border-white/60 px-3 py-1 text-xs text-muted-foreground dark:border-white/10">Live telemetry + revenue posture</span>
                </div>

                <div className="max-w-2xl">
                  <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">A command dashboard that feels alive, not just populated.</h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
                    {tenantName} now gets a cinematic operations surface with instant status scanning,
                    better financial context and visual depth that makes the product feel current.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <StatTile label="Online Fleet" value={formatPercent(onlineRate)} detail={`${onlineDevices} of ${totalDevices} devices healthy`} tone="bg-[linear-gradient(180deg,#14b8a6,#0f766e)]" />
                  <StatTile label="Projected Revenue" value={`$${formatCompact(billingSummaryQuery.data?.revenue?.projected ?? 0)}`} detail="This month's expected throughput" tone="bg-[linear-gradient(180deg,#38bdf8,#0369a1)]" />
                  <StatTile label="Pressure Index" value={formatCompact((counts?.tickets.open ?? 0) + (counts?.alerts.criticalOpen ?? 0))} detail="Open tickets plus critical alerts" tone="bg-[linear-gradient(180deg,#fb923c,#ea580c)]" />
                </div>
              </div>

              <div className="relative">
                <div className="float-soft absolute right-6 top-2 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.96),rgba(82,205,201,0.22),transparent_65%)] blur-[2px] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),rgba(56,189,248,0.26),transparent_65%)]" />
                <div className="space-y-4 rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.5))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Fleet stability</p>
                      <h2 className="font-display text-2xl font-semibold">Operational ring</h2>
                    </div>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-muted-foreground dark:bg-white/5">Live</span>
                  </div>

                  <GaugeRing value={onlineDevices} total={totalDevices} label="availability" caption={`${offlineDevices} offline / ${unknownDevices} unknown`} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    {fleetStatus.map((item) => (
                      <div key={item.label} className="rounded-[1.2rem] border border-white/50 bg-white/65 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">{item.label}</p>
                        <p className="mt-2 font-display text-2xl font-semibold">{formatCompact(item.value)}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.32em]">System pressure</CardDescription>
              <CardTitle>Critical response map</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressRail items={pressureSignals} />
            </CardContent>
          </Card>

          <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Execution engine</CardDescription>
              <CardTitle>Automation pulse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ProgressRail items={executionSignals} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-3 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                    <span className="text-sm font-medium">Automations 24h</span>
                  </div>
                  <p className="font-display text-3xl font-semibold">{formatCompact(counts?.automations?.runsLast24h ?? 0)}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-orange-600 dark:text-orange-300" />
                    <span className="text-sm font-medium">Patch backlog</span>
                  </div>
                  <p className="font-display text-3xl font-semibold">{formatCompact(patchQuery.data?.meta.total ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Clients" value={formatCompact(counts?.clients ?? 0)} detail="Managed organizations onboarded" tone="bg-[linear-gradient(180deg,#38bdf8,#0284c7)]" />
        <StatTile label="Contacts" value={formatCompact(counts?.contacts ?? 0)} detail="Primary operational relationships" tone="bg-[linear-gradient(180deg,#14b8a6,#0f766e)]" />
        <StatTile label="Remote Sessions" value={formatCompact(remoteQuery.data?.meta.total ?? 0)} detail="Sessions active right now" tone="bg-[linear-gradient(180deg,#fb923c,#f97316)]" />
        <StatTile label="Critical Alerts" value={formatCompact(counts?.alerts.criticalOpen ?? 0)} detail="Priority events in the queue" tone="bg-[linear-gradient(180deg,#fb7185,#e11d48)]" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Telemetry graph</CardDescription>
            <CardTitle>Infrastructure load snapshots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <VerticalMetricChart items={[{ label: 'CPU', value: cpu.value, tone: 'bg-[linear-gradient(180deg,#38bdf8,#0369a1)]' }, { label: 'RAM', value: ram.value, tone: 'bg-[linear-gradient(180deg,#14b8a6,#0f766e)]' }, { label: 'Disk', value: disk.value, tone: 'bg-[linear-gradient(180deg,#fb923c,#ea580c)]' }]} />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex items-center gap-2"><Gauge className="h-4 w-4 text-sky-600 dark:text-sky-300" /><span className="text-sm font-medium">CPU Cluster</span></div>
                <p className="font-display text-3xl font-semibold">{cpu.value.toFixed(1)}{cpu.unit}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-300" /><span className="text-sm font-medium">RAM Cluster</span></div>
                <p className="font-display text-3xl font-semibold">{ram.value.toFixed(1)}{ram.unit}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex items-center gap-2"><HardDrive className="h-4 w-4 text-orange-600 dark:text-orange-300" /><span className="text-sm font-medium">Disk Cluster</span></div>
                <p className="font-display text-3xl font-semibold">{disk.value.toFixed(1)}{disk.unit}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Commercial graph</CardDescription>
            <CardTitle>Revenue and cash posture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProgressRail items={revenueSignals} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/50 bg-[linear-gradient(180deg,rgba(82,205,201,0.18),rgba(255,255,255,0.58))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(255,255,255,0.02))]">
                <div className="mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-teal-600 dark:text-cyan-300" /><span className="text-sm font-medium">Recognized revenue</span></div>
                <p className="font-display text-3xl font-semibold">${formatCurrency(billingSummaryQuery.data?.revenue?.recognized)}</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/50 bg-[linear-gradient(180deg,rgba(255,157,102,0.18),rgba(255,255,255,0.58))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(251,146,60,0.14),rgba(255,255,255,0.02))]">
                <div className="mb-3 flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-orange-600 dark:text-orange-300" /><span className="text-sm font-medium">Projected revenue</span></div>
                <p className="font-display text-3xl font-semibold">${formatCurrency(billingSummaryQuery.data?.revenue?.projected)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr_0.9fr]">
        <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Service load</CardDescription>
            <CardTitle>Escalation ladder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pressureSignals.map((item) => (
              <div key={item.label} className="rounded-[1.4rem] border border-white/50 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} /><span className="text-sm font-medium">{item.label}</span></div>
                  <span className="font-display text-2xl font-semibold">{formatCompact(item.value)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Realtime matrix</CardDescription>
            <CardTitle>Operational focus board</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-300" /><span className="text-sm font-medium">SLA posture</span></div>
              <p className="font-display text-3xl font-semibold">{formatCompact(counts?.sla.breached ?? 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Breached tickets requiring active intervention.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center gap-2"><Radar className="h-4 w-4 text-sky-600 dark:text-sky-300" /><span className="text-sm font-medium">Open incidents</span></div>
              <p className="font-display text-3xl font-semibold">{formatCompact(counts?.tickets.open ?? 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Current ticket volume across the active tenant queue.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-teal-600 dark:text-teal-300" /><span className="text-sm font-medium">24h script runs</span></div>
              <p className="font-display text-3xl font-semibold">{formatCompact(counts?.scripts?.last24h ?? 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Execution throughput in the last 24 hours.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center gap-2"><Layers3 className="h-4 w-4 text-orange-600 dark:text-orange-300" /><span className="text-sm font-medium">Remote access</span></div>
              <p className="font-display text-3xl font-semibold">{formatCompact(remoteQuery.data?.meta.total ?? 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Sessions active for field or support intervention.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel neo-shadow surface-highlight overflow-hidden">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.32em]">Executive glance</CardDescription>
            <CardTitle>North-star summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.6rem] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(82,205,201,0.14))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(56,189,248,0.12))]">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Projected month</p>
              <p className="mt-3 font-display text-4xl font-semibold">${formatCurrency(billingSummaryQuery.data?.revenue?.projected)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Balanced against ${formatCurrency(billingSummaryQuery.data?.invoices?.outstanding)} outstanding.</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/50 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Availability tone</p>
              <p className="mt-3 font-display text-4xl font-semibold">{formatPercent(onlineRate)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{offlineDevices} offline devices are shaping the support queue today.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
