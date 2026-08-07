'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export interface Assessment {
  riskScore: number;
  action: 'ALLOW' | 'STEP_UP' | 'BLOCK';
  flags: string[];
  engines: { network: number; device: number; behavior: number; journey: number };
  reasons: string[];
  features: {
    keystrokeSamples: number;
    keystrokeStdDevMs: number | null;
    keystrokeMeanMs: number | null;
    amount: number | null;
    baselineAverage: number | null;
    timesBaseline: number | null;
  };
}

export interface Baseline {
  fullName: string;
  baselineAverage: number | null;
  largest: number | null;
  transactionCount: number;
  highValueThreshold: number | null;
}

export interface KeystrokeEvent {
  index: number;
  /** ms key was held down (keydown→keyup). null if keyup hasn't fired yet. */
  dwellMs: number | null;
  /** ms between previous keyup and this keydown. null for the first key. */
  flightMs: number | null;
}

const ENGINE_LABELS: Record<string, string> = {
  network: 'Network',
  device: 'Device',
  behavior: 'Behaviour',
  journey: 'Journey',
};

interface DeviceInfo {
  platform: string;
  secureContext: boolean;
  pointerEvents: boolean;
  touchInput: boolean;
  cpuCores: number;
  deviceMemory: string;
  screen: string;
  fingerprint: string;
}

interface NetworkInfo {
  gps: string;
  connection: string;
  downlink: string;
  gpu: string;
  online: boolean;
  tabSwitches: number;
}

interface TouchInfo {
  pressure: number;
  tapArea: string;
  tapDuration: string;
  centerOffset: string;
  swipeVelocity: string;
  pointer: string;
  pressureSigma: number;
  tapCount: number;
  maxConcurrent: number;
}

function useDeviceInfo(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>({
    platform: '—',
    secureContext: false,
    pointerEvents: false,
    touchInput: false,
    cpuCores: 0,
    deviceMemory: '—',
    screen: '—',
    fingerprint: '—',
  });

  useEffect(() => {
    // Via `unknown`: Navigator has no index signature, so TypeScript refuses a
    // direct cast. These are non-standard properties (deviceMemory,
    // connection) that are not in the DOM lib but do exist in Chromium.
    const nav = navigator as unknown as Record<string, unknown>;
    const dpr = window.devicePixelRatio ?? 1;
    // Simple fingerprint-like hash from user agent
    const ua = navigator.userAgent;
    let hash = 0;
    for (let i = 0; i < ua.length; i++) {
      hash = ((hash << 5) - hash + ua.charCodeAt(i)) | 0;
    }
    const fp = `#${(hash >>> 0).toString(16).padStart(8, '0')}`;

    setInfo({
      platform: navigator.platform || '—',
      secureContext: window.isSecureContext,
      pointerEvents: 'PointerEvent' in window,
      touchInput: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      cpuCores: navigator.hardwareConcurrency ?? 0,
      deviceMemory: (nav.deviceMemory as number | undefined)
        ? `${nav.deviceMemory} GB`
        : '—',
      screen: `${screen.width}x${screen.height} @${dpr}x`,
      fingerprint: fp,
    });
  }, []);

  return info;
}

function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    gps: '—',
    connection: '—',
    downlink: '—',
    gpu: '—',
    online: navigator.onLine,
    tabSwitches: 0,
  });

  useEffect(() => {
    // GPS
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setInfo((prev) => ({
            ...prev,
            gps: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
          }));
        },
        () => setInfo((prev) => ({ ...prev, gps: 'denied' }))
      );
    }

    // Connection
    const conn = (navigator as unknown as Record<string, unknown>).connection as
      | { effectiveType?: string; rtt?: number; downlink?: number }
      | undefined;
    if (conn) {
      setInfo((prev) => ({
        ...prev,
        connection: conn.effectiveType
          ? `${conn.effectiveType}${conn.rtt ? ` · ${conn.rtt}ms` : ''}`
          : '—',
        downlink: conn.downlink != null ? `${conn.downlink} Mbps` : '—',
      }));
    }

    // GPU
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
      if (gl && gl instanceof WebGLRenderingContext) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
          setInfo((prev) => ({
            ...prev,
            gpu: renderer.length > 38 ? renderer.slice(0, 38) + '…' : renderer,
          }));
        }
      }
    } catch {
      // not available
    }

    // Tab switches
    const onVisibilityChange = () => {
      if (document.hidden) {
        setInfo((prev) => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Online status
    const onOnline = () => setInfo((prev) => ({ ...prev, online: true }));
    const onOffline = () => setInfo((prev) => ({ ...prev, online: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return info;
}

function useTouchInfo(): TouchInfo {
  const [info, setInfo] = useState<TouchInfo>({
    pressure: 0.5,
    tapArea: '—',
    tapDuration: '—',
    centerOffset: '—',
    swipeVelocity: '—',
    pointer: 'mouse',
    pressureSigma: 0,
    tapCount: 0,
    maxConcurrent: 0,
  });

  useEffect(() => {
    let tapStart = 0;
    let tapCount = 0;
    let maxConcurrent = 0;
    const pressures: number[] = [];

    const onPointerDown = (e: PointerEvent) => {
      tapStart = performance.now();
      tapCount++;
      const p = e.pressure || 0.5;
      pressures.push(p);

      // Standard deviation of pressure
      const mean = pressures.reduce((a, b) => a + b, 0) / pressures.length;
      const sigma = pressures.length > 1
        ? Math.sqrt(pressures.reduce((s, v) => s + (v - mean) ** 2, 0) / pressures.length)
        : 0;

      setInfo((prev) => ({
        ...prev,
        pressure: Number(p.toFixed(2)),
        tapArea: `${Math.round(e.width * e.height)}px²`,
        centerOffset: `${Math.round(Math.sqrt(e.offsetX ** 2 + e.offsetY ** 2))}px`,
        pointer: e.pointerType || 'mouse',
        pressureSigma: Number(sigma.toFixed(2)),
        tapCount,
        maxConcurrent: Math.max(maxConcurrent, 1),
      }));
    };

    const onPointerUp = () => {
      if (tapStart > 0) {
        const duration = Math.round(performance.now() - tapStart);
        setInfo((prev) => ({ ...prev, tapDuration: `${duration}ms` }));
        tapStart = 0;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > maxConcurrent) {
        maxConcurrent = e.touches.length;
        setInfo((prev) => ({ ...prev, maxConcurrent }));
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  return info;
}

/**
 * The panel beside the phone: what the bank is measuring, and what it concluded.
 *
 * Leads with the verdict, then shows keystroke dynamics with bars, then touch,
 * network/location, and device intelligence sections.
 */
export function RiskSidebar({
  assessment,
  baseline,
  sessionId,
  keystrokeSamples,
  keystrokeEvents,
  liveAmount,
}: {
  assessment: Assessment | null;
  baseline: Baseline | null;
  sessionId: string;
  keystrokeSamples: number;
  keystrokeEvents: KeystrokeEvent[];
  liveAmount: number | null;
}) {
  const action = assessment?.action ?? 'ALLOW';
  const score = assessment?.riskScore ?? 0;
  const device = useDeviceInfo();
  const network = useNetworkInfo();
  const touch = useTouchInfo();

  const overThreshold =
    baseline?.highValueThreshold != null &&
    liveAmount != null &&
    liveAmount > baseline.highValueThreshold;

  // Max dwell for bar scaling
  const maxDwell = Math.max(200, ...keystrokeEvents.map((e) => e.dwellMs ?? 0));

  return (
    <div className="sm-side">
      <header className="sm-side__head">
        <span className="sm-side__live">
          <span className="sm-side__live-dot" />
          Live
        </span>
        <h2>Aegis session monitor</h2>
        <p className="sm-side__session">{sessionId}</p>
      </header>

      {/* ── Verdict ────────────────────────────────────────────────────── */}
      <section className={`sm-verdict sm-verdict--${action.toLowerCase()}`}>
        <div className="sm-verdict__top">
          <div>
            <p className="sm-verdict__label">Risk score</p>
            <p className="sm-verdict__score">{score}</p>
          </div>
          <span className="sm-verdict__action">{action.replace('_', ' ')}</span>
        </div>

        <div className="sm-engines">
          {(['network', 'device', 'behavior', 'journey'] as const).map((key) => {
            const value = assessment?.engines[key] ?? 100;
            return (
              <div key={key} className="sm-engine">
                <span className="sm-engine__name">{ENGINE_LABELS[key]}</span>
                <span className="sm-engine__track">
                  <span
                    className="sm-engine__fill"
                    style={{
                      width: `${value}%`,
                      background: value < 70 ? 'var(--error)' : 'var(--success)',
                    }}
                  />
                </span>
                <span className="sm-engine__value">{value}</span>
              </div>
            );
          })}
        </div>

        {assessment && assessment.flags.length > 0 && (
          <div className="sm-flags">
            {assessment.flags.map((flag) => (
              <span key={flag} className="sm-flag">
                <Icon name="flag" size={12} />
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Why ────────────────────────────────────────────────────────── */}
      {assessment && assessment.reasons.length > 0 && (
        <section className="sm-side__block">
          <h3>Why</h3>
          {assessment.reasons.map((reason) => (
            <p key={reason} className="sm-reason">
              {reason}
            </p>
          ))}
        </section>
      )}

      {/* ── Keystroke dynamics (visual) ─────────────────────────────────── */}
      <section className="sm-side__block">
        <div className="sm-side__block-header">
          <h3>Keystroke dynamics</h3>
          <span className="sm-side__block-badge">{keystrokeSamples} keys</span>
        </div>
        {keystrokeEvents.length === 0 ? (
          <p className="sm-side__note" style={{ margin: 0 }}>
            Start typing to capture keystrokes…
          </p>
        ) : (
          <div className="sm-keystrokes">
            {[...keystrokeEvents].reverse().map((evt) => (
              <div key={evt.index} className="sm-keystroke">
                <span className="sm-keystroke__label">#{evt.index + 1}</span>
                <span className="sm-keystroke__bar-track">
                  <span
                    className="sm-keystroke__bar-fill"
                    style={{ width: `${Math.min(100, ((evt.dwellMs ?? 0) / maxDwell) * 100)}%` }}
                  />
                </span>
                <span className="sm-keystroke__val">
                  {evt.dwellMs ?? '—'}
                </span>
                <span className="sm-keystroke__unit">ms dwell</span>
                <span className="sm-keystroke__val sm-keystroke__flight">
                  {evt.flightMs ?? '—'}
                </span>
                <span className="sm-keystroke__unit">flight</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Typing rhythm (stats) ────────────────────────────────────── */}
      <section className="sm-side__block">
        <h3>Typing rhythm</h3>
        <dl className="sm-stats">
          <div>
            <dt>Keys captured</dt>
            <dd>{assessment?.features.keystrokeSamples ?? keystrokeSamples}</dd>
          </div>
          <div>
            <dt>Interval spread</dt>
            <dd>
              {assessment?.features.keystrokeStdDevMs != null
                ? `${assessment.features.keystrokeStdDevMs}ms`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Average gap</dt>
            <dd>
              {assessment?.features.keystrokeMeanMs != null
                ? `${assessment.features.keystrokeMeanMs}ms`
                : '—'}
            </dd>
          </div>
        </dl>
        <p className="sm-side__note">
          Human typing varies by 40ms or more. Under 15ms is machine-like.
        </p>
      </section>

      {/* ── Touch & pressure sensitivity ─────────────────────────────── */}
      <section className="sm-side__block">
        <div className="sm-side__block-header">
          <h3>Touch & pressure sensitivity</h3>
          <span className="sm-side__block-live">live</span>
        </div>
        <div className="sm-touch-pressure">
          <div className="sm-touch-pressure__row">
            <span>Pressure <span className="sm-touch-pressure__dot" /></span>
            <span className="sm-touch-pressure__val">{touch.pressure}</span>
          </div>
          <div className="sm-touch-pressure__bar-track">
            <span
              className="sm-touch-pressure__bar-fill"
              style={{ width: `${Math.min(100, touch.pressure * 100)}%` }}
            />
          </div>
        </div>
        <dl className="sm-stats sm-stats--grid">
          <div><dt>Tap area</dt><dd>{touch.tapArea}</dd></div>
          <div><dt>Tap duration</dt><dd>{touch.tapDuration}</dd></div>
          <div><dt>Center offset</dt><dd>{touch.centerOffset}</dd></div>
          <div><dt>Swipe velocity</dt><dd>{touch.swipeVelocity}</dd></div>
          <div><dt>Pressure σ</dt><dd>{touch.pressureSigma}</dd></div>
          <div><dt>Pointer</dt><dd>{touch.pointer}</dd></div>
        </dl>
        <p className="sm-side__note">
          taps: {touch.tapCount} · max concurrent: {touch.maxConcurrent}
        </p>
      </section>

      {/* ── Location & network intelligence ──────────────────────────── */}
      <section className="sm-side__block">
        <h3>Location & network intelligence</h3>
        {network.tabSwitches > 0 && (
          <span className="sm-net-badge">
            Frequent tab switching
          </span>
        )}
        <dl className="sm-stats">
          <div><dt>GPS</dt><dd>{network.gps}</dd></div>
          <div><dt>Connection</dt><dd>{network.connection}</dd></div>
          <div><dt>Downlink</dt><dd>{network.downlink}</dd></div>
          <div><dt>GPU</dt><dd className="sm-stats__truncate">{network.gpu}</dd></div>
          <div><dt>Online</dt><dd>{network.online ? 'yes' : 'no'}</dd></div>
          <div><dt>Tab switches</dt><dd>{network.tabSwitches}</dd></div>
        </dl>
        <div className="sm-native-only">
          <p className="sm-native-only__label">native-sdk only · not web-capturable</p>
          <div className="sm-native-only__tags">
            <span>IP / ISP / ASN</span>
            <span>Cell tower ID</span>
            <span>IMEI</span>
            <span>SIM serial</span>
            <span>Wi-Fi BSSID</span>
          </div>
        </div>
      </section>

      {/* ── What this device exposes ──────────────────────────────────── */}
      <section className="sm-side__block">
        <div className="sm-side__block-header">
          <h3>What this device exposes</h3>
          <span className="sm-side__block-badge">{device.fingerprint}</span>
        </div>
        <dl className="sm-stats">
          <div><dt>Platform</dt><dd>{device.platform}</dd></div>
          <div><dt>Secure context</dt><dd>{device.secureContext ? 'yes (HTTPS)' : 'no'}</dd></div>
          <div><dt>Pointer events</dt><dd>{device.pointerEvents ? 'yes' : 'no'}</dd></div>
          <div><dt>Touch input</dt><dd>{device.touchInput ? 'yes' : 'no'}</dd></div>
          <div><dt>CPU cores</dt><dd>{device.cpuCores}</dd></div>
          <div><dt>Device memory</dt><dd>{device.deviceMemory}</dd></div>
          <div><dt>Screen</dt><dd>{device.screen}</dd></div>
        </dl>
      </section>

      {/* ── Spending baseline ────────────────────────────────────────── */}
      <section className="sm-side__block">
        <h3>Spending baseline</h3>
        {baseline ? (
          <>
            <dl className="sm-stats">
              <div>
                <dt>30-day average</dt>
                <dd>₹{baseline.baselineAverage?.toLocaleString('en-IN') ?? '—'}</dd>
              </div>
              <div>
                <dt>Largest recent</dt>
                <dd>₹{baseline.largest?.toLocaleString('en-IN') ?? '—'}</dd>
              </div>
              <div>
                <dt>Alerts above</dt>
                <dd className={overThreshold ? 'is-breached' : undefined}>
                  ₹{baseline.highValueThreshold?.toLocaleString('en-IN') ?? '—'}
                </dd>
              </div>
            </dl>
            {overThreshold && (
              <p className="sm-side__breach">
                <Icon name="trending-up" size={13} />
                Current amount is over the line
              </p>
            )}
            <p className="sm-side__note">
              Based on {baseline.transactionCount} transactions in the last 30 days.
            </p>
          </>
        ) : (
          <p className="sm-side__note">Loading history…</p>
        )}
      </section>

      <footer className="sm-side__foot">
        Scored server-side. Every assessment is recorded for the bank console.
      </footer>
    </div>
  );
}
