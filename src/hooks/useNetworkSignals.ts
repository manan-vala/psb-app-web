'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface NetworkSignals {
  lat: number;
  lon: number;
  isVpnLikely: boolean;
  isOnline: boolean;
}

/**
 * Web stand-in for the Expo app's `useVpnDetection` + location capture.
 *
 * IMPORTANT — this is a heuristic, not a detection. `expo-network` could ask
 * Android directly whether the active transport was a VPN; the browser has no
 * such API and never will, for good privacy reasons. What we can do is
 * compare two independent signals:
 *
 *   - the timezone the browser reports (a property of the machine), and
 *   - the longitude the Geolocation API reports (a property of the network /
 *     GPS position).
 *
 * A commercial VPN or proxy typically moves the apparent network location
 * while the OS clock stays put, so a large disagreement between the two is a
 * reasonable proxy signal. It is deliberately conservative (>3h) to avoid
 * false-positiving on travellers, and it degrades to `false` whenever the
 * user declines location access.
 */
const HOURS_MISMATCH_THRESHOLD = 3;

export function useNetworkSignals() {
  const [signals, setSignals] = useState<NetworkSignals>({
    lat: 0,
    lon: 0,
    isVpnLikely: false,
    isOnline: true,
  });
  const watchId = useRef<number | null>(null);

  const evaluate = useCallback((lat: number, lon: number) => {
    // Longitude -> expected UTC offset in hours (15 degrees per hour).
    const expectedOffsetHours = lon / 15;
    // getTimezoneOffset() is minutes *behind* UTC, hence the negation.
    const actualOffsetHours = -new Date().getTimezoneOffset() / 60;
    const drift = Math.abs(expectedOffsetHours - actualOffsetHours);

    const isVpnLikely = drift > HOURS_MISMATCH_THRESHOLD;

    setSignals((prev) => {
      // `watchPosition` re-fires on every position report, often with
      // identical coordinates. Returning `prev` unchanged keeps React from
      // re-rendering the telemetry provider — and therefore every screen —
      // for a value that did not actually move.
      if (prev.lat === lat && prev.lon === lon && prev.isVpnLikely === isVpnLikely) {
        return prev;
      }
      return { ...prev, lat, lon, isVpnLikely };
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setOnline = () =>
      setSignals((p) =>
        p.isOnline === navigator.onLine ? p : { ...p, isOnline: navigator.onLine }
      );
    setOnline();
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOnline);

    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => evaluate(pos.coords.latitude, pos.coords.longitude),
        () => {
          /* denied or unavailable — keep coordinates at 0 and stay quiet */
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
      );
    }

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOnline);
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [evaluate]);

  return signals;
}
