'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface JourneyEntry {
  screen: string;
  enteredAt: number;
  dwellTime?: number;
}

/**
 * Web port of the Expo app's `useJourneyTracker`.
 *
 * Next.js route groups — (auth) and (app) — are stripped from the URL exactly
 * like expo-router strips them from `usePathname()`, so the screen names the
 * backend receives ("login", "home", "transfer") match the native client's.
 */
export function useJourneyTracker() {
  const pathname = usePathname();
  const sessionPath = useRef<string[]>([]);
  const currentEntry = useRef<JourneyEntry | null>(null);
  const dwellTimes = useRef<number[]>([]);

  useEffect(() => {
    const now = Date.now();

    if (currentEntry.current) {
      const dwell = now - currentEntry.current.enteredAt;
      currentEntry.current.dwellTime = dwell;
      dwellTimes.current.push(dwell);
    }

    const screenName = pathname.replace(/^\//, '') || 'index';
    sessionPath.current.push(screenName);
    currentEntry.current = { screen: screenName, enteredAt: now };
  }, [pathname]);

  function getCurrentJourney() {
    const path = sessionPath.current;
    const n = path.length;

    return {
      currentScreen: path[n - 1] ?? 'unknown',
      previousScreen: path[n - 2] ?? 'none',
      dwellTime: currentEntry.current ? Date.now() - currentEntry.current.enteredAt : 0,
      sessionPath: [...path],
      dwellTimes: [...dwellTimes.current],
    };
  }

  function reset() {
    sessionPath.current = [];
    dwellTimes.current = [];
    currentEntry.current = null;
  }

  // Stable identity — see the note in useKeystrokeDynamics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ getCurrentJourney, reset }), []);
}
