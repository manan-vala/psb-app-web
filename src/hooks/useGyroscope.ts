'use client';

import { useEffect, useMemo, useRef } from 'react';

interface DeviceMotionEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Web port of the Expo app's `useGyroscope`, backed by the DeviceMotion API
 * (`rotationRate`) instead of `expo-sensors`.
 *
 * Availability differs from native: desktop browsers have no gyroscope at all,
 * and iOS Safari requires an explicit permission request from a user gesture.
 * When no readings arrive, `getVariance()` returns 0 — the same value the
 * backend already treats as "no motion signal".
 */
export function useGyroscope() {
  const readings = useRef<number[]>([]);
  const listening = useRef(false);

  function handleMotion(event: DeviceMotionEvent) {
    const rate = event.rotationRate;
    if (!rate) return;
    const x = rate.alpha ?? 0;
    const y = rate.beta ?? 0;
    const z = rate.gamma ?? 0;
    readings.current.push(Math.sqrt(x * x + y * y + z * z));
  }

  async function startSampling() {
    if (typeof window === 'undefined' || listening.current) return;
    readings.current = [];

    const ctor = window.DeviceMotionEvent as unknown as
      | DeviceMotionEventConstructorWithPermission
      | undefined;
    if (!ctor) return;

    // iOS 13+ gate. Silently degrade if the user declines.
    if (typeof ctor.requestPermission === 'function') {
      try {
        const result = await ctor.requestPermission();
        if (result !== 'granted') return;
      } catch {
        return;
      }
    }

    window.addEventListener('devicemotion', handleMotion);
    listening.current = true;
  }

  function stopSampling() {
    if (typeof window === 'undefined' || !listening.current) return;
    window.removeEventListener('devicemotion', handleMotion);
    listening.current = false;
  }

  function getVariance(): number {
    const data = readings.current;
    if (data.length < 2) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((acc, v) => acc + (v - mean) ** 2, 0) / data.length;
    return parseFloat(variance.toFixed(6));
  }

  useEffect(() => stopSampling, []);

  // Stable identity — see the note in useKeystrokeDynamics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ startSampling, stopSampling, getVariance }), []);
}
