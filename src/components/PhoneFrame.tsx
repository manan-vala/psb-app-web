'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './ui/Icon';

/**
 * Renders the app inside a device mockup on desktop. On narrow viewports the
 * frame collapses (see globals.css) so real phones get the app full-bleed.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="stage">
      <div className="stage__inner">
        <div className="phone">
          <div className="phone__screen">
            <span className="phone__notch" />

            <div className="phone__statusbar">
              <span suppressHydrationWarning>{clock || ' '}</span>
              <span className="phone__statusbar-icons">
                <Icon name="signal-cellular-alt" size={16} />
                <Icon name="wifi" size={16} />
                <Icon name="battery-full" size={16} />
              </span>
            </div>

            <div className="phone__viewport">{children}</div>

            <span className="phone__home-indicator" />
          </div>
        </div>

        <div className="stage__caption">
          <h1>Bob World — Aegis Demo</h1>
          <p>
            A live build of the PSB banking app. Behavioural, device, network and
            journey telemetry is scored continuously by the Aegis backend.
          </p>
        </div>
      </div>
    </div>
  );
}
