'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/** Port of the Expo app's `(auth)/blocked.tsx` — the hard-block screen. */
function BlockedScreen() {
  const router = useRouter();
  const reason = useSearchParams().get('reason');

  return (
    <div className="screen screen--centered">
      <div className="text-center">
        <div className="hero-icon hero-icon--error mb-md">
          <Icon name="gpp-bad" size={56} />
        </div>
        <h1 className="t-headline-md c-error mb-sm">Access Blocked</h1>
        <p className="t-body-md c-variant" style={{ padding: '0 16px' }}>
          {reason ||
            'Suspicious activity detected. Your session has been terminated to protect your account.'}
        </p>

        <div className="mt-lg w-full">
          <Button label="Return to Login" onClick={() => router.replace('/login')} />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <span className="spinner" style={{ width: 34, height: 34 }} />
        </div>
      }
    >
      <BlockedScreen />
    </Suspense>
  );
}
