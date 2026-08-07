'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './ui/Icon';
import { RegisterDemoPanel } from './RegisterDemoPanel';

/**
 * Renders the app inside a device mockup on desktop. On narrow viewports the
 * frame collapses (see globals.css) so real phones get the app full-bleed.
 *
 * `sidebar` optionally replaces the default marketing caption beside the
 * phone — used by `/analyze` to show a live telemetry panel instead. When
 * present, the phone sits in the remaining space and the sidebar is docked
 * as a full-height panel attached to the right edge of the viewport (rather
 * than floating centered next to the phone). Every other route is
 * unaffected — no `sidebar` prop means the original centered layout.
 */
/**
 * The device mockup itself — bezel, notch, status bar, home indicator.
 *
 * Exported separately from `PhoneFrame` because the device-binding demo puts
 * two phones side by side on one page, and needs the chrome without the
 * single-phone stage layout wrapped around it.
 */
export function PhoneChrome({ children }: { children: ReactNode }) {
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
    <div className="phone">
      <div className="phone__screen">
        <span className="phone__notch" />

        <div className="phone__statusbar">
          <span suppressHydrationWarning>{clock || ' '}</span>
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
  );
}

export function PhoneFrame({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  const pathname = usePathname();

  const phone = <PhoneChrome>{children}</PhoneChrome>;

  if (sidebar) {
    return (
      <div className="stage stage--docked">
        <div className="stage__phone-area">{phone}</div>
        <aside className="stage__sidebar-dock">{sidebar}</aside>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="stage__inner">
        {phone}
        <div className="stage__caption">
          <h1>Bob World — Aegis Demo</h1>
          <p>
            A live build of the PSB banking app. Behavioural, device, network and
            journey telemetry is scored continuously by the Aegis backend.
          </p>
          {/*
            Only on /register — it fills that form specifically, and there's
            nothing for it to autofill anywhere else.
          */}
          {pathname === '/register' && <RegisterDemoPanel />}
        </div>
      </div>
    </div>
  );
}
