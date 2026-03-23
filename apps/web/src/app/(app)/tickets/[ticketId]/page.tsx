'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  addTicketComment,
  assignTicket,
  closeTicket,
  getTicket,
  listTicketComments,
  listUsers,
  reopenTicket,
  resolveTicket
} from '@/lib/api/operations';

function slaClass(state: string) {
  if (state === 'breached') return 'bg-red-100 text-red-700';
  if (state === 'at_risk') return 'bg-amber-100 text-amber-700';
  if (state === 'met') return 'bg-emerald-100 text-emerald-700';
  if (state === 'on_track') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;
  const queryClient = useQueryClient();

  const [assigneeId, setAssigneeId] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('internal');

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId)
  });

  const commentsQuery = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: () => listTicketComments(ticketId)
  });

  const usersQuery = useQuery({
    queryKey: ['ticket-detail-users'],
    queryFn: listUsers
  });

  useEffect(() => {
    const currentAssignee = ticketQuery.data?.assigneeId;
    if (currentAssignee && typeof currentAssignee === 'object') {
      setAssigneeId(currentAssignee._id);
      return;
    }

    setAssigneeId('');
  }, [ticketQuery.data?.assigneeId]);

  const assignMutation = useMutation({
    mutationFn: () => assignTicket(ticketId, assigneeId || null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const closeMutation = useMutation({
    mutationFn: () => closeTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      addTicketComment(ticketId, {
        body: commentBody,
        visibility: commentVisibility
      }),
    onSuccess: () => {
      setCommentBody('');
      setCommentVisibility('internal');
      void queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }
  });

  const ticket = ticketQuery.data;
  const comments = commentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ticket Detail</h1>
        <p className="text-sm text-muted-foreground">{ticket?.subject ?? 'Loading ticket...'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Workflow state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <strong>Current:</strong> <span className="uppercase">{ticket?.status ?? '-'}</span>
            </p>
            <p>
              <strong>Priority:</strong> <span className="uppercase">{ticket?.priority ?? '-'}</span>
            </p>
            <p>
              <strong>Source:</strong> {ticket?.source ?? '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA</CardTitle>
            <CardDescription>Response and resolution clocks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Overall:</strong>{' '}
              <span className={`rounded px-2 py-1 text-xs ${slaClass(ticket?.sla.overallState ?? 'none')}`}>
                {ticket?.sla.overallState ?? 'none'}
              </span>
            </p>
            <p>
              <strong>First Response:</strong> {ticket?.sla.firstResponseState ?? '-'}
            </p>
            <p>
              <strong>Resolution:</strong> {ticket?.sla.resolutionState ?? '-'}
            </p>
            <p>
              <strong>Resolution Due:</strong> {ticket?.sla.resolutionDueAt ?? '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ownership</CardTitle>
            <CardDescription>Client, device and assignee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <strong>Client:</strong>{' '}
              {ticket?.clientId && typeof ticket.clientId === 'object' ? ticket.clientId.name : 'Unassigned'}
            </p>
            <p>
              <strong>Device:</strong>{' '}
              {ticket?.deviceId && typeof ticket.deviceId === 'object' ? ticket.deviceId.hostname : 'Unassigned'}
            </p>
            <p>
              <strong>Assignee:</strong>{' '}
              {ticket?.assigneeId && typeof ticket.assigneeId === 'object'
                ? ticket.assigneeId.email
                : 'Unassigned'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>Incident context</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{ticket?.description}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign Technician</CardTitle>
          <CardDescription>Assignment updates emit notification events.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:flex-row">
          <select className="h-10 rounded-md border px-3 text-sm" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {(usersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
            {assignMutation.isPending ? 'Assigning...' : 'Save Assignment'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>State Actions</CardTitle>
          <CardDescription>Reopen, close and resolve lifecycle controls.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
            Resolve
          </Button>
          <Button type="button" variant="outline" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
            Reopen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
          <CardDescription>Public/internal communication timeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              className="md:flex-1"
              placeholder="Write a comment"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
            />
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={commentVisibility}
              onChange={(event) => setCommentVisibility(event.target.value as 'public' | 'internal')}
            >
              <option value="internal">Internal</option>
              <option value="public">Public</option>
            </select>
            <Button
              type="button"
              onClick={() => commentMutation.mutate()}
              disabled={commentMutation.isPending || !commentBody.trim()}
            >
              {commentMutation.isPending ? 'Posting...' : 'Add Comment'}
            </Button>
          </div>

          <ul className="space-y-2 text-sm">
            {comments.map((comment) => {
              const author =
                comment.authorId && typeof comment.authorId === 'object'
                  ? comment.authorId.email
                  : 'Unknown';

              return (
                <li key={comment._id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{author}</p>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs uppercase text-slate-700">
                      {comment.visibility}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{comment.createdAt}</p>
                </li>
              );
            })}
            {comments.length === 0 ? (
              <li className="text-muted-foreground">No comments yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
