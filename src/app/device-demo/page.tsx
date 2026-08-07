'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PhoneChrome } from '@/components/PhoneFrame';
import { Icon } from '@/components/ui/Icon';
import { NewDevicePane } from './NewDevicePane';
import { TrustedDevicePane } from './TrustedDevicePane';

/**
 * Scenario B, staged as two phones side by side.
 *
 * Device binding is normally awkward to demonstrate: it needs two devices, two
 * sessions, and a five-minute code, and doing that across two browser windows
 * live is fragile. Putting both devices on one page removes all of that — but
 * only works because neither pane uses the session cookie. Each carries its own
 * fingerprint explicitly and holds its own token in React state, so a single
 * browser can host two genuinely separate device identities.
 *
 * The left pane impersonates one of Sunita's seeded trusted devices. The right
 * pane gets a fingerprint minted fresh on every page load, so every run is a
 * device the bank has genuinely never seen.
 */

/** Seeded in migration 007 as one of Sunita's trusted devices. */
const TRUSTED_FINGERPRINT = 'seed-fp-sunita-iphone-safari';
const DEMO_ACCOUNT = '10250043100782';
const DEMO_OWNER = 'Sunita Ramesh Patel';

export default function DeviceDemoPage() {
  // New every page load: the whole point is that this device is unknown, and a
  // stable fingerprint would be trusted from the second run onwards.
  const newFingerprint = useMemo(
    () => `demo-new-device-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  // Bumping this remounts the left pane so it polls immediately instead of
  // waiting out its interval after the right pane raises a challenge.
  const [, setSync] = useState(0);

  return (
    <main className="dd">
      <div className="dd__glow dd__glow--orange" />
      <div className="dd__glow dd__glow--blue" />
      <div className="dd__grid" />

      <header className="dd__header">
        <div>
          <span className="dd__eyebrow">
            <span className="dd__eyebrow-dot" />
            Scenario B · Device binding
          </span>
          <h1>A password alone shouldn&rsquo;t be enough.</h1>
          <p>
            Stolen credentials are worthless if they only work on hardware the customer
            already owns. Signing in from an unknown device needs approval from a known
            one — and the code only ever appears on the device the customer is holding.
          </p>
        </div>
        <Link href="/demo" className="dd__back">
          <Icon name="arrow-back" size={17} />
          Scenarios
        </Link>
      </header>

      <section className="dd__stage">
        <figure className="dd__device">
          <figcaption className="dd__label">
            <span className="dd__label-badge dd__label-badge--trusted">
              <Icon name="verified-user" size={13} />
              Trusted
            </span>
            <strong>Sunita&rsquo;s iPhone</strong>
            <small>Bound to this account 18 days ago</small>
          </figcaption>
          <PhoneChrome>
            <TrustedDevicePane
              accountNumber={DEMO_ACCOUNT}
              fingerprint={TRUSTED_FINGERPRINT}
              ownerName={DEMO_OWNER}
            />
          </PhoneChrome>
        </figure>

        <div className="dd__link" aria-hidden="true">
          <span className="dd__link-dot" />
          <span className="dd__link-line" />
          <span className="dd__link-label">approves</span>
          <span className="dd__link-line" />
          <span className="dd__link-dot" />
        </div>

        <figure className="dd__device">
          <figcaption className="dd__label">
            <span className="dd__label-badge dd__label-badge--unknown">
              <Icon name="device-unknown" size={13} />
              Unrecognised
            </span>
            <strong>New device</strong>
            <small>Never seen on this account</small>
          </figcaption>
          <PhoneChrome>
            <NewDevicePane
              accountNumber={DEMO_ACCOUNT}
              fingerprint={newFingerprint}
              deviceLabel="Chrome on Windows"
              onStateChange={() => setSync((s) => s + 1)}
            />
          </PhoneChrome>
        </figure>
      </section>

      <footer className="dd__footer">
        <span className="dd__footer-label">Watch on the bank console</span>
        <span className="dd__footer-item">
          <Icon name="smartphone" size={15} />
          Device Trust shows the live code and its countdown
        </span>
        <span className="dd__footer-item">
          <Icon name="block" size={15} />
          Revoking a device forces verification again on its next sign-in
        </span>
      </footer>
    </main>
  );
}
