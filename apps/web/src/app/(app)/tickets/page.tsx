'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createTicket,
  listClients,
  listDevices,
  listSlaPolicies,
  listTickets,
  listUsers,
  type TicketRecord
} from '@/lib/api/operations';

function slaClass(state: TicketRecord['sla']['overallState']) {
  if (state === 'breached') return 'bg-red-100 text-red-700';
  if (state === 'at_risk') return 'bg-amber-100 text-amber-700';
  if (state === 'met') return 'bg-emerald-100 text-emerald-700';
  if (state === 'on_track') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

export default function TicketsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened'>('');
  const [priorityFilter, setPriorityFilter] = useState<'' | 'low' | 'medium' | 'high' | 'urgent'>('');

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [slaPolicyId, setSlaPolicyId] = useState('');

  const ticketsQuery = useQuery({
    queryKey: ['tickets', page, search, statusFilter, priorityFilter],
    queryFn: () =>
      listTickets({
        page,
        limit: 12,
        search,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined
      })
  });

  const clientsQuery = useQuery({
    queryKey: ['ticket-clients-options'],
    queryFn: () => listClients({ page: 1, limit: 100 })
  });

  const devicesQuery = useQuery({
    queryKey: ['ticket-devices-options'],
    queryFn: () => listDevices({ page: 1, limit: 100 })
  });

  const usersQuery = useQuery({
    queryKey: ['ticket-users-options'],
    queryFn: listUsers
  });

  const slaQuery = useQuery({
    queryKey: ['ticket-sla-options'],
    queryFn: () => listSlaPolicies({ page: 1, limit: 100, enabled: true })
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTicket({
        subject,
        description,
        clientId: clientId || undefined,
        deviceId: deviceId || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        slaPolicyId: slaPolicyId || undefined
      }),
    onSuccess: () => {
      setSubject('');
      setDescription('');
      setClientId('');
      setDeviceId('');
      setPriority('medium');
      setAssigneeId('');
      setSlaPolicyId('');
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const items = ticketsQuery.data?.items ?? [];
  const meta = ticketsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-sm text-muted-foreground">Incident workflow with assignment, comments and SLA clocks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Ticket</CardTitle>
          <CardDescription>Manual service desk ticket creation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <select className="h-10 rounded-md border px-3 text-sm" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">No client</option>
            {(clientsQuery.data?.items ?? []).map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border px-3 text-sm" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">No device</option>
            {(devicesQuery.data?.items ?? []).map((device) => (
              <option key={device._id} value={device._id}>
                {device.hostname}
              </option>
            ))}
          </select>
          <Input
            className="md:col-span-3"
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | 'urgent')}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select className="h-10 rounded-md border px-3 text-sm" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {(usersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border px-3 text-sm" value={slaPolicyId} onChange={(event) => setSlaPolicyId(event.target.value)}>
            <option value="">Default SLA</option>
            {(slaQuery.data?.items ?? []).map((policy) => (
              <option key={policy._id} value={policy._id}>
                {policy.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !subject.trim() || !description.trim()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>Filter and navigate active incident queue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Search subject/description"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value as '' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened'
                );
                setPage(1);
              }}
            >
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="reopened">Reopened</option>
            </select>
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as '' | 'low' | 'medium' | 'high' | 'urgent');
                setPage(1);
              }}
            >
              <option value="">All priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Assignee</th>
                  <th className="px-3 py-2 text-left">SLA</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ticket) => {
                  const assigneeLabel =
                    ticket.assigneeId && typeof ticket.assigneeId === 'object'
                      ? ticket.assigneeId.email
                      : 'Unassigned';

                  return (
                    <tr key={ticket._id} className="border-t">
                      <td className="px-3 py-2">
                        <p className="font-medium">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{ticket.source}</p>
                      </td>
                      <td className="px-3 py-2 uppercase">{ticket.status}</td>
                      <td className="px-3 py-2 uppercase">{ticket.priority}</td>
                      <td className="px-3 py-2">{assigneeLabel}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${slaClass(ticket.sla.overallState)}`}>
                          {ticket.sla.overallState}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/tickets/${ticket._id}`} className="text-sm font-medium text-blue-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!ticketsQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No tickets found.
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
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
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
    </div>
  );
}
