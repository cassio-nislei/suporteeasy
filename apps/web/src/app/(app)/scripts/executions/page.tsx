'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getMe } from '@/lib/auth/client';
import {
  listDeviceGroups,
  listDevices,
  listScheduledScriptJobs,
  listScriptExecutions,
  listScripts,
  runScriptOnDevice,
  runScriptOnGroup,
  scheduleScript,
  type ScriptExecutionRecord,
  type ScriptExecutionStatusEvent
} from '@/lib/api/operations';
import { useScriptExecutionSocket } from '@/lib/realtime/use-script-execution-socket';

function statusClass(status: ScriptExecutionRecord['status']) {
  if (status === 'queued') return 'bg-slate-200 text-slate-700';
  if (status === 'running') return 'bg-blue-100 text-blue-700';
  if (status === 'success') return 'bg-emerald-100 text-emerald-700';
  return 'bg-red-100 text-red-700';
}

export default function ScriptExecutionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | 'queued' | 'running' | 'success' | 'failed'>('');

  const [scriptId, setScriptId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [parameterString, setParameterString] = useState('');
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const scriptsQuery = useQuery({
    queryKey: ['script-options'],
    queryFn: () => listScripts({ page: 1, limit: 100, enabled: true })
  });

  const devicesQuery = useQuery({
    queryKey: ['script-device-options'],
    queryFn: () => listDevices({ page: 1, limit: 100 })
  });

  const groupsQuery = useQuery({
    queryKey: ['script-group-options'],
    queryFn: listDeviceGroups
  });

  const executionsQuery = useQuery({
    queryKey: ['script-executions', page, statusFilter],
    queryFn: () =>
      listScriptExecutions({
        page,
        limit: 15,
        status: statusFilter || undefined
      })
  });

  const scheduledQuery = useQuery({
    queryKey: ['script-scheduled'],
    queryFn: () => listScheduledScriptJobs({ page: 1, limit: 8 })
  });

  const parsedParameters = useMemo(() => {
    const result: Record<string, string | number | boolean> = {};
    parameterString
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const [rawKey, rawValue] = entry.split('=');
        const key = rawKey?.trim();
        if (!key) return;
        const value = rawValue?.trim() ?? '';
        if (value === 'true' || value === 'false') {
          result[key] = value === 'true';
          return;
        }

        const numeric = Number(value);
        result[key] = Number.isFinite(numeric) && value !== '' ? numeric : value;
      });
    return result;
  }, [parameterString]);

  const runDeviceMutation = useMutation({
    mutationFn: () =>
      runScriptOnDevice({
        scriptId,
        deviceId,
        parameters: parsedParameters
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['script-executions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const runGroupMutation = useMutation({
    mutationFn: () =>
      runScriptOnGroup({
        scriptId,
        groupId,
        parameters: parsedParameters
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['script-executions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleScript({
        scriptId,
        runAt: new Date(scheduleAt).toISOString(),
        parameters: parsedParameters,
        ...(groupId ? { groupId } : {}),
        ...(deviceId && !groupId ? { deviceId } : {})
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['script-scheduled'] });
    }
  });

  const onExecutionUpdate = useCallback(
    (event: ScriptExecutionStatusEvent) => {
      queryClient.setQueriesData({ queryKey: ['script-executions'] }, (previous: unknown) => {
        if (!previous || typeof previous !== 'object' || !('items' in (previous as Record<string, unknown>))) {
          return previous;
        }

        const typed = previous as {
          items: ScriptExecutionRecord[];
          meta: { page: number; limit: number; total: number; totalPages: number };
        };

        return {
          ...typed,
          items: typed.items.map((execution) =>
            execution._id === event.executionId
              ? {
                  ...execution,
                  status: event.status,
                  startedAt: event.startedAt,
                  finishedAt: event.finishedAt
                }
              : execution
          )
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
    [queryClient]
  );

  useScriptExecutionSocket(meQuery.data?.tenantId, onExecutionUpdate);

  const executionItems = executionsQuery.data?.items ?? [];
  const executionMeta = executionsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Script Runs</h1>
        <p className="text-sm text-muted-foreground">
          Execute scripts on devices/groups, schedule runs, and monitor logs/status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run or Schedule</CardTitle>
          <CardDescription>Use key=value parameters separated by comma.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={scriptId}
            onChange={(event) => setScriptId(event.target.value)}
          >
            <option value="">Select script</option>
            {(scriptsQuery.data?.items ?? []).map((script) => (
              <option key={script._id} value={script._id}>
                {script.name}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            <option value="">Single device (optional)</option>
            {(devicesQuery.data?.items ?? []).map((device) => (
              <option key={device._id} value={device._id}>
                {device.hostname}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="">Device group (optional)</option>
            {(groupsQuery.data ?? []).map((group) => (
              <option key={group._id} value={group._id}>
                {group.name}
              </option>
            ))}
          </select>

          <Input
            placeholder="param=value,flag=true"
            value={parameterString}
            onChange={(event) => setParameterString(event.target.value)}
          />

          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />

          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => runDeviceMutation.mutate()}
              disabled={runDeviceMutation.isPending || !scriptId || !deviceId}
            >
              {runDeviceMutation.isPending ? 'Running...' : 'Run on Device'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => runGroupMutation.mutate()}
              disabled={runGroupMutation.isPending || !scriptId || !groupId}
            >
              {runGroupMutation.isPending ? 'Running...' : 'Run on Group'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending || !scriptId || !scheduleAt || (!deviceId && !groupId)}
            >
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Queued/running/success/failed status badges with logs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as '' | 'queued' | 'running' | 'success' | 'failed');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Script</th>
                  <th className="px-3 py-2 text-left">Device</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Started</th>
                  <th className="px-3 py-2 text-left">Finished</th>
                  <th className="px-3 py-2 text-left">Logs</th>
                </tr>
              </thead>
              <tbody>
                {executionItems.map((execution) => {
                  const scriptLabel =
                    execution.scriptId && typeof execution.scriptId === 'object'
                      ? execution.scriptId.name
                      : execution.scriptSnapshot.name;
                  const deviceLabel =
                    execution.deviceId && typeof execution.deviceId === 'object'
                      ? execution.deviceId.hostname
                      : execution.deviceId;

                  return (
                    <Fragment key={execution._id}>
                      <tr key={execution._id} className="border-t">
                        <td className="px-3 py-2">{scriptLabel}</td>
                        <td className="px-3 py-2">{deviceLabel}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-1 text-xs ${statusClass(execution.status)}`}>
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{execution.startedAt ?? '-'}</td>
                        <td className="px-3 py-2">{execution.finishedAt ?? '-'}</td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedExecutionId((current) =>
                                current === execution._id ? null : execution._id
                              )
                            }
                          >
                            {expandedExecutionId === execution._id ? 'Hide' : 'Show'}
                          </Button>
                        </td>
                      </tr>
                      {expandedExecutionId === execution._id ? (
                        <tr className="border-t bg-muted/10">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="space-y-2">
                              {execution.logs.map((log, index) => (
                                <p key={`${execution._id}-log-${index}`} className="text-xs text-muted-foreground">
                                  {log.createdAt}: {log.message}
                                </p>
                              ))}
                              {execution.logs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No logs yet.</p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {!executionsQuery.isLoading && executionItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No script executions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {executionMeta?.page ?? 1} of {executionMeta?.totalPages ?? 1} (
              {executionMeta?.total ?? 0} records)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(executionMeta && page >= executionMeta.totalPages)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>Next queued script schedules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(scheduledQuery.data?.items ?? []).map((job) => (
            <div key={job._id} className="rounded border p-2">
              <p className="font-medium">Run at: {job.runAt}</p>
              <p>Status: {job.status}</p>
            </div>
          ))}
          {(scheduledQuery.data?.items ?? []).length === 0 ? (
            <p className="text-muted-foreground">No scheduled jobs.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
