'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createKnowledgeBaseArticle,
  listKnowledgeBaseArticles
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('# New article');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('internal');

  const articlesQuery = useQuery({
    queryKey: ['knowledge-base', search],
    queryFn: () => listKnowledgeBaseArticles({ page: 1, limit: 50, search })
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createKnowledgeBaseArticle({
        title,
        summary,
        contentMarkdown,
        visibility
      }),
    onSuccess: () => {
      setTitle('');
      setSummary('');
      setContentMarkdown('# New article');
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      push({ title: 'Article created', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Create failed', description: (error as Error).message, variant: 'error' });
    }
  });

  const items = articlesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Markdown articles with public/internal visibility.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Article</CardTitle>
          <CardDescription>Use markdown for procedures, runbooks and portal-facing docs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input
            placeholder="Summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
          <textarea
            className="min-h-40 rounded-md border px-3 py-2 text-sm md:col-span-2"
            value={contentMarkdown}
            onChange={(event) => setContentMarkdown(event.target.value)}
          />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'public' | 'internal')}
          >
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
          <div>
            <Button
              type="button"
              disabled={createMutation.isPending || !title.trim()}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Article'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
          <CardDescription>Open detail page to edit content and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search by title, summary or tags"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {articlesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading articles...</p> : null}
          {articlesQuery.isError ? (
            <p className="text-sm text-red-600">{(articlesQuery.error as Error).message}</p>
          ) : null}

          <div className="space-y-2">
            {items.map((article) => (
              <Link
                key={article._id}
                href={`/knowledge-base/${article._id}`}
                className="block rounded-md border px-3 py-2 hover:bg-muted/40"
              >
                <p className="font-medium">{article.title}</p>
                <p className="text-xs text-muted-foreground">
                  {article.visibility} · {article.slug}
                </p>
              </Link>
            ))}
            {!articlesQuery.isLoading && items.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No articles found.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
