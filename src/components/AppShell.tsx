'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { AlertProvider } from '@/context/AlertContext';
import { AnalyzeCaptureProvider } from '@/context/AnalyzeCaptureContext';
import { CaptureSidebar } from '@/app/analyze/CaptureSidebar';

/**
 * The public landing page is a full-viewport marketing surface. Authenticated
 * and app routes retain the original phone mockup and in-frame alert behavior.
 *
 * `/analyze` is a self-contained capture-layer demo: it gets its own
 * telemetry context (isolated from the real `TelemetryProvider`/backend) and
 * swaps the phone's default caption for a live capture sidebar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/') {
    return <AlertProvider>{children}</AlertProvider>;
  }

  if (pathname === '/analyze') {
    return (
      <AnalyzeCaptureProvider>
        <PhoneFrame sidebar={<CaptureSidebar />}>
          <AlertProvider>{children}</AlertProvider>
        </PhoneFrame>
      </AnalyzeCaptureProvider>
    );
  }

  return (
    <PhoneFrame>
      <AlertProvider>{children}</AlertProvider>
    </PhoneFrame>
  );
}
