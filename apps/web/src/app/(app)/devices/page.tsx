'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getMe } from '@/lib/auth/client';
import {
  createDevice,
  listClients,
  listDevices,
  updateDevice,
  type DeviceRecord,
  type DeviceStatusEvent
} from '@/lib/api/operations';
import { useDeviceStatusSocket } from '@/lib/realtime/use-device-status-socket';

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'online' | 'offline' | 'unknown' | ''>('');
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);

  const [clientId, setClientId] = useState('');
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [os, setOs] = useState('Windows 11 Pro');
  const [tags, setTags] = useState('production');
  const [notes, setNotes] = useState('');
  const [cpuCores, setCpuCores] = useState('8');
  const [ramGb, setRamGb] = useState('16');
  const [diskGb, setDiskGb] = useState('512');
  const [serialNumber, setSerialNumber] = useState('');
  const [cpuModel, setCpuModel] = useState('Intel Core i7');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const clientsQuery = useQuery({
    queryKey: ['client-options'],
    queryFn: () => listClients({ page: 1, limit: 100 })
  });

  const devicesQuery = useQuery({
    queryKey: ['devices', page, search, statusFilter],
    queryFn: () => listDevices({ page, limit: 10, search, onlineStatus: statusFilter || undefined })
  });

  const onStatusUpdate = useCallback(
    (event: DeviceStatusEvent) => {
      queryClient.setQueriesData({ queryKey: ['devices'] }, (previous: unknown) => {
        if (!previous || typeof previous !== 'object' || !('items' in (previous as Record<string, unknown>))) {
          return previous;
        }

        const typed = previous as {
          items: DeviceRecord[];
          meta: { page: number; limit: number; total: number; totalPages: number };
        };

        return {
          ...typed,
          items: typed.items.map((item) =>
            item._id === event.deviceId
              ? {
                  ...item,
                  onlineStatus: event.onlineStatus,
                  lastHeartbeatAt: event.lastHeartbeatAt
                }
              : item
          )
        };
      });

      queryClient.setQueriesData({ queryKey: ['device'] }, (previous: unknown) => {
        if (!previous || typeof previous !== 'object') {
          return previous;
        }

        const typed = previous as Record<string, unknown>;
        if (typed._id !== event.deviceId) {
          return previous;
        }

        return {
          ...typed,
          onlineStatus: event.onlineStatus,
          lastHeartbeatAt: event.lastHeartbeatAt
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
    [queryClient]
  );

  useDeviceStatusSocket(meQuery.data?.tenantId, onStatusUpdate);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId: clientId || undefined,
        hostname,
        ipAddress,
        os,
        tags: tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes,
        inventory: {
          cpuModel,
          cpuCores: Number(cpuCores) || 0,
          ramGb: Number(ramGb) || 0,
          diskGb: Number(diskGb) || 0,
          serialNumber,
          services: ['backup-agent', 'security-agent']
        }
      };

      if (editingDevice) {
        return updateDevice(editingDevice._id, payload);
      }

      return createDevice(payload);
    },
    onSuccess: () => {
      setEditingDevice(null);
      setClientId('');
      setHostname('');
      setIpAddress('');
      setOs('Windows 11 Pro');
      setTags('production');
      setNotes('');
      setCpuModel('Intel Core i7');
      setCpuCores('8');
      setRamGb('16');
      setDiskGb('512');
      setSerialNumber('');
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const items = devicesQuery.data?.items ?? [];
  const meta = devicesQuery.data?.meta;
  const clientItems = clientsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Devices</h1>
        <p className="text-sm text-muted-foreground">Manage device inventory and operational status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingDevice ? `Edit ${editingDevice.hostname}` : 'Create Device'}</CardTitle>
          <CardDescription>Inventory fields are persisted and visible in device detail.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <select className="h-10 rounded-md border px-3 text-sm" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">No client</option>
            {clientItems.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          <Input placeholder="Hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} />
          <Input placeholder="IP Address" value={ipAddress} onChange={(event) => setIpAddress(event.target.value)} />
          <Input placeholder="OS" value={os} onChange={(event) => setOs(event.target.value)} />
          <Input placeholder="Tags (comma separated)" value={tags} onChange={(event) => setTags(event.target.value)} />
          <Input placeholder="CPU Model" value={cpuModel} onChange={(event) => setCpuModel(event.target.value)} />
          <Input placeholder="CPU Cores" value={cpuCores} onChange={(event) => setCpuCores(event.target.value)} />
          <Input placeholder="RAM GB" value={ramGb} onChange={(event) => setRamGb(event.target.value)} />
          <Input placeholder="Disk GB" value={diskGb} onChange={(event) => setDiskGb(event.target.value)} />
          <Input placeholder="Serial Number" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
          <Input className="md:col-span-4" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hostname.trim() || !ipAddress.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingDevice ? 'Update' : 'Create'}
            </Button>
            {editingDevice ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingDevice(null);
                  setClientId('');
                  setHostname('');
                  setIpAddress('');
                  setOs('Windows 11 Pro');
                  setTags('production');
                  setNotes('');
                  setCpuModel('Intel Core i7');
                  setCpuCores('8');
                  setRamGb('16');
                  setDiskGb('512');
                  setSerialNumber('');
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device Inventory</CardTitle>
          <CardDescription>Real-time online/offline status updates via WebSocket.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              placeholder="Search hostname/IP/OS"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'online' | 'offline' | 'unknown' | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Hostname</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const clientLabel =
                    item.clientId && typeof item.clientId === 'object' ? item.clientId.name : 'Unassigned';

                  return (
                    <tr key={item._id} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/devices/${item._id}`} className="font-medium hover:underline">
                          {item.hostname}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{item.ipAddress}</td>
                      <td className="px-3 py-2">{clientLabel}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            item.onlineStatus === 'online'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.onlineStatus === 'offline'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.onlineStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingDevice(item);
                            setHostname(item.hostname);
                            setIpAddress(item.ipAddress);
                            setOs(item.os);
                            setTags(item.tags.join(', '));
                            setNotes(item.notes || '');
                            setCpuModel(item.inventory.cpuModel || '');
                            setCpuCores(String(item.inventory.cpuCores || 0));
                            setRamGb(String(item.inventory.ramGb || 0));
                            setDiskGb(String(item.inventory.diskGb || 0));
                            setSerialNumber(item.inventory.serialNumber || '');
                            setClientId(
                              item.clientId && typeof item.clientId === 'object' ? item.clientId._id : ''
                            );
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!devicesQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No devices found.
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
