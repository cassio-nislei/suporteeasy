'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  portalAddTicketComment,
  portalGetTicket,
  portalListTicketComments
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function PortalTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [commentBody, setCommentBody] = useState('');

  const ticketQuery = useQuery({
    queryKey: ['portal-ticket', ticketId],
    queryFn: () => portalGetTicket(ticketId)
  });
  const commentsQuery = useQuery({
    queryKey: ['portal-ticket-comments', ticketId],
    queryFn: () => portalListTicketComments(ticketId)
  });

  const addCommentMutation = useMutation({
    mutationFn: () => portalAddTicketComment(ticketId, commentBody),
    onSuccess: () => {
      setCommentBody('');
      void queryClient.invalidateQueries({ queryKey: ['portal-ticket-comments', ticketId] });
      push({ title: 'Comment added', variant: 'success' });
    }
  });

  if (ticketQuery.isLoading || !ticketQuery.data) {
    return <p className="text-sm text-muted-foreground">Loading ticket...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{ticketQuery.data.subject}</CardTitle>
          <CardDescription>
            Status: {ticketQuery.data.status} · Priority: {ticketQuery.data.priority} · SLA:{' '}
            {ticketQuery.data.sla.overallState}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{ticketQuery.data.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(commentsQuery.data ?? []).map((comment) => (
            <div key={comment._id} className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleString()}
              </p>
              <p className="text-sm">{comment.body}</p>
            </div>
          ))}
          {!commentsQuery.isLoading && (commentsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : null}
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add follow-up..."
          />
          <Button
            type="button"
            onClick={() => addCommentMutation.mutate()}
            disabled={addCommentMutation.isPending || !commentBody.trim()}
          >
            Add Comment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
