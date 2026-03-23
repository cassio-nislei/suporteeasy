'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createAutomation,
  deleteAutomation,
  listAutomationLogs,
  listAutomations,
  updateAutomation,
  type AutomationRecord
} from '@/lib/api/operations';

function logStatusClass(status: 'running' | 'success' | 'failed' | 'skipped') {
  if (status === 'running') return 'bg-blue-100 text-blue-700';
  if (status === 'success') return 'bg-emerald-100 text-emerald-700';
  if (status === 'skipped') return 'bg-slate-200 text-slate-700';
  return 'bg-red-100 text-red-700';
}

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingAutomation, setEditingAutomation] = useState<AutomationRecord | null>(null);

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created'>(
    'alert_created'
  );
  const [enabled, setEnabled] = useState(true);
  const [conditionsJson, setConditionsJson] = useState('{}');
  const [actionsJson, setActionsJson] = useState(
    '[{"type":"send_notification","config":{"title":"Automation event","body":"Triggered by {{trigger}}"}}]'
  );
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [backoffMs, setBackoffMs] = useState('0');

  const automationsQuery = useQuery({
    queryKey: ['automations', page, search],
    queryFn: () =>
      listAutomations({
        page,
        limit: 12,
        search
      })
  });

  const logsQuery = useQuery({
    queryKey: ['automation-logs'],
    queryFn: () => listAutomationLogs({ page: 1, limit: 12 })
  });

  const parsedConditions = useMemo(() => {
    try {
      return JSON.parse(conditionsJson);
    } catch {
      return null;
    }
  }, [conditionsJson]);

  const parsedActions = useMemo(() => {
    try {
      const parsed = JSON.parse(actionsJson);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [actionsJson]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!parsedConditions || !parsedActions) {
        throw new Error('Conditions/Actions must be valid JSON');
      }

      const payload = {
        name,
        trigger,
        enabled,
        conditions: parsedConditions,
        actions: parsedActions,
        retryPolicy: {
          maxAttempts: Number(maxAttempts) || 1,
          backoffMs: Number(backoffMs) || 0
        }
      };

      if (editingAutomation) {
        return updateAutomation(editingAutomation._id, payload);
      }

      return createAutomation(payload);
    },
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      void queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (automationId: string) => deleteAutomation(automationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    }
  });

  function resetForm() {
    setEditingAutomation(null);
    setName('');
    setTrigger('alert_created');
    setEnabled(true);
    setConditionsJson('{}');
    setActionsJson(
      '[{"type":"send_notification","config":{"title":"Automation event","body":"Triggered by {{trigger}}"}}]'
    );
    setMaxAttempts('1');
    setBackoffMs('0');
  }

  const automationItems = automationsQuery.data?.items ?? [];
  const meta = automationsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="text-sm text-muted-foreground">
          Build trigger/condition/action rules and inspect execution logs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingAutomation ? `Edit ${editingAutomation.name}` : 'Automation Builder'}</CardTitle>
          <CardDescription>Simplified trigger + condition + action model.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={trigger}
            onChange={(event) =>
              setTrigger(
                event.target.value as 'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created'
              )
            }
          >
            <option value="alert_created">Alert Created</option>
            <option value="device_offline">Device Offline</option>
            <option value="script_failed">Script Failed</option>
            <option value="ticket_created">Ticket Created</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>
          <textarea
            className="min-h-20 rounded-md border px-3 py-2 text-sm md:col-span-3"
            value={conditionsJson}
            onChange={(event) => setConditionsJson(event.target.value)}
            placeholder='{"severities":["critical"]}'
          />
          <textarea
            className="min-h-28 rounded-md border px-3 py-2 text-sm md:col-span-3"
            value={actionsJson}
            onChange={(event) => setActionsJson(event.target.value)}
            placeholder='[{"type":"create_ticket","config":{"subject":"...","description":"..."}}]'
          />
          <Input
            placeholder="Retry max attempts"
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
          />
          <Input
            placeholder="Backoff ms"
            value={backoffMs}
            onChange={(event) => setBackoffMs(event.target.value)}
          />
          <div className="md:col-span-3 flex gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingAutomation ? 'Update Automation' : 'Create Automation'}
            </Button>
            {editingAutomation ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
          {saveMutation.isError ? (
            <p className="md:col-span-3 text-xs text-red-600">{(saveMutation.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
          <CardDescription>CRUD list with pagination/filter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Trigger</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {automationItems.map((automation) => (
                  <tr key={automation._id} className="border-t">
                    <td className="px-3 py-2">{automation.name}</td>
                    <td className="px-3 py-2">{automation.trigger}</td>
                    <td className="px-3 py-2">{automation.actions.length}</td>
                    <td className="px-3 py-2">{automation.enabled ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingAutomation(automation);
                            setName(automation.name);
                            setTrigger(automation.trigger);
                            setEnabled(automation.enabled);
                            setConditionsJson(JSON.stringify(automation.conditions, null, 2));
                            setActionsJson(JSON.stringify(automation.actions, null, 2));
                            setMaxAttempts(String(automation.retryPolicy.maxAttempts ?? 1));
                            setBackoffMs(String(automation.retryPolicy.backoffMs ?? 0));
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(automation._id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!automationsQuery.isLoading && automationItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No automations found.
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
                disabled={Boolean(meta && page >= meta.totalPages)}
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
          <CardTitle>Execution Logs</CardTitle>
          <CardDescription>Recent automation outcomes from worker processing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(logsQuery.data?.items ?? []).map((log) => {
            const automationName =
              log.automationId && typeof log.automationId === 'object' ? log.automationId.name : 'Automation';

            return (
              <div key={log._id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{automationName}</p>
                  <span className={`rounded px-2 py-1 text-xs ${logStatusClass(log.status)}`}>{log.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">Trigger: {log.trigger}</p>
                <p className="text-xs text-muted-foreground">Started: {log.startedAt ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Finished: {log.finishedAt ?? '-'}</p>
                {log.error ? <p className="text-xs text-red-600">Error: {log.error}</p> : null}
                <div className="mt-2 space-y-1">
                  {log.entries.slice(0, 3).map((entry, index) => (
                    <p key={`${log._id}-${index}`} className="text-xs text-muted-foreground">
                      [{entry.level}] {entry.message}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
          {(logsQuery.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No automation logs yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
