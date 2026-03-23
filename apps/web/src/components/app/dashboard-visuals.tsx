'use client';

import { ArrowUpRight } from 'lucide-react';

export type ChartDatum = {
  label: string;
  value: number;
  tone: string;
  detail?: string;
};

export function aggregateMetric(
  metrics: Array<{ type: string; value: number; unit: string }>,
  type: string
) {
  const matching = metrics.filter((metric) => metric.type === type);

  if (matching.length === 0) {
    return { value: 0, unit: '%' };
  }

  const total = matching.reduce((sum, metric) => sum + metric.value, 0);

  return {
    value: total / matching.length,
    unit: matching[0]?.unit ?? '%'
  };
}

export function formatCompact(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

export function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

export function GaugeRing({
  value,
  total,
  label,
  caption
}: {
  value: number;
  total: number;
  label: string;
  caption: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - circumference * ratio;

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="url(#dashboard-gauge)"
          strokeLinecap="round"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <defs>
          <linearGradient id="dashboard-gauge" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="glass-panel flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/60 text-center shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)] dark:border-white/10">
        <span className="font-display text-3xl font-semibold">{formatPercent(ratio * 100)}</span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</span>
        <span className="mt-2 text-xs text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}

export function ProgressRail({ items }: { items: Array<ChartDatum> }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
              <span className="font-medium text-foreground">{item.label}</span>
            </div>
            <div className="text-right">
              <span className="font-display text-base font-semibold text-foreground">{formatCompact(item.value)}</span>
              {item.detail ? <p className="text-[11px] text-muted-foreground">{item.detail}</p> : null}
            </div>
          </div>
          <div className="shimmer-line h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
            <div
              className={`h-full rounded-full ${item.tone} shadow-[0_14px_22px_-14px_rgba(15,23,42,0.45)]`}
              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerticalMetricChart({ items }: { items: Array<ChartDatum> }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-[1.6rem] border border-white/50 bg-white/55 p-4 text-center dark:border-white/10 dark:bg-white/5">
          <div className="mx-auto flex h-40 w-full max-w-[76px] items-end justify-center rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.12))] p-2 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
            <div
              className={`signal-beam relative w-full rounded-[1rem] ${item.tone} shadow-[0_22px_34px_-24px_rgba(15,23,42,0.7)]`}
              style={{ height: `${Math.max((item.value / maxValue) * 100, 12)}%` }}
            >
              <span className="absolute inset-x-2 top-2 h-2 rounded-full bg-white/45" />
            </div>
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">{item.value.toFixed(1)}%</p>
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="perspective-card rounded-[1.8rem] border border-white/55 bg-white/70 p-5 shadow-[0_22px_44px_-28px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <span className={`h-11 w-11 rounded-[1.1rem] ${tone} shadow-[0_18px_30px_-20px_rgba(15,23,42,0.6)]`} />
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
