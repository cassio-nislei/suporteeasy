'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  reportAlertsBySeverity,
  reportAssetsByClient,
  reportRevenueSummary,
  reportScriptExecutionStats,
  reportSlaCompliance,
  reportTicketsByPeriod
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ReportsPage() {
  const { push } = useToast();
  const ticketsQuery = useQuery({
    queryKey: ['reports-tickets'],
    queryFn: () => reportTicketsByPeriod({})
  });
  const alertsQuery = useQuery({
    queryKey: ['reports-alerts'],
    queryFn: () => reportAlertsBySeverity({})
  });
  const assetsQuery = useQuery({
    queryKey: ['reports-assets'],
    queryFn: () => reportAssetsByClient({})
  });
  const slaQuery = useQuery({
    queryKey: ['reports-sla'],
    queryFn: () => reportSlaCompliance({})
  });
  const scriptsQuery = useQuery({
    queryKey: ['reports-scripts'],
    queryFn: () => reportScriptExecutionStats({})
  });
  const revenueQuery = useQuery({
    queryKey: ['reports-revenue'],
    queryFn: () => reportRevenueSummary({})
  });

  async function exportReport(type: 'tickets' | 'alerts' | 'assets' | 'sla' | 'scripts' | 'revenue') {
    try {
      const csv =
        type === 'tickets'
          ? ((await reportTicketsByPeriod({ format: 'csv' })) as string)
          : type === 'alerts'
            ? ((await reportAlertsBySeverity({ format: 'csv' })) as string)
            : type === 'assets'
              ? ((await reportAssetsByClient({ format: 'csv' })) as string)
              : type === 'sla'
                ? ((await reportSlaCompliance({ format: 'csv' })) as string)
                : type === 'scripts'
                  ? ((await reportScriptExecutionStats({ format: 'csv' })) as string)
                  : ((await reportRevenueSummary({ format: 'csv' })) as string);
      downloadCsv(csv, `${type}-report.csv`);
      push({ title: 'CSV exported', variant: 'success' });
    } catch (error) {
      push({ title: 'Export failed', description: (error as Error).message, variant: 'error' });
    }
  }

  const tickets = ticketsQuery.data as
    | {
        rows: Array<{ period: string; total: number; open: number; resolved: number }>;
      }
    | undefined;
  const alerts = alertsQuery.data as { rows: Array<{ severity: string; total: number }> } | undefined;
  const assets = assetsQuery.data as
    | {
        summary: { clients: number; devices: number; contacts: number };
        rows: Array<{ clientName: string; devices: number; contacts: number }>;
      }
    | undefined;
  const sla = slaQuery.data as
    | {
        firstResponse: { met: number; breached: number; compliance: number };
        resolution: { met: number; breached: number; compliance: number };
      }
    | undefined;
  const scripts = scriptsQuery.data as
    | {
        totals: {
          total: number;
          queued: number;
          running: number;
          success: number;
          failed: number;
          avgDurationSeconds: number;
        };
      }
    | undefined;
  const revenue = revenueQuery.data as
    | {
        totals: { invoices: number; billed: number; paid: number; overdue: number; recurringMonthly: number };
      }
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Operational and business analytics backed by real data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tickets By Period</CardTitle>
            <CardDescription>Trend report for incident volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('tickets')}>
              Export CSV
            </Button>
            {(tickets?.rows ?? []).slice(-7).map((row) => (
              <div key={row.period} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>{row.period}</span>
                <span>{row.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts By Severity</CardTitle>
            <CardDescription>Criticality distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('alerts')}>
              Export CSV
            </Button>
            {(alerts?.rows ?? []).map((row) => (
              <div key={row.severity} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span className="uppercase">{row.severity}</span>
                <span>{row.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets By Client</CardTitle>
            <CardDescription>Device/contact distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('assets')}>
              Export CSV
            </Button>
            <p className="text-sm text-muted-foreground">
              Clients: {assets?.summary.clients ?? 0} · Devices: {assets?.summary.devices ?? 0} · Contacts:{' '}
              {assets?.summary.contacts ?? 0}
            </p>
            {(assets?.rows ?? []).slice(0, 5).map((row) => (
              <div key={row.clientName} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>{row.clientName}</span>
                <span>
                  {row.devices} devices / {row.contacts} contacts
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA Compliance</CardTitle>
            <CardDescription>First response and resolution conformance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('sla')}>
              Export CSV
            </Button>
            <p>
              First response: {sla?.firstResponse.compliance ?? 0}% ({sla?.firstResponse.met ?? 0} met /{' '}
              {sla?.firstResponse.breached ?? 0} breached)
            </p>
            <p>
              Resolution: {sla?.resolution.compliance ?? 0}% ({sla?.resolution.met ?? 0} met /{' '}
              {sla?.resolution.breached ?? 0} breached)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Script Execution Stats</CardTitle>
            <CardDescription>Queue throughput and failures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('scripts')}>
              Export CSV
            </Button>
            <p>Total: {scripts?.totals.total ?? 0}</p>
            <p>
              Q/R/S/F: {scripts?.totals.queued ?? 0} / {scripts?.totals.running ?? 0} /{' '}
              {scripts?.totals.success ?? 0} / {scripts?.totals.failed ?? 0}
            </p>
            <p>Avg duration: {scripts?.totals.avgDurationSeconds ?? 0}s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
            <CardDescription>Billed, paid and recurring values.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => exportReport('revenue')}>
              Export CSV
            </Button>
            <p>Invoices: {revenue?.totals.invoices ?? 0}</p>
            <p>Billed: ${revenue?.totals.billed ?? 0}</p>
            <p>Paid: ${revenue?.totals.paid ?? 0}</p>
            <p>Overdue: ${revenue?.totals.overdue ?? 0}</p>
            <p>Recurring monthly: ${revenue?.totals.recurringMonthly ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
