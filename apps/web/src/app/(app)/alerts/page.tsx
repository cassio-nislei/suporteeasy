'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  acknowledgeAlert,
  createTicketFromAlert,
  listAlerts,
  resolveAlert,
  type AlertRecord
} from '@/lib/api/operations';

function statusClass(status: AlertRecord['status']) {
  if (status === 'open') return 'bg-red-100 text-red-700';
  if (status === 'acknowledged') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'open' | 'acknowledged' | 'resolved'>('');
  const [severity, setSeverity] = useState<'' | 'critical' | 'high' | 'medium' | 'low'>('');

  const alertsQuery = useQuery({
    queryKey: ['alerts', page, search, status, severity],
    queryFn: () =>
      listAlerts({
        page,
        limit: 15,
        search,
        status: status || undefined,
        severity: severity || undefined
      })
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => resolveAlert(alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: (alertId: string) => createTicketFromAlert(alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const items = alertsQuery.data?.items ?? [];
  const meta = alertsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Active incidents generated from rules and monitoring signals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and narrow alert backlog.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input
            placeholder="Search by title or message"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | 'open' | 'acknowledged' | 'resolved');
              setPage(1);
            }}
          >
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as '' | 'critical' | 'high' | 'medium' | 'low');
              setPage(1);
            }}
          >
            <option value="">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert List</CardTitle>
          <CardDescription>Trigger, acknowledge, resolve and open ticket flow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Device</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Ticket</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const deviceLabel =
                    item.deviceId && typeof item.deviceId === 'object'
                      ? item.deviceId.hostname
                      : 'Unknown device';
                  const hasTicket = Boolean(item.ticketId);
                  const ticketId =
                    item.ticketId && typeof item.ticketId === 'object' ? item.ticketId._id : String(item.ticketId);

                  return (
                    <tr key={item._id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.message}</p>
                      </td>
                      <td className="px-3 py-2">{deviceLabel}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {hasTicket ? (
                          <Link href={`/tickets/${ticketId}`} className="text-xs font-medium text-blue-700 hover:underline">
                            View ticket
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">No ticket</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeMutation.mutate(item._id)}
                            disabled={item.status !== 'open' || acknowledgeMutation.isPending}
                          >
                            Ack
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => resolveMutation.mutate(item._id)}
                            disabled={item.status === 'resolved' || resolveMutation.isPending}
                          >
                            Resolve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => createTicketMutation.mutate(item._id)}
                            disabled={hasTicket || createTicketMutation.isPending}
                          >
                            Create Ticket
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!alertsQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No alerts found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {meta?.page ?? 1} of {meta?.totalPages ?? 1} ({meta?.total ?? 0} records)
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(meta && page >= meta.totalPages)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
