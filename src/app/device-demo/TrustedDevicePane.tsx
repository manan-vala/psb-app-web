'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export interface PendingApproval {
  id: string;
  code: string;
  newDeviceLabel: string | null;
  expiresAt: string;
}

const POLL_MS = 2000;

/** mm:ss remaining, floored at zero. */
function countdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The customer's existing, already-trusted phone.
 *
 * It sits on a home screen doing nothing until a login from an unrecognised
 * device raises a challenge, then shows the approval banner carrying the code.
 * This is the half of Scenario B that makes the control legible: the code never
 * appears on the device asking for access, only on one the customer already
 * holds.
 *
 * Polls rather than holding a socket — same reasoning as everywhere else in
 * this build, the new endpoints are plain HTTP on psb-app-web.
 */
export function TrustedDevicePane({
  accountNumber,
  fingerprint,
  ownerName,
}: {
  accountNumber: string;
  fingerprint: string;
  ownerName: string;
}) {
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [tick, setTick] = useState(0);
  const [denying, setDenying] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/devices/notifications?accountNumber=${encodeURIComponent(
          accountNumber
        )}&fingerprint=${encodeURIComponent(fingerprint)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      setApproval(data.challenge ?? null);
    } catch {
      /* a dropped poll isn't a state change — keep whatever is on screen */
    }
  }, [accountNumber, fingerprint]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  // Drives the countdown label once a second, independently of the poll.
  useEffect(() => {
    if (!approval) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [approval]);
  void tick;

  const deny = async () => {
    if (!approval) return;
    setDenying(true);
    try {
      await fetch('/api/devices/challenge/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, fingerprint, challengeId: approval.id }),
      });
      setApproval(null);
      poll();
    } finally {
      setDenying(false);
    }
  };

  return (
    <div className="screen dd-pane">
      <div className="dd-home">
        <div className="dd-home__greeting">
          <p className="t-body-sm c-variant">Good afternoon</p>
          <h2 className="t-headline-sm">{ownerName.split(' ')[0]}</h2>
        </div>

        <div className="dd-home__balance">
          <p className="t-label-md c-variant">Available balance</p>
          <p className="dd-home__amount">₹24,680.00</p>
        </div>

        <div className="dd-home__tiles">
          {['send', 'account-balance-wallet', 'credit-card', 'bar-chart'].map((icon) => (
            <span key={icon} className="dd-home__tile">
              <Icon name={icon} size={19} />
            </span>
          ))}
        </div>

        {!approval && (
          <p className="dd-home__idle">
            <Icon name="verified-user" size={15} />
            This device is trusted
          </p>
        )}
      </div>

      {approval && (
        <div className="dd-banner" role="alert">
          <div className="dd-banner__head">
            <span className="dd-banner__icon">
              <Icon name="phonelink-lock" size={18} />
            </span>
            <div>
              <p className="dd-banner__title">Approve new device?</p>
              <p className="dd-banner__sub">
                {approval.newDeviceLabel ?? 'An unrecognised device'} is trying to sign in
              </p>
            </div>
          </div>

          <div className="dd-banner__code">
            {approval.code.split('').map((digit, i) => (
              <span key={i} className="dd-banner__digit">
                {digit}
              </span>
            ))}
          </div>

          <p className="dd-banner__expiry">
            Enter this code on the new device · expires in {countdown(approval.expiresAt)}
          </p>

          <Button
            label={denying ? 'Denying…' : 'Not you? Deny'}
            variant="danger"
            onClick={deny}
            disabled={denying}
          />
        </div>
      )}
    </div>
  );
}
