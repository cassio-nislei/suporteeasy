'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { portalCreateTicket, portalListTickets } from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function PortalTicketsPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const ticketsQuery = useQuery({
    queryKey: ['portal-tickets'],
    queryFn: () => portalListTickets({ page: 1, limit: 50 })
  });

  const createMutation = useMutation({
    mutationFn: () =>
      portalCreateTicket({
        subject,
        description,
        priority: 'medium'
      }),
    onSuccess: () => {
      setSubject('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
      push({ title: 'Ticket created', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Creation failed', description: (error as Error).message, variant: 'error' });
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Ticket</CardTitle>
          <CardDescription>Open a support request visible to your service provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <textarea
            className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Describe the issue"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !subject.trim() || !description.trim()}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(ticketsQuery.data?.items ?? []).map((ticket) => (
            <Link
              key={ticket._id}
              href={`/portal/tickets/${ticket._id}`}
              className="block rounded-md border px-3 py-2 hover:bg-muted/30"
            >
              <p className="font-medium">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground">
                {ticket.status} · priority {ticket.priority} · SLA {ticket.sla.overallState}
              </p>
            </Link>
          ))}
          {!ticketsQuery.isLoading && (ticketsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
