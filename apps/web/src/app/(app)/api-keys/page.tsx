'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [name, setName] = useState('Integration Key');
  const [scopes, setScopes] = useState('reports:read,devices:read');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createApiKey({
        name,
        scopes: scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      }),
    onSuccess: (result) => {
      setCreatedKey(result.plainKey);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      push({ title: 'API key created', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Create failed', description: (error as Error).message, variant: 'error' });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-muted-foreground">Tenant API keys with scopes and revocation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Key</CardTitle>
          <CardDescription>The plain key is shown once after creation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Input value={scopes} onChange={(event) => setScopes(event.target.value)} />
          <Button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
          {createdKey ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 md:col-span-3">
              Copy now (shown once): {createdKey}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(keysQuery.data ?? []).map((key) => (
            <div key={key._id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">{key.name}</p>
                <p className="text-xs text-muted-foreground">
                  {key.keyPrefix} · {key.scopes.join(', ') || 'no scopes'} ·{' '}
                  {key.revokedAt ? 'revoked' : 'active'}
                </p>
              </div>
              {!key.revokedAt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await revokeApiKey(key._id);
                    void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
                  }}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
          {!keysQuery.isLoading && (keysQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
