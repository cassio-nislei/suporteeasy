'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth/client';

const signInSchema = z.object({
  email: z.string().email('Provide a valid email'),
  password: z.string().min(8, 'Password must have at least 8 characters')
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: 'owner@acme.local',
      password: 'ChangeMe@123'
    }
  });

  const loginMutation = useMutation({
    mutationFn: (values: SignInValues) => signIn(values),
    onSuccess: () => {
      router.push('/dashboard');
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Access your tenant dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}>
            <div className="space-y-1">
              <Input type="email" placeholder="email@company.com" {...register('email')} />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1">
              <Input type="password" placeholder="********" {...register('password')} />
              {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
            </div>

            {loginMutation.isError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  {(loginMutation.error as Error).message}
                </div>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Demo: owner@acme.local / ChangeMe@123
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
