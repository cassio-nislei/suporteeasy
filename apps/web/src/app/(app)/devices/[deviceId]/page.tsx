'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getMe } from '@/lib/auth/client';
import {
  getDevice,
  getDeviceMetrics,
  updateDevice,
  type DeviceStatusEvent
} from '@/lib/api/operations';
import { useDeviceStatusSocket } from '@/lib/realtime/use-device-status-socket';

export default function DeviceDetailPage() {
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const queryClient = useQueryClient();

  const [metricType, setMetricType] = useState<'cpu' | 'ram' | 'disk'>('cpu');
  const [notes, setNotes] = useState('');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const deviceQuery = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => getDevice(deviceId)
  });

  useEffect(() => {
    setNotes(deviceQuery.data?.notes || '');
  }, [deviceQuery.data?.notes]);

  const metricsQuery = useQuery({
    queryKey: ['device-metrics', deviceId, metricType],
    queryFn: () => getDeviceMetrics(deviceId, { type: metricType, page: 1, limit: 24 })
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateDevice(deviceId, {
        notes
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  });

  const onStatusUpdate = useCallback(
    (event: DeviceStatusEvent) => {
      if (event.deviceId !== deviceId) {
        return;
      }

      queryClient.setQueryData(['device', deviceId], (previous: unknown) => {
        if (!previous || typeof previous !== 'object') {
          return previous;
        }

        return {
          ...(previous as Record<string, unknown>),
          onlineStatus: event.onlineStatus,
          lastHeartbeatAt: event.lastHeartbeatAt
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
    [deviceId, queryClient]
  );

  useDeviceStatusSocket(meQuery.data?.tenantId, onStatusUpdate);

  const metricPoints = useMemo(() => {
    const items = metricsQuery.data?.items ?? [];
    const ordered = [...items].reverse();
    const maxValue = Math.max(1, ...ordered.map((item) => item.value));

    return ordered.map((item) => ({
      ...item,
      percent: Math.max(4, Math.round((item.value / maxValue) * 100))
    }));
  }, [metricsQuery.data?.items]);

  const device = deviceQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Device Detail</h1>
        <p className="text-sm text-muted-foreground">{device?.hostname ?? 'Loading...'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Operational Status</CardTitle>
            <CardDescription>Real-time heartbeat view</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <strong>Status:</strong>{' '}
              <span
                className={`rounded px-2 py-1 text-xs ${
                  device?.onlineStatus === 'online'
                    ? 'bg-emerald-100 text-emerald-700'
                    : device?.onlineStatus === 'offline'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {device?.onlineStatus ?? '-'}
              </span>
            </p>
            <p>
              <strong>Last heartbeat:</strong> {device?.lastHeartbeatAt ?? '-'}
            </p>
            <p>
              <strong>Agent version:</strong> {device?.agent?.version ?? '-'}
            </p>
            <p>
              <strong>Agent state:</strong> {device?.agent?.status ?? '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
            <CardDescription>Identity and ownership</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <strong>IP:</strong> {device?.ipAddress ?? '-'}
            </p>
            <p>
              <strong>OS:</strong> {device?.os ?? '-'}
            </p>
            <p>
              <strong>Client:</strong>{' '}
              {device?.clientId && typeof device.clientId === 'object'
                ? device.clientId.name
                : 'Unassigned'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Stored hardware data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <strong>CPU:</strong> {device?.inventory.cpuModel || '-'} ({device?.inventory.cpuCores || 0} cores)
            </p>
            <p>
              <strong>RAM:</strong> {device?.inventory.ramGb || 0} GB
            </p>
            <p>
              <strong>Disk:</strong> {device?.inventory.diskGb || 0} GB
            </p>
            <p>
              <strong>Serial:</strong> {device?.inventory.serialNumber || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Notes</CardTitle>
          <CardDescription>Editable operational context.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metrics Chart Placeholder</CardTitle>
          <CardDescription>Rendered from real stored metrics data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(['cpu', 'ram', 'disk'] as const).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={metricType === type ? 'default' : 'outline'}
                onClick={() => setMetricType(type)}
              >
                {type.toUpperCase()}
              </Button>
            ))}
          </div>

          <div className="flex h-44 items-end gap-1 rounded-md border bg-muted/20 p-3">
            {metricPoints.map((point) => (
              <div key={point._id} className="group relative flex-1">
                <div
                  className="w-full rounded-sm bg-primary/80 transition-opacity group-hover:opacity-90"
                  style={{ height: `${point.percent}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-[10px] text-white group-hover:block">
                  {point.value}
                  {point.unit}
                </div>
              </div>
            ))}
            {metricPoints.length === 0 ? (
              <p className="text-xs text-muted-foreground">No metrics available for this type.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Timeline basis for device events.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(device?.recentActivity.items ?? []).map((activity) => (
              <li key={activity._id} className="rounded border p-2">
                <p className="font-medium">{activity.type}</p>
                <p className="text-muted-foreground">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.occurredAt}</p>
              </li>
            ))}
            {(device?.recentActivity.items ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">No activity yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
