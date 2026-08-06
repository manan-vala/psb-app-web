'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Signs the /face-id-test console into a demo account on mount and signs out
 * on the way out, so the console works without anyone registering first and a
 * demo session never follows you into the rest of the app.
 *
 * Sign-out fires from two places on purpose, because neither is sufficient
 * alone:
 *
 *   - the effect cleanup, which covers client-side navigation to another
 *     route (the common case — the drawer links, "Back to app");
 *   - a `pagehide` beacon, which covers tab close, reload and hard
 *     navigation, where React unmount handlers are not guaranteed to run.
 *
 * Both hit the same endpoint, and it's idempotent (a second call finds no
 * session and no-ops), so double-firing is harmless. `sendBeacon` is used for
 * the pagehide path specifically because a normal `fetch` is routinely
 * cancelled when the document goes away; a beacon is queued by the browser
 * and survives it.
 *
 * The endpoint refuses to end a non-demo session, so this is safe to call
 * even when the visitor was already signed in as a real user.
 */

export type DemoSessionMode = 'loading' | 'demo' | 'existing' | 'disabled' | 'error';

export interface DemoSessionState {
  mode: DemoSessionMode;
  /** Display name for whoever the console is now acting as. */
  name?: string;
  /** Populated when mode is 'disabled' or 'error'. */
  message?: string;
}

const START_URL = '/api/demo/session';
const END_URL = '/api/demo/session/end';

export function useDemoSession(): DemoSessionState {
  const [state, setState] = useState<DemoSessionState>({ mode: 'loading' });

  // Only end sessions this hook actually started. If the visitor arrived
  // already signed in ('existing'), leaving the console must not sign them
  // out — the server enforces this too, but not sending the request at all
  // is clearer and saves a round trip.
  const startedDemoSession = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(START_URL, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setState({ mode: 'error', message: data.error ?? 'Could not start a demo session.' });
          return;
        }

        if (data.mode === 'demo') {
          startedDemoSession.current = true;
          setState({ mode: 'demo', name: data.profile?.fullName });
        } else if (data.mode === 'existing') {
          setState({ mode: 'existing', name: data.profile?.fullName });
        } else {
          setState({ mode: 'disabled', message: data.reason });
        }
      } catch {
        if (!cancelled) {
          setState({ mode: 'error', message: 'Could not reach the server to start a demo session.' });
        }
      }
    })();

    const endViaBeacon = () => {
      if (!startedDemoSession.current) return;
      navigator.sendBeacon?.(END_URL);
    };

    window.addEventListener('pagehide', endViaBeacon);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', endViaBeacon);
      if (startedDemoSession.current) {
        // Not awaited — the component is going away regardless, and keepalive
        // lets the request outlive the unmount.
        fetch(END_URL, { method: 'POST', keepalive: true }).catch(() => {});
      }
    };
  }, []);

  return state;
}
