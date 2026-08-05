'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { AlertProvider } from '@/context/AlertContext';

/**
 * The public landing page is a full-viewport marketing surface. Authenticated
 * and app routes retain the original phone mockup and in-frame alert behavior.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/') {
    return <AlertProvider>{children}</AlertProvider>;
  }

  return (
    <PhoneFrame>
      <AlertProvider>{children}</AlertProvider>
    </PhoneFrame>
  );
}
