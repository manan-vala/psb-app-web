'use client';

import { useEffect, useState } from 'react';
import { sha256 } from '@/services/auth';

const STORE_KEY = 'aegis_device_fingerprint';

/**
 * Web port of the Expo app's `useDeviceFingerprint`.
 *
 * Native hashed `osName|modelName|totalMemory|width|height`. The browser has
 * no model name or total memory, so we substitute the closest stable signals:
 * platform, user agent, screen geometry, colour depth, CPU concurrency,
 * device memory, and timezone — plus a canvas rendering hash, which varies by
 * GPU/driver and is the standard way to add entropy in a browser.
 */
function canvasHash(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('BobWorld:Aegis', 2, 15);
    ctx.fillStyle = 'rgba(102, 200, 0, 0.7)';
    ctx.fillText('BobWorld:Aegis', 4, 17);
    return canvas.toDataURL().slice(-64);
  } catch {
    return 'canvas-blocked';
  }
}

async function computeFingerprint(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const raw = [
    nav.platform,
    nav.userAgent,
    nav.hardwareConcurrency ?? 0,
    nav.deviceMemory ?? 0,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvasHash(),
  ].join('|');
  return sha256(raw);
}

export function useDeviceFingerprint() {
  const [fingerprintHash, setFingerprintHash] = useState('');
  const [isFirstDevice, setIsFirstDevice] = useState(false);
  const [isDeviceChanged, setIsDeviceChanged] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stored = window.localStorage.getItem(STORE_KEY);
        const currentHash = await computeFingerprint();
        if (cancelled) return;

        if (!stored) {
          setIsFirstDevice(true);
          window.localStorage.setItem(STORE_KEY, currentHash);
        } else {
          setIsFirstDevice(false);
          if (stored !== currentHash) {
            setIsDeviceChanged(true);
            window.localStorage.setItem(STORE_KEY, currentHash);
          } else {
            setIsDeviceChanged(false);
          }
        }
        setFingerprintHash(currentHash);
      } catch {
        /* storage or crypto unavailable — leave hash empty */
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return { fingerprintHash, isFirstDevice, isDeviceChanged };
}
