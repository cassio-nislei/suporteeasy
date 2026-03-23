'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listAuditLogs } from '@/lib/api/operations';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const auditQuery = useQuery({
    queryKey: ['audit-logs', page, action, entityType],
    queryFn: () => listAuditLogs({ page, limit: 25, action, entityType })
  });

  const items = auditQuery.data?.items ?? [];
  const meta = auditQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Critical actions and security traces.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by action or entity type.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input
            placeholder="Action contains..."
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          />
          <Input
            placeholder="Entity type..."
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Stream</CardTitle>
          <CardDescription>Descending by event timestamp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {auditQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading logs...</p> : null}
          {auditQuery.isError ? (
            <p className="text-sm text-red-600">{(auditQuery.error as Error).message}</p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">User</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => (
                  <tr key={log._id} className="border-t">
                    <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">{log.entityType}</td>
                    <td className="px-3 py-2">{log.userId || '-'}</td>
                  </tr>
                ))}
                {!auditQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No audit logs found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {meta?.page ?? 1} of {meta?.totalPages ?? 1} ({meta?.total ?? 0} events)
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(meta && page >= meta.totalPages)}
                onClick={() => setPage((value) => value + 1)}
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
