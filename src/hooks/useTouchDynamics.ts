'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

export interface TouchLiveState {
  pressure: number | null;
  tapArea: number | null;
  tapDuration: number | null;
  centerOffset: number | null;
  swipeVelocity: number | null;
  pointerType: string | null;
  activePointers: number;
  multitouchMax: number;
  tapCount: number;
  awaitingTouch: boolean;
}

export interface TouchMetrics extends TouchLiveState {
  pressureStdDev: number | null;
}

const INITIAL_STATE: TouchLiveState = {
  pressure: null,
  tapArea: null,
  tapDuration: null,
  centerOffset: null,
  swipeVelocity: null,
  pointerType: null,
  activePointers: 0,
  multitouchMax: 0,
  tapCount: 0,
  awaitingTouch: true,
};

/**
 * Captures pointer/touch dynamics — pressure, contact area, tap duration,
 * offset from the touched element's center, and swipe velocity — using the
 * standard Pointer Events API. Works with touch, pen, and mouse (mouse
 * reports pressure 0.5 while a button is held, matching the browser spec).
 *
 * Bind `bind()` onto any container that should be instrumented (typically
 * the phone viewport root) rather than individual buttons, so drags/taps
 * anywhere on screen are captured.
 */
export function useTouchDynamics() {
  const [live, setLive] = useState<TouchLiveState>(INITIAL_STATE);

  const pressures = useRef<number[]>([]);
  const areas = useRef<number[]>([]);
  const durations = useRef<number[]>([]);
  const offsets = useRef<number[]>([]);
  const velocities = useRef<number[]>([]);
  const activeDowns = useRef<Map<number, { x: number; y: number; t: number }>>(new Map());
  const tapCount = useRef(0);
  const multitouchMax = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activeDowns.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    multitouchMax.current = Math.max(multitouchMax.current, activeDowns.current.size);

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const offset = Math.round(Math.hypot(e.clientX - cx, e.clientY - cy));

    // width/height are the contact-geometry ellipse axes (touch), or 1x1 for mouse.
    const area = Math.round((e.width || 1) * (e.height || 1));
    // Browsers report 0.5 for mouse while a button is pressed; 0 otherwise.
    const pressure = e.pressure ?? 0;

    pressures.current.push(pressure);
    areas.current.push(area);
    offsets.current.push(offset);

    setLive((prev) => ({
      ...prev,
      pressure,
      tapArea: area,
      centerOffset: offset,
      pointerType: e.pointerType,
      activePointers: activeDowns.current.size,
      multitouchMax: multitouchMax.current,
      awaitingTouch: false,
    }));
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeDowns.current.has(e.pointerId)) return;
    const pressure = e.pressure ?? 0;
    pressures.current.push(pressure);
    setLive((prev) => ({ ...prev, pressure, pointerType: e.pointerType }));
  }, []);

  const endPointer = useCallback((e: React.PointerEvent) => {
    const start = activeDowns.current.get(e.pointerId);
    activeDowns.current.delete(e.pointerId);
    if (!start) return;

    const now = performance.now();
    const duration = Math.round(now - start.t);
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const velocity = duration > 0 ? parseFloat((dist / duration).toFixed(3)) : 0;

    durations.current.push(duration);
    if (dist > 8) velocities.current.push(velocity);
    tapCount.current += 1;

    setLive((prev) => ({
      ...prev,
      tapDuration: duration,
      swipeVelocity: dist > 8 ? velocity : prev.swipeVelocity,
      activePointers: activeDowns.current.size,
      tapCount: tapCount.current,
    }));
  }, []);

  const bind = useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    }),
    [handlePointerDown, handlePointerMove, endPointer]
  );

  const getMetrics = useCallback((): TouchMetrics => {
    const mean = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const p = pressures.current;
    const pMean = mean(p);
    const pStdDev =
      p.length > 1
        ? Math.sqrt(p.reduce((acc, v) => acc + (v - pMean) ** 2, 0) / p.length)
        : 0;

    return {
      ...live,
      pressure: p.length ? parseFloat(pMean.toFixed(3)) : live.pressure,
      tapArea: areas.current.length ? Math.round(mean(areas.current)) : live.tapArea,
      tapDuration: durations.current.length ? Math.round(mean(durations.current)) : live.tapDuration,
      centerOffset: offsets.current.length ? Math.round(mean(offsets.current)) : live.centerOffset,
      swipeVelocity: velocities.current.length
        ? parseFloat(mean(velocities.current).toFixed(3))
        : live.swipeVelocity,
      pressureStdDev: p.length ? parseFloat(pStdDev.toFixed(3)) : null,
    };
  }, [live]);

  const reset = useCallback(() => {
    pressures.current = [];
    areas.current = [];
    durations.current = [];
    offsets.current = [];
    velocities.current = [];
    activeDowns.current.clear();
    tapCount.current = 0;
    multitouchMax.current = 0;
    setLive(INITIAL_STATE);
  }, []);

  return { live, bind, getMetrics, reset };
}
