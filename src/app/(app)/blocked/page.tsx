'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTelemetry } from '@/context/TelemetryContext';
import { logout } from '@/services/auth';

/**
 * In-session block screen. The Expo app used this for a detected VPN
 * transport; the browser can't see the transport, so it now renders whatever
 * the risk orchestrator blocked on (impossible travel, paste-detected
 * credentials, device mismatch, journey anomalies).
 */
function BlockedScreen() {
  const router = useRouter();
  const reason = useSearchParams().get('reason');
  const { lastAssessment } = useTelemetry();

  return (
    <div className="screen screen--centered">
      <div className="text-center">
        <div className="hero-icon hero-icon--error mb-lg">
          <Icon name="gpp-bad" size={56} />
        </div>

        <h1 className="t-headline-md mb-sm">Session Blocked</h1>
        <p className="t-body-md c-variant mb-md" style={{ padding: '0 8px' }}>
          {reason ||
            'For your security, this session has been suspended after unusual activity was detected.'}
        </p>

        {lastAssessment && lastAssessment.flags.length > 0 && (
          <div
            className="flex justify-center mb-lg"
            style={{ gap: 6, flexWrap: 'wrap' }}
          >
            {lastAssessment.flags.map((flag) => (
              <span
                key={flag}
                className="t-label-md"
                style={{
                  background: 'var(--error-container)',
                  color: 'var(--on-error-container)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {flag}
              </span>
            ))}
          </div>
        )}

        <div className="w-full mt-lg">
          <Button
            label="Return to Login"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          />
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
