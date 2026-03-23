'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listSettings, upsertSetting } from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [key, setKey] = useState('general');
  const [valueText, setValueText] = useState('{\n  "timezone": "America/Sao_Paulo"\n}');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: listSettings
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(valueText) as Record<string, unknown>;
      return upsertSetting({ key, value: parsed });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      push({ title: 'Setting saved', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Save failed', description: (error as Error).message, variant: 'error' });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Tenant-level operational settings store.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upsert Setting</CardTitle>
          <CardDescription>Persist JSON values by key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="settings key" />
          <textarea
            className="min-h-40 w-full rounded-md border px-3 py-2 text-sm"
            value={valueText}
            onChange={(event) => setValueText(event.target.value)}
          />
          <Button type="button" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending || !key.trim()}>
            {upsertMutation.isPending ? 'Saving...' : 'Save Setting'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(settingsQuery.data ?? []).map((setting) => (
            <div key={setting._id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{setting.key}</p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(setting.value, null, 2)}
              </pre>
            </div>
          ))}
          {!settingsQuery.isLoading && (settingsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No settings stored yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
