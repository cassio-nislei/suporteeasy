'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  approvePatch,
  createPatchPolicy,
  executePatch,
  listDevices,
  listPatchPolicies,
  listPatches,
  schedulePatch,
  simulatePatchScan
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function PatchManagementPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [policyName, setPolicyName] = useState('Weekly Policy');
  const [deviceId, setDeviceId] = useState('');
  const [kbId, setKbId] = useState('KB500001');
  const [title, setTitle] = useState('Security Update');
  const [severity, setSeverity] = useState('high');

  const policiesQuery = useQuery({
    queryKey: ['patch-policies'],
    queryFn: listPatchPolicies
  });
  const patchesQuery = useQuery({
    queryKey: ['patches'],
    queryFn: () => listPatches({ page: 1, limit: 50 })
  });
  const devicesQuery = useQuery({
    queryKey: ['patch-devices'],
    queryFn: () => listDevices({ page: 1, limit: 100 })
  });

  const createPolicyMutation = useMutation({
    mutationFn: () => createPatchPolicy({ name: policyName, enabled: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patch-policies'] });
      push({ title: 'Policy created', variant: 'success' });
    }
  });

  const simulateMutation = useMutation({
    mutationFn: () =>
      simulatePatchScan({
        deviceId,
        kbId,
        title,
        severity,
        policyId: policiesQuery.data?.[0]?._id
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
      push({ title: 'Patch scanned', variant: 'success' });
    }
  });

  async function runAction(
    action: 'approve' | 'schedule' | 'execute',
    patchId: string
  ) {
    try {
      if (action === 'approve') {
        await approvePatch(patchId);
      } else if (action === 'schedule') {
        await schedulePatch(patchId, new Date(Date.now() + 30 * 60 * 1000).toISOString());
      } else {
        await executePatch(patchId);
      }
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
      push({ title: `Patch ${action} done`, variant: 'success' });
    } catch (error) {
      push({ title: 'Patch action failed', description: (error as Error).message, variant: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Patch Management</h1>
        <p className="text-sm text-muted-foreground">Simulated patch workflow: scan, approve, schedule and execute.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Policy</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input value={policyName} onChange={(event) => setPolicyName(event.target.value)} />
            <Button type="button" onClick={() => createPolicyMutation.mutate()} disabled={createPolicyMutation.isPending}>
              Add
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulate Patch Scan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
            >
              <option value="">Select device</option>
              {(devicesQuery.data?.items ?? []).map((device) => (
                <option key={device._id} value={device._id}>
                  {device.hostname}
                </option>
              ))}
            </select>
            <Input value={kbId} onChange={(event) => setKbId(event.target.value)} />
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input value={severity} onChange={(event) => setSeverity(event.target.value)} />
            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending || !deviceId}
              >
                Simulate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patches</CardTitle>
          <CardDescription>Current tenant patch backlog and lifecycle status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(patchesQuery.data?.items ?? []).map((patch) => (
            <div key={patch._id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{patch.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {patch.kbId} · {patch.severity} · {patch.status}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => runAction('approve', patch._id)}>
                    Approve
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => runAction('schedule', patch._id)}>
                    Schedule
                  </Button>
                  <Button type="button" size="sm" onClick={() => runAction('execute', patch._id)}>
                    Execute
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!patchesQuery.isLoading && (patchesQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No patches yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
