import { ReactNode } from 'react';
import { ProtectedShell } from '@/components/app/protected-shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
