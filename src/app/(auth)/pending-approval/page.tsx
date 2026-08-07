'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusTimeline, type TimelineStep } from '@/components/ui/StatusTimeline';
import { getAuthStatus, getOnboardingStatus, logout } from '@/services/auth';

/** How often to ask the bank whether a decision has been made. */
const POLL_MS = 3000;

/**
 * The waiting room between registering and being allowed into the app.
 *
 * Registration now creates a PENDING_APPROVAL account and a LIMITED session
 * that can do exactly one thing: poll `/api/onboarding/status`. That endpoint
 * also promotes the session to FULL the moment an analyst approves, which is
 * what lets this screen hand off to `/face-enroll`.
 *
 * See DEMO-IMPLEMENTATION-PLAN.md §3.
 */
export default function PendingApprovalScreen() {
  const router = useRouter();

  const [decision, setDecision] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    fullName: string;
    mobile: string;
    accountNumber: string;
  } | null>(null);

  // Guards the redirect so a poll that lands while we're already navigating
  // can't fire router.replace a second time.
  const settled = useRef(false);

  useEffect(() => {
    getAuthStatus().then((status) => {
      if (status.profile) {
        setProfile({
          fullName: status.profile.fullName,
          mobile: status.profile.mobile,
          accountNumber: status.profile.accountNumber,
        });
      }
      // No session at all means this screen was opened directly — there's
      // nothing to wait for.
      if (!status.scope) router.replace('/register');
    });
  }, [router]);

  const poll = useCallback(async () => {
    const result = await getOnboardingStatus();
    if (settled.current) return;

    if (result.requestId) setRequestId(result.requestId);
    if (result.submittedAt) setSubmittedAt(result.submittedAt);
    if (result.status) setDecision(result.status);

    if (result.status === 'APPROVED') {
      settled.current = true;
      // Brief pause so the timeline visibly completes before navigating —
      // otherwise the approval, which is the whole point of the screen, is
      // never actually seen.
      setTimeout(() => router.replace('/face-enroll'), 1200);
      return;
    }

    if (result.status === 'REJECTED') {
      settled.current = true;
      setTimeout(() => router.replace('/registration-rejected'), 900);
    }
  }, [router]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  const approved = decision === 'APPROVED';

  const steps: TimelineStep[] = [
    {
      label: 'Application submitted',
      description: submittedAt
        ? new Date(submittedAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Your details have been received',
      state: 'done',
    },
    {
      label: 'Under review by the bank',
      description: approved
        ? 'Details verified against branch records'
        : 'An officer is verifying your details against branch records',
      state: approved ? 'done' : 'current',
    },
    {
      label: 'Account activated',
      description: approved
        ? 'Taking you to set up Face ID…'
        : 'You can set up Face ID and a PIN once approved',
      state: approved ? 'done' : 'pending',
    },
  ];

  const handleCancel = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="screen">
      <span className="blob blob--top-right" />

      <div className="scroll">
        <div className="scroll__content" style={{ paddingTop: 40 }}>
          <div className="text-center mb-lg">
            <div className={`hero-icon${approved ? '' : ' hero-icon--tint'}`}>
              {approved ? <Icon name="check-circle" size={40} /> : <BobLogo size={64} />}
            </div>
            <h1 className="t-headline-md c-primary">
              {approved ? 'You’re approved' : 'Awaiting bank approval'}
            </h1>
            <p className="t-body-md c-variant" style={{ marginTop: 6 }}>
              {approved
                ? 'Your account has been activated. Setting things up…'
                : 'We’re checking your details against your branch records. This usually takes a few moments.'}
            </p>
          </div>

          {profile && (
            <div className="card card--pad mb-md">
              <p
                className="t-label-md c-variant"
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Submitted details
              </p>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <DetailRow label="Name" value={profile.fullName} />
                <DetailRow label="Mobile" value={profile.mobile} />
                <DetailRow label="Account number" value={profile.accountNumber} />
                {requestId && (
                  <DetailRow
                    label="Reference"
                    value={requestId.slice(0, 8).toUpperCase()}
                  />
                )}
              </div>
            </div>
          )}

          <div className="card card--pad mb-md">
            <StatusTimeline steps={steps} />
          </div>

          {!approved && (
            <>
              <div
                className="flex items-center justify-center"
                style={{ gap: 8, marginBottom: 16 }}
              >
                <span className="spinner" style={{ width: 14, height: 14 }} />
                <span className="t-body-sm c-variant">
                  Checking for updates every few seconds
                </span>
              </div>

              <Button label="Cancel and sign out" variant="ghost" onClick={handleCancel} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12 }}>
      <span className="t-body-sm c-variant">{label}</span>
      <span className="t-body-sm fw-medium" style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
