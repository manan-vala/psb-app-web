'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { hasAccount, hasPin } from '@/services/auth';

type PermissionState = 'checking' | 'granted' | 'denied';

/**
 * Entry screen — port of the Expo app's `app/index.tsx`.
 *
 * Gates on location permission (the native app treated this as mandatory for
 * fraud detection), then routes to the right auth screen based on what already
 * exists on this device:
 *   no account          -> register
 *   account but no PIN  -> password-login, then set-pin
 *   both present        -> PIN quick-login
 */
export default function EntryScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<PermissionState>('checking');

  const routeToAuthEntry = useCallback(() => {
    if (!hasAccount()) {
      router.replace('/register');
      return;
    }
    if (!hasPin()) {
      router.replace('/password-login?next=set-pin');
      return;
    }
    router.replace('/login');
  }, [router]);

  const requestPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // No Geolocation API at all — don't strand the user on a dead screen.
      setStatus('granted');
      routeToAuthEntry();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setStatus('granted');
        routeToAuthEntry();
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }, [routeToAuthEntry]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // The Permissions API lets us skip re-prompting when already granted.
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
          const result = await navigator.permissions.query({
            name: 'geolocation' as PermissionName,
          });
          if (cancelled) return;
          if (result.state === 'granted') {
            setStatus('granted');
            routeToAuthEntry();
            return;
          }
          if (result.state === 'denied') {
            setStatus('denied');
            return;
          }
        } catch {
          /* Permissions API unsupported — fall through to a direct prompt */
        }
      }
      if (!cancelled) requestPermission();
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [requestPermission, routeToAuthEntry]);

  if (status !== 'denied') {
    return (
      <div className="loading-screen">
        <span className="spinner" style={{ width: 34, height: 34 }} />
      </div>
    );
  }

  return (
    <div className="screen">
      <span className="blob blob--error" />
      <div className="screen--centered" style={{ flex: 1 }}>
        <div className="text-center" style={{ width: '100%' }}>
          <div className="hero-icon hero-icon--error">
            <Icon name="location-off" size={48} />
          </div>

          <h1 className="t-display-lg mb-sm">Location Required</h1>
          <p className="t-body-lg c-variant mb-lg" style={{ padding: '0 8px' }}>
            For security and fraud detection purposes, Bob World requires access to
            your device&apos;s location to proceed.
          </p>

          <div style={{ padding: '0 20px' }}>
            <Button
              label="Grant Permission"
              icon="location-on"
              onClick={requestPermission}
            />
            <p className="t-label-md c-variant mt-md">
              If you previously blocked location, enable it for this site in your
              browser&apos;s address-bar permissions, then tap again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
