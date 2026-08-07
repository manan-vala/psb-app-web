'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';

const CODE_LENGTH = 6;

interface TrustedDeviceOption {
  id: string;
  label: string;
  platform: string | null;
  lastSeen: string;
}

type Stage = 'login' | 'unrecognised' | 'code' | 'granted';

/**
 * The unrecognised device trying to get in.
 *
 * Walks the four states of Scenario B: password accepted → device not
 * recognised → pick a trusted device to approve from → enter the code it
 * displays. Everything is keyed by an explicit fingerprint and a token held in
 * this component's state, never a cookie, so this pane and the trusted one
 * remain separate identities inside a single browser window.
 *
 * On success it stops at "access granted" rather than entering the app. Minting
 * a real session here would sign the whole browser window in as the demo
 * account — including the pane next to it — and the point has already been made
 * by then.
 */
export function NewDevicePane({
  accountNumber,
  fingerprint,
  deviceLabel,
  onStateChange,
}: {
  accountNumber: string;
  fingerprint: string;
  deviceLabel: string;
  onStateChange?: () => void;
}) {
  const [stage, setStage] = useState<Stage>('login');
  const [identifier, setIdentifier] = useState(accountNumber);
  const [password, setPassword] = useState('Demo@1234');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceOption[]>([]);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [ownerName, setOwnerName] = useState('');

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/devices/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password,
          deviceFingerprint: fingerprint,
          deviceLabel,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Could not sign in.');
        return;
      }

      setOwnerName(data.fullName ?? '');

      if (data.outcome === 'trusted') {
        // Already bound — this is what a returning device sees, and it's worth
        // being able to show: the check only interrupts unfamiliar hardware.
        setStage('granted');
        onStateChange?.();
        return;
      }

      setPendingToken(data.pendingToken);
      setTrustedDevices(data.trustedDevices ?? []);
      setStage('unrecognised');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async (targetDeviceId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/devices/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken,
          targetDeviceId,
          newDeviceFingerprint: fingerprint,
          newDeviceLabel: deviceLabel,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Could not send the code.');
        return;
      }

      setChallengeId(data.challengeId);
      setCode('');
      setStage('code');
      onStateChange?.();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/devices/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, challengeId, code: entered }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCodeError(true);
        setCode('');
        setError(data.error ?? 'That code is incorrect.');
        // A burnt or expired challenge can't be retried — send them back to
        // pick a device and raise a fresh one.
        if (data.failed || data.expired) setStage('unrecognised');
        return;
      }

      setStage('granted');
      onStateChange?.();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen dd-pane">
      <div className="dd-new">
        {stage === 'login' && (
          <>
            <div className="dd-new__head">
              <span className="hero-icon hero-icon--sm">
                <Icon name="lock-outline" size={26} />
              </span>
              <h2 className="t-headline-sm">Sign in</h2>
              <p className="t-body-sm c-variant">Bob World on a new device</p>
            </div>

            <Input
              label="Account number or mobile"
              value={identifier}
              onValueChange={setIdentifier}
              inputMode="numeric"
            />
            <Input label="Password" isPassword value={password} onValueChange={setPassword} />

            <Button
              label="Sign in"
              icon="arrow-forward"
              onClick={login}
              loading={busy}
            />
          </>
        )}

        {stage === 'unrecognised' && (
          <>
            <div className="dd-new__head">
              <span className="hero-icon hero-icon--sm hero-icon--tint">
                <Icon name="device-unknown" size={26} />
              </span>
              <h2 className="t-headline-sm">Device not recognised</h2>
              <p className="t-body-sm c-variant">
                Your password was correct, but we haven&rsquo;t seen this device before.
                Approve it from a device you already use.
              </p>
            </div>

            <div className="dd-devices">
              {trustedDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  className="dd-device"
                  disabled={busy}
                  onClick={() => requestCode(device.id)}
                >
                  <span className="dd-device__icon">
                    <Icon
                      name={device.platform === 'iOS' ? 'phone-iphone' : 'laptop'}
                      size={19}
                    />
                  </span>
                  <span className="dd-device__text">
                    <strong>{device.label}</strong>
                    <small>Last used {device.lastSeen}</small>
                  </span>
                  <Icon name="chevron-right" size={19} />
                </button>
              ))}
            </div>
          </>
        )}

        {stage === 'code' && (
          <>
            <div className="dd-new__head">
              <span className="hero-icon hero-icon--sm hero-icon--tint">
                <Icon name="pin" size={26} />
              </span>
              <h2 className="t-headline-sm">Enter the code</h2>
              <p className="t-body-sm c-variant">
                We sent a 6-digit code to your trusted device.
              </p>
            </div>

            <PinDots length={CODE_LENGTH} filled={code.length} error={codeError} />
            <PinKeypad
              pin={code}
              maxLength={CODE_LENGTH}
              onChangePin={(v) => {
                setCodeError(false);
                setCode(v);
              }}
              onComplete={submitCode}
              disabled={busy}
            />
          </>
        )}

        {stage === 'granted' && (
          <div className="dd-new__granted">
            <span className="hero-icon">
              <Icon name="check-circle" size={40} color="var(--success)" />
            </span>
            <h2 className="t-headline-sm">Device approved</h2>
            <p className="t-body-sm c-variant">
              {ownerName ? `Welcome back, ${ownerName.split(' ')[0]}. ` : ''}
              This device is now trusted and won&rsquo;t need verifying again.
            </p>
          </div>
        )}

        {error && stage !== 'granted' && (
          <p className="dd-new__error">
            <Icon name="error-outline" size={15} />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
