'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  testEmailIntegration,
  testWebhookIntegration
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<'webhook' | 'smtp'>('webhook');
  const [url, setUrl] = useState('https://example.invalid/webhook');

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: () => listIntegrations({})
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createIntegration({
        name,
        type,
        enabled: true,
        config: type === 'webhook' ? { url } : { host: 'smtp.seed.local', port: 2525, from: 'noreply@acme.local' }
      }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
      push({ title: 'Integration created', variant: 'success' });
    }
  });

  async function runWebhookTest() {
    try {
      const result = await testWebhookIntegration({
        event: 'ui.test',
        payload: { source: 'dashboard' }
      });
      push({
        title: 'Webhook test executed',
        description: `Delivered ${result.delivered}, Failed ${result.failed}`,
        variant: 'success'
      });
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } catch (error) {
      push({ title: 'Webhook test failed', description: (error as Error).message, variant: 'error' });
    }
  }

  async function runEmailTest() {
    try {
      const result = await testEmailIntegration({
        to: 'portal@acme.local',
        subject: 'PHASE 5 email test',
        html: '<p>Seed email from integration abstraction.</p>'
      });
      push({ title: result.accepted ? 'Email simulated' : 'Email failed', description: result.message });
    } catch (error) {
      push({ title: 'Email test failed', description: (error as Error).message, variant: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Webhook and SMTP provider abstractions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Integration</CardTitle>
          <CardDescription>Add webhook or SMTP integration entries.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Integration name" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="h-10 rounded-md border px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as 'webhook' | 'smtp')}>
            <option value="webhook">Webhook</option>
            <option value="smtp">SMTP</option>
          </select>
          <Input
            placeholder="Webhook URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={type !== 'webhook'}
          />
          <Button type="button" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Tests</CardTitle>
          <CardDescription>Test webhook delivery and SMTP abstraction path.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button type="button" variant="outline" onClick={runWebhookTest}>
            Test Webhook
          </Button>
          <Button type="button" onClick={runEmailTest}>
            Test Email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(integrationsQuery.data ?? []).map((integration) => (
            <div key={integration._id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">
                  {integration.type} · {integration.enabled ? 'enabled' : 'disabled'}
                  {integration.lastError ? ` · error: ${integration.lastError}` : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await deleteIntegration(integration._id);
                  void queryClient.invalidateQueries({ queryKey: ['integrations'] });
                }}
              >
                Delete
              </Button>
            </div>
          ))}
          {!integrationsQuery.isLoading && (integrationsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No integrations configured.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
