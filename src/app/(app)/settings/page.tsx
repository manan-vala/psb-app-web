'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { AVATAR_URL } from '@/constants/mock';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { getAuthStatus, logout, getFaceStatus, deleteFace, type UserProfile, type FaceStatus } from '@/services/auth';

/** Port of the Expo app's `(app)/settings.tsx`. */
export default function SettingsScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const { lastAssessment, trustScore, fingerprintHash, sessionId } = useTelemetry();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);

  useEffect(() => {
    getAuthStatus().then((status) => setProfile(status.profile));
    getFaceStatus().then(setFaceStatus);
  }, []);

  const handleDeleteFace = () => {
    showAlert('Delete Face Data?', 'This removes your stored face embedding. You can set it up again anytime.', [
      {
        text: 'Delete',
        onPress: async () => {
          const result = await deleteFace();
          if (result.ok) setFaceStatus({ enrolled: false });
          else showAlert('Something went wrong', result.error ?? 'Could not delete Face ID data.');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const comingSoon = (feature: string) =>
    showAlert('Coming Soon', `${feature} will be available in a future update.`);

  return (
    <div className="screen">
      <TopAppBar title="Settings" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div className="card flex items-center mb-lg" style={{ padding: 16, gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR_URL}
              alt=""
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div className="flex-1">
              <div className="t-body-lg fw-semibold">
                {profile?.fullName ?? 'Bob World Customer'}
              </div>
              <div className="t-body-sm c-variant">{profile?.mobile ?? '—'}</div>
              {profile?.accountNumber && (
                <div className="t-body-sm c-variant">A/C {profile.accountNumber}</div>
              )}
              {profile?.email && <div className="t-body-sm c-variant">{profile.email}</div>}
            </div>
          </div>

          <p className="section-label">Security</p>
          <div className="card mb-md">
            <button
              className="row"
              onClick={() => router.push('/password-login?next=set-pin')}
            >
              <span className="row__icon">
                <Icon name="password" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label" style={{ display: 'block' }}>
                  Change PIN
                </span>
                <span className="row__sub" style={{ display: 'block' }}>
                  Reset your 4-digit login PIN
                </span>
              </span>
              <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
            </button>

            <div className="divider" />

            <button className="row" onClick={() => comingSoon('Changing your password')}>
              <span className="row__icon">
                <Icon name="lock-reset" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label" style={{ display: 'block' }}>
                  Change Password
                </span>
                <span className="row__sub" style={{ display: 'block' }}>
                  Update your account password
                </span>
              </span>
              <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
            </button>

            <div className="divider" />

            {faceStatus?.enrolled ? (
              <>
                <button className="row" onClick={() => router.push('/face-enroll?mode=reenroll')}>
                  <span className="row__icon">
                    <Icon name="face" size={22} />
                  </span>
                  <span className="row__body">
                    <span className="row__label" style={{ display: 'block' }}>
                      Face ID
                    </span>
                    <span className="row__sub" style={{ display: 'block' }}>
                      Active
                      {faceStatus.enrolledAt
                        ? ` — enrolled on ${new Date(faceStatus.enrolledAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
                </button>
                <div className="divider" />
                <button className="row" onClick={handleDeleteFace}>
                  <span className="row__icon">
                    <Icon name="delete-outline" size={22} />
                  </span>
                  <span className="row__body">
                    <span className="row__label" style={{ display: 'block', color: 'var(--error)' }}>
                      Delete Face Data
                    </span>
                  </span>
                </button>
              </>
            ) : (
              <button className="row" onClick={() => router.push('/face-enroll')}>
                <span className="row__icon">
                  <Icon name="face" size={22} />
                </span>
                <span className="row__body">
                  <span className="row__label" style={{ display: 'block' }}>
                    Face ID
                  </span>
                  <span className="row__sub" style={{ display: 'block' }}>
                    Not set up
                  </span>
                </span>
                <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
              </button>
            )}
          </div>

          {/* Live session risk — the web build surfaces what the native app
              collected but never displayed. */}
          <p className="section-label">Session Security</p>
          <div className="card card--pad mb-md">
            <div className="flex justify-between items-center mb-sm">
              <span className="t-body-md fw-medium">Trust score</span>
              <span
                className="t-headline-sm"
                style={{
                  color:
                    trustScore > 80
                      ? 'var(--success)'
                      : trustScore >= 50
                      ? 'var(--warning)'
                      : 'var(--error)',
                }}
              >
                {trustScore}
              </span>
            </div>
            <div className="flex justify-between mb-sm">
              <span className="t-body-sm c-variant">Last decision</span>
              <span className="t-body-sm fw-medium">
                {lastAssessment?.action ?? 'Not yet assessed'}
              </span>
            </div>
            {lastAssessment && lastAssessment.flags.length > 0 && (
              <div className="flex mb-sm" style={{ gap: 6, flexWrap: 'wrap' }}>
                {lastAssessment.flags.map((flag) => (
                  <span
                    key={flag}
                    className="t-label-md"
                    style={{
                      background: 'var(--error-container)',
                      color: 'var(--on-error-container)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <span className="t-body-sm c-variant">Device ID</span>
              <span className="t-label-md c-variant">
                {fingerprintHash ? `${fingerprintHash.slice(0, 12)}…` : 'computing…'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="t-body-sm c-variant">Session</span>
              <span className="t-label-md c-variant">{sessionId}</span>
            </div>
          </div>

          <p className="section-label">Preferences</p>
          <div className="card mb-md">
            <div className="row">
              <span className="row__icon">
                <Icon name="notifications-none" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label" style={{ display: 'block' }}>
                  Push Notifications
                </span>
                <span className="row__sub" style={{ display: 'block' }}>
                  Alerts for transactions &amp; offers
                </span>
              </span>
              <button
                className={`switch${pushEnabled ? ' switch--on' : ''}`}
                onClick={() => setPushEnabled((v) => !v)}
                aria-label="Toggle push notifications"
              >
                <span className="switch__thumb" />
              </button>
            </div>
            <div className="divider" />
            <button className="row" onClick={() => comingSoon('Language settings')}>
              <span className="row__icon">
                <Icon name="language" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label" style={{ display: 'block' }}>
                  Language
                </span>
                <span className="row__sub" style={{ display: 'block' }}>
                  English (India)
                </span>
              </span>
              <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
            </button>
          </div>

          <p className="section-label">About</p>
          <div className="card mb-lg">
            <button className="row" onClick={() => comingSoon('Terms & Conditions')}>
              <span className="row__icon">
                <Icon name="description" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label">Terms &amp; Conditions</span>
              </span>
              <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
            </button>
            <div className="divider" />
            <button className="row" onClick={() => comingSoon('Privacy Policy')}>
              <span className="row__icon">
                <Icon name="privacy-tip" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label">Privacy Policy</span>
              </span>
              <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
            </button>
            <div className="divider" />
            <div className="row">
              <span className="row__icon">
                <Icon name="info-outline" size={22} />
              </span>
              <span className="row__body">
                <span className="row__label" style={{ display: 'block' }}>
                  App Version
                </span>
                <span className="row__sub" style={{ display: 'block' }}>
                  1.0.0
                </span>
              </span>
            </div>
          </div>

          <button
            className="btn btn--danger"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Icon name="logout" size={22} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
