'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { getAuthStatus, getOnboardingStatus, logout } from '@/services/auth';

/**
 * Terminal state for a registration the bank declined.
 *
 * Deliberately a dead end in the app: there's no "try again" button, because
 * re-registering wouldn't help — the account number is already taken by the
 * rejected user row, and whatever the branch found wrong isn't something the
 * customer can fix by retyping it. The only real next step is the branch, so
 * that's the only action offered besides signing out.
 */
export default function RegistrationRejectedScreen() {
  const router = useRouter();

  const [reason, setReason] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getOnboardingStatus(), getAuthStatus()]).then(
      ([onboarding, auth]) => {
        if (cancelled) return;

        // Guard against landing here by URL. Only a genuinely rejected
        // registration should see this screen; anything else goes back to the
        // flow it belongs to.
        if (onboarding.status && onboarding.status !== 'REJECTED') {
          router.replace(
            onboarding.status === 'APPROVED' ? '/face-enroll' : '/pending-approval'
          );
          return;
        }
        if (!onboarding.status && !auth.scope) {
          router.replace('/register');
          return;
        }

        setReason(onboarding.rejectionReason);
        setReference(onboarding.requestId?.slice(0, 8).toUpperCase() ?? null);
        setAccountNumber(auth.profile?.accountNumber ?? null);
        setChecked(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    await logout();
    router.replace('/');
  };

  if (!checked) {
    return (
      <div className="screen screen--centered">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="screen">
      <span className="blob blob--error" />

      <div className="scroll">
        <div className="scroll__content" style={{ paddingTop: 40 }}>
          <div className="text-center mb-lg">
            <div className="hero-icon hero-icon--error">
              <Icon name="error-outline" size={40} />
            </div>
            <h1 className="t-headline-md">Registration not approved</h1>
            <p className="t-body-md c-variant" style={{ marginTop: 6 }}>
              Your application could not be verified against your branch records.
            </p>
          </div>

          {reason && (
            <div
              className="card card--pad mb-md"
              style={{ borderLeft: '3px solid var(--error)' }}
            >
              <p
                className="t-label-md c-variant"
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Reason given
              </p>
              <p className="t-body-md" style={{ marginTop: 6 }}>
                {reason}
              </p>
            </div>
          )}

          <div className="card card--pad mb-md">
            <p className="t-body-sm c-variant">
              Please visit your home branch with a valid photo ID and your passbook.
              Branch staff can confirm your details and re-submit the application
              for you.
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accountNumber && (
                <div className="flex items-center justify-between" style={{ gap: 12 }}>
                  <span className="t-body-sm c-variant">Account number</span>
                  <span className="t-body-sm fw-medium">{accountNumber}</span>
                </div>
              )}
              {reference && (
                <div className="flex items-center justify-between" style={{ gap: 12 }}>
                  <span className="t-body-sm c-variant">Reference</span>
                  <span className="t-body-sm fw-medium">{reference}</span>
                </div>
              )}
            </div>
          </div>

          {/*
            No route into /support from here. That page lives in the (app)
            group, which renders the banking bottom-nav and drawer — dropping a
            rejected applicant into the signed-in app shell would undo the
            point of this screen. The contact route is genuinely offline, so it
            is presented as such.
          */}
          <a href="tel:18005700" style={{ display: 'block', textDecoration: 'none' }}>
            <Button label="Call 1800 5700" icon="support-agent" />
          </a>
          <div style={{ marginTop: 8 }}>
            <Button label="Sign out" variant="ghost" onClick={handleSignOut} />
          </div>
        </div>
      </div>
    </div>
  );
}
