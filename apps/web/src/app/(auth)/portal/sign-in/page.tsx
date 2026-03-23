'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { portalSignIn } from '@/lib/api/operations';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type Values = z.infer<typeof schema>;

export default function PortalSignInPage() {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'portal@acme.local',
      password: 'ChangeMe@123'
    }
  });

  const mutation = useMutation({
    mutationFn: (values: Values) => portalSignIn(values),
    onSuccess: () => {
      router.push('/portal/tickets');
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Customer Portal Sign In</CardTitle>
          <CardDescription>Access your own tickets and follow-ups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Input placeholder="portal@company.com" {...form.register('email')} />
            <Input type="password" placeholder="********" {...form.register('password')} />
            {mutation.isError ? (
              <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Demo portal user: portal@acme.local / ChangeMe@123
          </div>
          <Link href="/sign-in" className="block text-center text-xs text-blue-700 hover:underline">
            Internal staff sign-in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
