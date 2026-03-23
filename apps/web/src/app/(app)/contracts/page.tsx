'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createContract, listClients, listContracts } from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('1500');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => listContracts({ page: 1, limit: 100 })
  });

  const clientsQuery = useQuery({
    queryKey: ['contracts-clients'],
    queryFn: () => listClients({ page: 1, limit: 100, status: 'active' })
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createContract({
        clientId,
        name,
        status: 'active',
        startDate: new Date(startDate).toISOString(),
        monthlyValue: Number(monthlyValue)
      }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      push({ title: 'Contract created', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Create failed', description: (error as Error).message, variant: 'error' });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contracts</h1>
        <p className="text-sm text-muted-foreground">Contracts linked to clients with monthly value baseline.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Contract</CardTitle>
          <CardDescription>Start commercial records used by billing and revenue reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">Select client</option>
            {(clientsQuery.data?.items ?? []).map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          <Input placeholder="Contract name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            type="number"
            min={0}
            placeholder="Monthly value"
            value={monthlyValue}
            onChange={(event) => setMonthlyValue(event.target.value)}
          />
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <div className="md:col-span-4">
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !clientId || !name.trim()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract List</CardTitle>
          <CardDescription>Active and historical contract records.</CardDescription>
        </CardHeader>
        <CardContent>
          {contractsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading contracts...</p> : null}
          {contractsQuery.isError ? (
            <p className="text-sm text-red-600">{(contractsQuery.error as Error).message}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Monthly</th>
                  <th className="px-3 py-2 text-left">Start</th>
                </tr>
              </thead>
              <tbody>
                {(contractsQuery.data?.items ?? []).map((contract) => (
                  <tr key={contract._id} className="border-t">
                    <td className="px-3 py-2">{contract.name}</td>
                    <td className="px-3 py-2">
                      {contract.clientId && typeof contract.clientId === 'object'
                        ? contract.clientId.name
                        : '-'}
                    </td>
                    <td className="px-3 py-2 uppercase">{contract.status}</td>
                    <td className="px-3 py-2">${contract.monthlyValue.toFixed(2)}</td>
                    <td className="px-3 py-2">{new Date(contract.startDate).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!contractsQuery.isLoading && (contractsQuery.data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No contracts found.
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
