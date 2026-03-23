import { ReactNode } from 'react';
import { PortalShell } from '@/components/app/portal-shell';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
