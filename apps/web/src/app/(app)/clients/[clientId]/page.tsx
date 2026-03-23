'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createContact,
  deleteContact,
  getClient,
  listContacts,
  updateContact,
  type ContactRecord
} from '@/lib/api/operations';

export default function ClientDetailPage() {
  const queryClient = useQueryClient();
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId)
  });

  const contactsQuery = useQuery({
    queryKey: ['contacts', clientId, page, search],
    queryFn: () => listContacts({ clientId, page, limit: 10, search })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId,
        name,
        email,
        phone,
        title
      };

      if (editingContact) {
        return updateContact(editingContact._id, payload);
      }

      return createContact(payload);
    },
    onSuccess: () => {
      setEditingContact(null);
      setName('');
      setEmail('');
      setPhone('');
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['contacts', clientId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => deleteContact(contactId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts', clientId] });
    }
  });

  const contactMeta = contactsQuery.data?.meta;
  const contacts = contactsQuery.data?.items ?? [];

  const formTitle = useMemo(
    () => (editingContact ? `Edit ${editingContact.name}` : 'Create Contact'),
    [editingContact]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Client Detail</h1>
        <p className="text-sm text-muted-foreground">{clientQuery.data?.name ?? 'Loading client...'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Snapshot</CardTitle>
          <CardDescription>Operational metadata and account context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <strong>Status:</strong> {clientQuery.data?.status ?? '-'}
          </p>
          <p>
            <strong>Tags:</strong> {clientQuery.data?.tags?.join(', ') || '-'}
          </p>
          <p className="md:col-span-2">
            <strong>Notes:</strong> {clientQuery.data?.notes || '-'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{formTitle}</CardTitle>
          <CardDescription>Create or update client contacts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !email.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingContact ? 'Update' : 'Create'}
            </Button>
            {editingContact ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingContact(null);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setTitle('');
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
          <CardTitle>Contacts</CardTitle>
          <CardDescription>Paginated and filterable contacts list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search contact by name/email/phone"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact._id} className="border-t">
                    <td className="px-3 py-2">{contact.name}</td>
                    <td className="px-3 py-2">{contact.email}</td>
                    <td className="px-3 py-2">{contact.phone || '-'}</td>
                    <td className="px-3 py-2">{contact.title || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingContact(contact);
                            setName(contact.name);
                            setEmail(contact.email);
                            setPhone(contact.phone);
                            setTitle(contact.title);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(contact._id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!contactsQuery.isLoading && contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No contacts found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {contactMeta?.page ?? 1} of {contactMeta?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(contactMeta && page >= contactMeta.totalPages)}
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
