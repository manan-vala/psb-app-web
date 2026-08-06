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
 *
 * `/face-id-test` is a developer diagnostics console, not a customer screen —
 * it's deliberately outside the phone mockup because the thing being tested is
 * the camera feed, and a 260px circle inside a phone bezel is too small to
 * judge framing, lighting, or whether the liveness challenge actually
 * registered. It also lives outside the `(app)` route group, so it gets no
 * drawer or bottom nav.
 */
const FULL_VIEWPORT_ROUTES = new Set(['/', '/face-id-test']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (FULL_VIEWPORT_ROUTES.has(pathname)) {
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
