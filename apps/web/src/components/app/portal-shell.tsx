'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { portalMe, portalSignOut } from '@/lib/api/operations';
import { clearAuthSession } from '@/lib/auth/storage';

export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const meQuery = useQuery({
    queryKey: ['portal-me'],
    queryFn: portalMe
  });

  useEffect(() => {
    if (meQuery.isError) {
      clearAuthSession();
      router.replace('/portal/sign-in');
      return;
    }

    if (meQuery.data && !meQuery.data.permissions.includes('portal:access')) {
      clearAuthSession();
      router.replace('/portal/sign-in');
    }
  }, [meQuery.isError, meQuery.data, router]);

  if (meQuery.isLoading || !meQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading customer portal...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl p-4 md:p-6">
      <header className="mb-6 rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Customer Portal</h1>
            <p className="text-sm text-muted-foreground">
              {meQuery.data.tenant?.name} - {meQuery.data.email}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await portalSignOut();
              router.push('/portal/sign-in');
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
