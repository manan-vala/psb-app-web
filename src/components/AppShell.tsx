'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { AlertProvider } from '@/context/AlertContext';
import { AnalyzeCaptureProvider } from '@/context/AnalyzeCaptureContext';
import { DemoAutofillProvider } from '@/context/DemoAutofillContext';
import { CaptureSidebar } from '@/app/analyze/CaptureSidebar';

/**
 * The public landing page is a full-viewport marketing surface. Authenticated
 * and app routes retain the original phone mockup and in-frame alert behavior.
 *
 * `/analyze` is a self-contained capture-layer demo: it gets its own
 * telemetry context (isolated from the real `TelemetryProvider`/backend) and
 * swaps the phone's default caption for a live capture sidebar.
 *
 * `/demo` is the scenario briefing shown before the live walkthrough. Like the
 * landing page it's a full-width marketing surface, not something that belongs
 * inside a phone bezel.
 *
 * `/device-demo` stages Scenario B as two phones side by side, so it renders
 * its own pair of device mockups rather than being wrapped in the single-phone
 * frame.
 *
 * `/face-id-test` is a developer diagnostics console, not a customer screen —
 * it's deliberately outside the phone mockup because the thing being tested is
 * the camera feed, and a 260px circle inside a phone bezel is too small to
 * judge framing, lighting, or whether the liveness challenge actually
 * registered. It also lives outside the `(app)` route group, so it gets no
 * drawer or bottom nav.
 */
/**
 * `/session-monitor` renders its own `PhoneFrame` with a sidebar, the same way
 * `/analyze` is composed here — so it must not be wrapped in a second one.
 */
const FULL_VIEWPORT_ROUTES = new Set([
  '/',
  '/demo',
  '/device-demo',
  '/session-monitor',
  '/face-id-test',
]);

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

  // The demo-autofill provider wraps PhoneFrame rather than sitting inside it:
  // the button that publishes an applicant renders beside the phone, and the
  // form that consumes it renders within, so the shared state has to be above
  // both.
  return (
    <DemoAutofillProvider>
      <PhoneFrame>
        <AlertProvider>{children}</AlertProvider>
      </PhoneFrame>
    </DemoAutofillProvider>
  );
}
