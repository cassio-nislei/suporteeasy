'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createClient, listClients, updateClient, type ClientRecord } from '@/lib/api/operations';

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('');
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  const clientsQuery = useQuery({
    queryKey: ['clients', page, search, status],
    queryFn: () => listClients({ page, limit: 10, search, status: status || undefined })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        status: (status || 'active') as 'active' | 'inactive',
        tags: tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes
      };

      if (editingClient) {
        return updateClient(editingClient._id, payload);
      }

      return createClient(payload);
    },
    onSuccess: () => {
      setEditingClient(null);
      setName('');
      setTags('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });

  const items = clientsQuery.data?.items ?? [];
  const meta = clientsQuery.data?.meta;

  const title = useMemo(() => (editingClient ? `Edit ${editingClient.name}` : 'Create Client'), [editingClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">Manage customers and account ownership.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Use this form to create or edit client records.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Client name" />
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (comma separated)" />
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingClient ? 'Update' : 'Create'}
            </Button>
            {editingClient ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingClient(null);
                  setName('');
                  setTags('');
                  setNotes('');
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>Pagination, filter and search are backed by API queries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name/tag/notes"
            />
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={status}
              onChange={(event) => {
                const value = event.target.value as 'active' | 'inactive' | '';
                setStatus(value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Tags</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/clients/${item._id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          item.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.tags.join(', ') || '-'}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingClient(item);
                          setName(item.name);
                          setTags(item.tags.join(', '));
                          setNotes(item.notes || '');
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {!clientsQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No clients found.
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
