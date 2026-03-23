'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  deleteKnowledgeBaseArticle,
  getKnowledgeBaseArticle,
  updateKnowledgeBaseArticle
} from '@/lib/api/operations';
import { useToast } from '@/providers/toast-provider';

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ articleId: string }>();
  const articleId = params.articleId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const articleQuery = useQuery({
    queryKey: ['knowledge-base', articleId],
    queryFn: () => getKnowledgeBaseArticle(articleId)
  });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('internal');

  useEffect(() => {
    if (!articleQuery.data) {
      return;
    }
    setTitle(articleQuery.data.title);
    setSummary(articleQuery.data.summary);
    setContentMarkdown(articleQuery.data.contentMarkdown);
    setVisibility(articleQuery.data.visibility);
  }, [articleQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateKnowledgeBaseArticle(articleId, {
        title,
        summary,
        contentMarkdown,
        visibility
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base', articleId] });
      push({ title: 'Article saved', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Save failed', description: (error as Error).message, variant: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteKnowledgeBaseArticle(articleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      push({ title: 'Article deleted', variant: 'success' });
      router.push('/knowledge-base');
    }
  });

  if (articleQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading article...</p>;
  }

  if (articleQuery.isError || !articleQuery.data) {
    return <p className="text-sm text-red-600">{(articleQuery.error as Error)?.message ?? 'Article not found'}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{articleQuery.data.title}</h1>
        <p className="text-sm text-muted-foreground">Article editor with markdown content.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Article</CardTitle>
          <CardDescription>Changes are persisted in MongoDB and used by portal/internal views.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input value={summary} onChange={(event) => setSummary(event.target.value)} />
          <textarea
            className="min-h-56 rounded-md border px-3 py-2 text-sm md:col-span-2"
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
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
