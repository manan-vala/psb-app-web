'use client';

import { useMemo, useRef } from 'react';

export interface KeystrokeMetrics {
  meanHoldTime: number;
  meanFlightTime: number;
  typingStdDev: number;
  wpmEstimate: number;
  keypressCount: number;
}

/**
 * Web port of the Expo app's `useKeystrokeDynamics`.
 *
 * The native version had to approximate hold time as `meanFlightTime * 0.8`
 * because React Native has no `onKeyUp`. The browser gives us real keydown
 * and keyup events, so hold time here is genuinely measured (down -> up) and
 * flight time is the gap between one key's release and the next key's press.
 */
export function useKeystrokeDynamics() {
  const holdTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const downAt = useRef<Map<string, number>>(new Map());
  const lastUpAt = useRef<number | null>(null);
  const firstKeyPressAt = useRef<number | null>(null);
  const charCount = useRef(0);

  function onKeyDown(e: { key: string }) {
    const now = Date.now();
    if (firstKeyPressAt.current === null) firstKeyPressAt.current = now;
    if (!downAt.current.has(e.key)) downAt.current.set(e.key, now);
    if (lastUpAt.current !== null) {
      flightTimes.current.push(now - lastUpAt.current);
    }
  }

  function onKeyUp(e: { key: string }) {
    const now = Date.now();
    const start = downAt.current.get(e.key);
    if (start !== undefined) {
      holdTimes.current.push(now - start);
      downAt.current.delete(e.key);
    }
    lastUpAt.current = now;
    if (e.key.length === 1) charCount.current++;
  }

  /** Spread onto any <input> to instrument it. */
  function getInputProps() {
    return { onKeyDown, onKeyUp };
  }

  /** Records a virtual keypress (used by the on-screen PIN keypad). */
  function registerVirtualKeypress() {
    const now = Date.now();
    if (firstKeyPressAt.current === null) firstKeyPressAt.current = now;
    if (lastUpAt.current !== null) flightTimes.current.push(now - lastUpAt.current);
    // A tap has no measurable hold; use the observed press-to-press cadence so
    // the distribution isn't artificially zeroed out.
    holdTimes.current.push(70);
    lastUpAt.current = now;
    charCount.current++;
  }

  function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function getMetrics(): KeystrokeMetrics {
    const flights = flightTimes.current;
    const meanFlightTime = mean(flights);
    const meanHoldTime = mean(holdTimes.current);

    const variance =
      flights.length > 1
        ? flights.reduce((acc, t) => acc + (t - meanFlightTime) ** 2, 0) / flights.length
        : 0;
    const typingStdDev = Math.sqrt(variance);

    const elapsedMin = firstKeyPressAt.current
      ? (Date.now() - firstKeyPressAt.current) / 60000
      : 0;
    const wpmEstimate = elapsedMin > 0 ? charCount.current / 5 / elapsedMin : 0;

    return {
      meanHoldTime: Math.round(meanHoldTime),
      meanFlightTime: Math.round(meanFlightTime),
      typingStdDev: Math.round(typingStdDev),
      wpmEstimate: Math.round(wpmEstimate),
      keypressCount: charCount.current,
    };
  }

  function reset() {
    holdTimes.current = [];
    flightTimes.current = [];
    downAt.current.clear();
    lastUpAt.current = null;
    firstKeyPressAt.current = null;
    charCount.current = 0;
  }

  // Every function above closes over refs only, so the returned object is
  // safe to freeze for the lifetime of the hook. Without this it was a fresh
  // object on each render, which defeated the memo on the telemetry context
  // value and re-rendered every consumer on any unrelated state change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({ getInputProps, registerVirtualKeypress, getMetrics, reset }),
    []
  );
}
