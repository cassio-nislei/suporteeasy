'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createScript,
  deleteScript,
  listScripts,
  updateScript,
  type ScriptRecord
} from '@/lib/api/operations';

export default function ScriptsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingScript, setEditingScript] = useState<ScriptRecord | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('maintenance');
  const [platform, setPlatform] = useState<'powershell' | 'bash' | 'python' | 'shell'>('powershell');
  const [body, setBody] = useState('');
  const [parameterNames, setParameterNames] = useState('');
  const [enabled, setEnabled] = useState(true);

  const scriptsQuery = useQuery({
    queryKey: ['scripts', page, search],
    queryFn: () =>
      listScripts({
        page,
        limit: 12,
        search
      })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parameters = parameterNames
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((paramName) => ({
          name: paramName,
          type: 'string',
          required: false
        }));

      const payload = {
        name,
        description,
        category,
        platform,
        body,
        parameters,
        enabled
      };

      if (editingScript) {
        return updateScript(editingScript._id, payload);
      }

      return createScript(payload);
    },
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['scripts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (scriptId: string) => deleteScript(scriptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scripts'] });
    }
  });

  function resetForm() {
    setEditingScript(null);
    setName('');
    setDescription('');
    setCategory('maintenance');
    setPlatform('powershell');
    setBody('');
    setParameterNames('');
    setEnabled(true);
  }

  const items = scriptsQuery.data?.items ?? [];
  const meta = scriptsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scripts</h1>
        <p className="text-sm text-muted-foreground">Create and manage remote scripts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingScript ? `Edit ${editingScript.name}` : 'Create Script'}</CardTitle>
          <CardDescription>Scripts are tenant-scoped and can be executed or scheduled.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            placeholder="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as 'powershell' | 'bash' | 'python' | 'shell')
            }
          >
            <option value="powershell">PowerShell</option>
            <option value="bash">Bash</option>
            <option value="python">Python</option>
            <option value="shell">Shell</option>
          </select>
          <Input
            className="md:col-span-3"
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Input
            className="md:col-span-3"
            placeholder="Body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Input
            className="md:col-span-2"
            placeholder="Parameters (comma separated)"
            value={parameterNames}
            onChange={(event) => setParameterNames(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>
          <div className="md:col-span-3 flex gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !body.trim()}
            >
              {saveMutation.isPending ? 'Saving...' : editingScript ? 'Update Script' : 'Create Script'}
            </Button>
            {editingScript ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script Library</CardTitle>
          <CardDescription>Browse and edit stored scripts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name/category"
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
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Platform</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((script) => (
                  <tr key={script._id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{script.name}</p>
                      <p className="text-xs text-muted-foreground">{script.description}</p>
                    </td>
                    <td className="px-3 py-2">{script.category}</td>
                    <td className="px-3 py-2 uppercase">{script.platform}</td>
                    <td className="px-3 py-2">{script.enabled ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingScript(script);
                            setName(script.name);
                            setDescription(script.description);
                            setCategory(script.category);
                            setPlatform(script.platform);
                            setBody(script.body);
                            setParameterNames(script.parameters.map((parameter) => parameter.name).join(', '));
                            setEnabled(script.enabled);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(script._id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!scriptsQuery.isLoading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No scripts found.
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
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
