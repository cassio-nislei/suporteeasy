'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  billingMonthlySummary,
  createInvoice,
  createSubscription,
  listClients,
  listContracts,
  listInvoices,
  listSubscriptions
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

function currentMonthKey() {
  const date = new Date();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const month = currentMonthKey();

  const [clientId, setClientId] = useState('');
  const [contractId, setContractId] = useState('');
  const [number, setNumber] = useState(`INV-${Date.now()}`);
  const [total, setTotal] = useState('1200');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const [subClientId, setSubClientId] = useState('');
  const [planName, setPlanName] = useState('Managed Services');
  const [monthlyPrice, setMonthlyPrice] = useState('999');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));

  const clientsQuery = useQuery({
    queryKey: ['billing-clients'],
    queryFn: () => listClients({ page: 1, limit: 100 })
  });
  const contractsQuery = useQuery({
    queryKey: ['billing-contracts'],
    queryFn: () => listContracts({ page: 1, limit: 100 })
  });
  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => listInvoices({ page: 1, limit: 100 })
  });
  const subscriptionsQuery = useQuery({
    queryKey: ['billing-subscriptions'],
    queryFn: () => listSubscriptions({ page: 1, limit: 100 })
  });
  const summaryQuery = useQuery({
    queryKey: ['billing-summary', month.year, month.month],
    queryFn: () => billingMonthlySummary(month)
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      createInvoice({
        clientId,
        contractId: contractId || undefined,
        number,
        status: 'sent',
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        subtotal: Number(total),
        tax: 0,
        total: Number(total)
      }),
    onSuccess: () => {
      setNumber(`INV-${Date.now()}`);
      void queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
      push({ title: 'Invoice created', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Invoice failed', description: (error as Error).message, variant: 'error' });
    }
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: () =>
      createSubscription({
        clientId: subClientId,
        planName,
        monthlyPrice: Number(monthlyPrice),
        startedAt: new Date(startedAt).toISOString(),
        status: 'active'
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
      push({ title: 'Subscription created', variant: 'success' });
    }
  });

  const contractOptions = useMemo(
    () =>
      (contractsQuery.data?.items ?? []).filter((contract) => {
        if (!clientId) {
          return true;
        }
        if (contract.clientId && typeof contract.clientId === 'object') {
          return contract.clientId._id === clientId;
        }
        return contract.clientId === clientId;
      }),
    [contractsQuery.data?.items, clientId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Invoices, subscriptions and monthly summary.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Billed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${formatCurrency(summaryQuery.data?.invoices?.totalBilled)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700">
            ${formatCurrency(summaryQuery.data?.invoices?.paid)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-700">
            ${formatCurrency(summaryQuery.data?.invoices?.outstanding)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recurring MRR</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${formatCurrency(summaryQuery.data?.subscriptions?.recurringMonthly)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <select className="h-10 rounded-md border px-3 text-sm" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">Select client</option>
            {(clientsQuery.data?.items ?? []).map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border px-3 text-sm" value={contractId} onChange={(event) => setContractId(event.target.value)}>
            <option value="">No contract</option>
            {contractOptions.map((contract) => (
              <option key={contract._id} value={contract._id}>
                {contract.name}
              </option>
            ))}
          </select>
          <Input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Invoice number" />
          <Input value={total} onChange={(event) => setTotal(event.target.value)} type="number" min={0} />
          <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <div className="md:col-span-3">
            <Button
              type="button"
              onClick={() => createInvoiceMutation.mutate()}
              disabled={createInvoiceMutation.isPending || !clientId}
            >
              {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={subClientId}
            onChange={(event) => setSubClientId(event.target.value)}
          >
            <option value="">Select client</option>
            {(clientsQuery.data?.items ?? []).map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          <Input value={planName} onChange={(event) => setPlanName(event.target.value)} />
          <Input
            type="number"
            min={0}
            value={monthlyPrice}
            onChange={(event) => setMonthlyPrice(event.target.value)}
          />
          <Input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          <div className="md:col-span-4">
            <Button
              type="button"
              onClick={() => createSubscriptionMutation.mutate()}
              disabled={createSubscriptionMutation.isPending || !subClientId}
            >
              {createSubscriptionMutation.isPending ? 'Creating...' : 'Create Subscription'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(invoicesQuery.data?.items ?? []).slice(0, 10).map((invoice) => (
              <div key={invoice._id} className="rounded-md border p-2">
                <p className="font-medium">{invoice.number}</p>
                <p className="text-xs text-muted-foreground">
                  {invoice.status} · ${invoice.total.toFixed(2)}
                </p>
              </div>
            ))}
            {!invoicesQuery.isLoading && (invoicesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No invoices.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(subscriptionsQuery.data?.items ?? []).slice(0, 10).map((subscription) => (
              <div key={subscription._id} className="rounded-md border p-2">
                <p className="font-medium">{subscription.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {subscription.status} · ${subscription.monthlyPrice.toFixed(2)}
                </p>
              </div>
            ))}
            {!subscriptionsQuery.isLoading && (subscriptionsQuery.data?.items.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No subscriptions.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
