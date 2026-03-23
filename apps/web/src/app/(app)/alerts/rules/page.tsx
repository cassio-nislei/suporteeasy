'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules,
  updateAlertRule,
  type AlertRuleRecord
} from '@/lib/api/operations';

export default function AlertRulesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingRule, setEditingRule] = useState<AlertRuleRecord | null>(null);

  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<'metric' | 'device_status'>('metric');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [cooldown, setCooldown] = useState('5');
  const [enabled, setEnabled] = useState(true);
  const [autoCreateTicket, setAutoCreateTicket] = useState(false);
  const [metricType, setMetricType] = useState('cpu');
  const [operator, setOperator] = useState<'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'>('gt');
  const [threshold, setThreshold] = useState('90');
  const [statusCondition, setStatusCondition] = useState<'online' | 'offline' | 'unknown'>('offline');

  const rulesQuery = useQuery({
    queryKey: ['alert-rules', search],
    queryFn: () => listAlertRules({ page: 1, limit: 100, search })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        targetType,
        severity,
        cooldown: Number(cooldown) || 0,
        enabled,
        autoCreateTicket,
        conditions:
          targetType === 'metric'
            ? {
                metricType,
                operator,
                threshold: Number(threshold)
              }
            : {
                status: statusCondition
              }
      };

      if (editingRule) {
        return updateAlertRule(editingRule._id, payload);
      }

      return createAlertRule(payload);
    },
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteAlertRule(ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    }
  });

  const title = useMemo(
    () => (editingRule ? `Edit Rule: ${editingRule.name}` : 'Create Alert Rule'),
    [editingRule]
  );

  function resetForm() {
    setEditingRule(null);
    setName('');
    setTargetType('metric');
    setSeverity('high');
    setCooldown('5');
    setEnabled(true);
    setAutoCreateTicket(false);
    setMetricType('cpu');
    setOperator('gt');
    setThreshold('90');
    setStatusCondition('offline');
  }

  function loadRule(rule: AlertRuleRecord) {
    setEditingRule(rule);
    setName(rule.name);
    setTargetType(rule.targetType);
    setSeverity(rule.severity);
    setCooldown(String(rule.cooldown));
    setEnabled(rule.enabled);
    setAutoCreateTicket(rule.autoCreateTicket);
    setMetricType(rule.conditions.metricType ?? 'cpu');
    setOperator(rule.conditions.operator ?? 'gt');
    setThreshold(
      rule.conditions.threshold !== undefined && rule.conditions.threshold !== null
        ? String(rule.conditions.threshold)
        : '0'
    );
    setStatusCondition((rule.conditions.status as 'online' | 'offline' | 'unknown') ?? 'offline');
  }

  const rules = rulesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alert Rules</h1>
        <p className="text-sm text-muted-foreground">Define thresholds and device-state triggers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Rules evaluate incoming metrics and offline states.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} />
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as 'metric' | 'device_status')}
            >
              <option value="metric">Metric</option>
              <option value="device_status">Device Status</option>
            </select>
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as 'critical' | 'high' | 'medium' | 'low')}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Input
              placeholder="Cooldown (minutes)"
              value={cooldown}
              onChange={(event) => setCooldown(event.target.value)}
            />
          </div>

          {targetType === 'metric' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Metric type"
                value={metricType}
                onChange={(event) => setMetricType(event.target.value)}
              />
              <select
                className="h-10 rounded-md border px-3 text-sm"
                value={operator}
                onChange={(event) =>
                  setOperator(event.target.value as 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq')
                }
              >
                <option value="gt">&gt;</option>
                <option value="gte">&gt;=</option>
                <option value="lt">&lt;</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
                <option value="neq">!=</option>
              </select>
              <Input
                placeholder="Threshold"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-10 rounded-md border px-3 text-sm"
                value={statusCondition}
                onChange={(event) =>
                  setStatusCondition(event.target.value as 'online' | 'offline' | 'unknown')
                }
              >
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="unknown">Unknown</option>
              </select>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCreateTicket}
                    onChange={(event) => setAutoCreateTicket(event.target.checked)}
                  />
                  Auto create ticket
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCreateTicket}
                onChange={(event) => setAutoCreateTicket(event.target.checked)}
              />
              Auto create ticket
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
            {editingRule ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Manage enabled rules and thresholds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search rule"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Condition</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const conditionLabel =
                    rule.targetType === 'metric'
                      ? `${rule.conditions.metricType ?? '-'} ${rule.conditions.operator ?? '-'} ${rule.conditions.threshold ?? '-'}`
                      : `status = ${rule.conditions.status ?? '-'}`;

                  return (
                    <tr key={rule._id} className="border-t">
                      <td className="px-3 py-2 font-medium">{rule.name}</td>
                      <td className="px-3 py-2">{rule.targetType}</td>
                      <td className="px-3 py-2">{conditionLabel}</td>
                      <td className="px-3 py-2 uppercase">{rule.severity}</td>
                      <td className="px-3 py-2">{rule.enabled ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => loadRule(rule)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(rule._id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rulesQuery.isLoading && rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No rules found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
