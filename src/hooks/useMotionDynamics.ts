'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface MotionLiveState {
  pitch: number | null; // beta
  roll: number | null; // gamma
  yaw: number | null; // alpha
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  available: boolean;
  permissionDenied: boolean;
}

interface DeviceOrientationEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const INITIAL_STATE: MotionLiveState = {
  pitch: null,
  roll: null,
  yaw: null,
  accelX: null,
  accelY: null,
  accelZ: null,
  available: false,
  permissionDenied: false,
};

const MAX_SAMPLES = 200;

/**
 * Live device-motion capture for the /analyze demo — separate from the
 * production `useGyroscope` hook (which only exposes a rolling variance).
 * This surfaces the raw pitch/roll/yaw and per-axis acceleration so the
 * capture sidebar can show live numbers the way a native sensor panel would,
 * plus per-axis variance so a "human handheld jitter vs. flat desktop" signal
 * is still derivable.
 */
export function useMotionDynamics() {
  const [live, setLive] = useState<MotionLiveState>(INITIAL_STATE);
  const listening = useRef(false);
  const samples = useRef<{ x: number; y: number; z: number }[]>([]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    setLive((prev) => ({
      ...prev,
      pitch: event.beta !== null ? Math.round(event.beta) : prev.pitch,
      roll: event.gamma !== null ? Math.round(event.gamma) : prev.roll,
      yaw: event.alpha !== null ? Math.round(event.alpha) : prev.yaw,
      available: true,
    }));
  }, []);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a) return;
    const x = a.x ?? 0;
    const y = a.y ?? 0;
    const z = a.z ?? 0;
    samples.current.push({ x, y, z });
    if (samples.current.length > MAX_SAMPLES) samples.current.shift();

    setLive((prev) => ({
      ...prev,
      accelX: parseFloat(x.toFixed(2)),
      accelY: parseFloat(y.toFixed(2)),
      accelZ: parseFloat(z.toFixed(2)),
      available: true,
    }));
  }, []);

  const startSampling = useCallback(async () => {
    if (typeof window === 'undefined' || listening.current) return;

    const motionCtor = window.DeviceMotionEvent as unknown as
      | DeviceOrientationEventConstructorWithPermission
      | undefined;
    const orientationCtor = window.DeviceOrientationEvent as unknown as
      | DeviceOrientationEventConstructorWithPermission
      | undefined;

    // iOS 13+ requires an explicit, gesture-triggered permission prompt for
    // both APIs. Desktop / Android browsers have no such gate.
    for (const ctor of [motionCtor, orientationCtor]) {
      if (ctor && typeof ctor.requestPermission === 'function') {
        try {
          const result = await ctor.requestPermission();
          if (result !== 'granted') {
            setLive((prev) => ({ ...prev, permissionDenied: true }));
            return;
          }
        } catch {
          setLive((prev) => ({ ...prev, permissionDenied: true }));
          return;
        }
      }
    }

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
    listening.current = true;
  }, [handleOrientation, handleMotion]);

  const stopSampling = useCallback(() => {
    if (typeof window === 'undefined' || !listening.current) return;
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);
    listening.current = false;
  }, [handleOrientation, handleMotion]);

  const getVariance = useCallback(() => {
    const data = samples.current;
    if (data.length < 2) return { x: 0, y: 0, z: 0 };
    const meanOf = (key: 'x' | 'y' | 'z') =>
      data.reduce((acc, v) => acc + v[key], 0) / data.length;
    const mx = meanOf('x');
    const my = meanOf('y');
    const mz = meanOf('z');
    const varOf = (key: 'x' | 'y' | 'z', m: number) =>
      parseFloat(
        (data.reduce((acc, v) => acc + (v[key] - m) ** 2, 0) / data.length).toFixed(4)
      );
    return { x: varOf('x', mx), y: varOf('y', my), z: varOf('z', mz) };
  }, []);

  const reset = useCallback(() => {
    samples.current = [];
    setLive(INITIAL_STATE);
  }, []);

  useEffect(() => stopSampling, [stopSampling]);

  return useMemo(
    () => ({ live, startSampling, stopSampling, getVariance, reset }),
    [live, startSampling, stopSampling, getVariance, reset]
  );
}
