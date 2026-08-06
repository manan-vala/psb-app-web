'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTouchDynamics, type TouchMetrics } from '@/hooks/useTouchDynamics';
import { useMotionDynamics } from '@/hooks/useMotionDynamics';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { useNetworkSignals } from '@/hooks/useNetworkSignals';

/**
 * Capture engine for the `/analyze` demo page ONLY.
 *
 * This is deliberately isolated from `TelemetryContext` — it never calls
 * `services/api.ts` or touches the real Aegis backend. Its only job is to
 * prove, live and on-screen, that a browser can observe the same signal
 * families the Sentinel capture layer advertises (keystroke, touch, motion,
 * navigation, transaction, session, location, network, device, security).
 *
 * Device fingerprint and network/geo signals are read from the existing
 * production hooks (they are local reads with no network side effects of
 * their own). Keystroke, touch, motion, journey, and security signals are
 * captured fresh here so this page can never influence the real telemetry
 * buffers other screens rely on.
 */

interface KeyEntry {
  key: string;
  dwell: number;
  flight: number | null;
}

interface CategoryProgress {
  key: string;
  label: string;
  color: string;
  captured: number;
  total: number;
}

interface LiveSignal {
  label: string;
  value: string | number;
  tone: 'default' | 'warn';
}

interface AnalyzeCaptureContextValue {
  // --- bindings for the demo screens to attach ---
  touchBind: ReturnType<typeof useTouchDynamics>['bind'];
  keystrokeInputProps: () => {
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
  };
  registerVirtualKeypress: () => void;
  startSensors: () => void;
  visitScreen: (name: string) => void;
  recordFailedPin: () => void;
  recordTransaction: (tx: {
    amount: number;
    payee: string;
    isNewPayee: boolean;
    payeeTxnCount: number;
  }) => void;
  resetAll: () => void;

  // --- live state for the sidebar ---
  categories: CategoryProgress[];
  totalCaptured: number;
  totalFeatures: number;
  liveSignals: LiveSignal[];
  keystrokeCount: number;
  keystrokeEntries: KeyEntry[];
  motion: ReturnType<typeof useMotionDynamics>['live'];
  motionVariance: { x: number; y: number; z: number };
  touch: ReturnType<typeof useTouchDynamics>['live'];
  touchMetrics: TouchMetrics;
  deviceInfo: {
    platform: string;
    secureContext: boolean;
    pointerEvents: boolean;
    touchInput: boolean;
    cpuCores: number;
    deviceMemory: number;
    screenRes: string;
    fingerprintShort: string;
  };
  locationInfo: {
    lat: number;
    lon: number;
    hasFix: boolean;
    connectionType: string;
    downlinkMbps: number | null;
    rtt: number | null;
    gpuRenderer: string;
    online: boolean;
  };
  sessionInfo: { sessionId: string; timestamp: number; screen: string };
  navigationInfo: {
    sessionPath: string[];
    dwellTimes: number[];
    backUsed: boolean;
  };
  transaction: {
    amount: number;
    payee: string;
    isNewPayee: boolean;
    payeeTxnCount: number;
  } | null;
  tabSwitches: number;
  failedPinAttempts: number;
  payloadJson: Record<string, unknown>;
}

const AnalyzeCaptureContext = createContext<AnalyzeCaptureContextValue | null>(null);

const CATEGORY_META: { key: string; label: string; color: string; total: number }[] = [
  { key: 'keystroke', label: 'Keystroke', color: '#3b82f6', total: 9 },
  { key: 'touch', label: 'Touch', color: '#22c55e', total: 8 },
  { key: 'motion', label: 'Motion', color: '#f97316', total: 9 },
  { key: 'navigation', label: 'Navigation', color: '#8b5cf6', total: 7 },
  { key: 'transaction', label: 'Transaction', color: '#a855f7', total: 4 },
  { key: 'session', label: 'Session', color: '#64748b', total: 4 },
  { key: 'location', label: 'Location', color: '#ec4899', total: 5 },
  { key: 'network', label: 'Network / IP', color: '#14b8a6', total: 5 },
  { key: 'device', label: 'Device', color: '#6b7280', total: 8 },
  { key: 'security', label: 'Security', color: '#ef4444', total: 4 },
];

function gpuRendererInfo(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'unavailable';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'restricted';
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    return 'unavailable';
  }
}

export function AnalyzeCaptureProvider({ children }: { children: ReactNode }) {
  const touch = useTouchDynamics();
  const motion = useMotionDynamics();
  const { fingerprintHash } = useDeviceFingerprint();
  const network = useNetworkSignals();

  // --- local keystroke capture (isolated from the production hook) ---
  const [keystrokeEntries, setKeystrokeEntries] = useState<KeyEntry[]>([]);
  const downAt = useRef<Map<string, number>>(new Map());
  const lastUpAt = useRef<number | null>(null);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const now = performance.now();
    if (!downAt.current.has(e.key)) downAt.current.set(e.key, now);
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    const now = performance.now();
    const start = downAt.current.get(e.key);
    if (start === undefined) return;
    downAt.current.delete(e.key);
    const dwell = Math.round(now - start);
    const flight = lastUpAt.current !== null ? Math.round(now - lastUpAt.current) : null;
    lastUpAt.current = now;
    setKeystrokeEntries((prev) => [{ key: e.key, dwell, flight }, ...prev].slice(0, 4));
  }, []);

  const registerVirtualKeypress = useCallback(() => {
    const now = performance.now();
    const flight = lastUpAt.current !== null ? Math.round(now - lastUpAt.current) : null;
    lastUpAt.current = now;
    setKeystrokeEntries((prev) => [{ key: '•', dwell: 70, flight }, ...prev].slice(0, 4));
  }, []);

  const keystrokeInputProps = useCallback(() => ({ onKeyDown, onKeyUp }), [onKeyDown, onKeyUp]);

  // --- journey / navigation (manual — this route never changes URL) ---
  const [sessionPath, setSessionPath] = useState<string[]>([]);
  const [dwellTimes, setDwellTimes] = useState<number[]>([]);
  const screenEnteredAt = useRef<number>(Date.now());
  const [currentScreen, setCurrentScreen] = useState('splash');
  const backUsed = useRef(false);

  const visitScreen = useCallback((name: string) => {
    const now = Date.now();
    setDwellTimes((prev) => [...prev, now - screenEnteredAt.current]);
    screenEnteredAt.current = now;
    setSessionPath((prev) => [...prev, name]);
    setCurrentScreen(name);
  }, []);

  // --- security signals ---
  const [tabSwitches, setTabSwitches] = useState(0);
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setTabSwitches((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const recordFailedPin = useCallback(() => setFailedPinAttempts((n) => n + 1), []);

  // --- transaction context ---
  const [transaction, setTransaction] = useState<AnalyzeCaptureContextValue['transaction']>(null);
  const recordTransaction = useCallback((tx: NonNullable<AnalyzeCaptureContextValue['transaction']>) => {
    setTransaction(tx);
  }, []);

  // --- device / network snapshot — read once on mount, client-only, never
  // during render (avoids touching window/document/navigator while React
  // may still be rendering the server or initial-hydration pass). ---
  const [gpuRendererValue, setGpuRendererValue] = useState<string | null>(null);
  const [connection, setConnection] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }>({});
  const [deviceSnapshot, setDeviceSnapshot] = useState({
    platform: 'unknown',
    secureContext: false,
    pointerEvents: false,
    touchInput: false,
    cpuCores: 0,
    deviceMemory: 0,
    screenRes: 'unknown',
  });
  // Gates every capture-flag that would otherwise read `navigator`/`window`
  // directly during render. Server and the client's pre-hydration render both
  // see `false` here; it only flips after mount, so the captured HTML always
  // matches what React hydrates against.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGpuRendererValue(gpuRendererInfo());

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    };
    setConnection(nav.connection ?? {});
    setDeviceSnapshot({
      platform: nav.platform ?? 'unknown',
      secureContext: window.isSecureContext,
      pointerEvents: 'PointerEvent' in window,
      touchInput: nav.maxTouchPoints > 0,
      cpuCores: nav.hardwareConcurrency ?? 0,
      deviceMemory: nav.deviceMemory ?? 0,
      screenRes: `${screen.width}x${screen.height} @${window.devicePixelRatio}x`,
    });
  }, []);

  const deviceInfo = useMemo(
    () => ({
      ...deviceSnapshot,
      fingerprintShort: fingerprintHash ? `#${fingerprintHash.slice(0, 8)}` : '—',
    }),
    [deviceSnapshot, fingerprintHash]
  );

  // --- session identity ---
  const sessionId = useRef(
    `web-analyze-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  ).current;
  const startedAt = useRef(Date.now()).current;

  const startSensors = useCallback(() => {
    motion.startSampling();
  }, [motion]);

  const resetAll = useCallback(() => {
    touch.reset();
    motion.reset();
    setKeystrokeEntries([]);
    downAt.current.clear();
    lastUpAt.current = null;
    setSessionPath([]);
    setDwellTimes([]);
    screenEnteredAt.current = Date.now();
    setCurrentScreen('splash');
    backUsed.current = false;
    setTabSwitches(0);
    setFailedPinAttempts(0);
    setTransaction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touch, motion]);

  // --- category capture-count computation ---
  const variance = motion.getVariance();
  const touchMetrics = touch.getMetrics();

  const capturedFlags = useMemo<Record<string, boolean[]>>(
    () => ({
      keystroke: [
        keystrokeEntries.length > 0,
        keystrokeEntries.length > 0,
        keystrokeEntries.some((e) => e.flight !== null),
        keystrokeEntries.length > 2,
        keystrokeEntries.length > 0,
        keystrokeEntries.length > 0,
        keystrokeEntries.some((e) => e.flight !== null),
        keystrokeEntries.some((e) => e.key === 'Backspace'),
        keystrokeEntries.length > 0,
      ],
      touch: [
        touchMetrics.pressure !== null,
        touchMetrics.tapArea !== null,
        touchMetrics.tapDuration !== null,
        touchMetrics.centerOffset !== null,
        touchMetrics.swipeVelocity !== null,
        touchMetrics.pressureStdDev !== null,
        touchMetrics.pointerType !== null,
        touchMetrics.multitouchMax > 1,
      ],
      motion: [
        motion.live.pitch !== null,
        motion.live.roll !== null,
        motion.live.yaw !== null,
        motion.live.accelX !== null,
        motion.live.accelY !== null,
        motion.live.accelZ !== null,
        variance.x > 0,
        variance.y > 0,
        variance.z > 0,
      ],
      navigation: [
        sessionPath.length > 0,
        sessionPath.length > 1,
        dwellTimes.length > 0,
        sessionPath.length > 0,
        sessionPath.length > 0,
        backUsed.current,
        dwellTimes.length > 1,
      ],
      transaction: [
        transaction !== null,
        transaction !== null,
        transaction !== null,
        transaction !== null && transaction.payeeTxnCount >= 0,
      ],
      session: [true, true, true, true],
      location: [
        network.lat !== 0 || network.lon !== 0,
        false, // reverse-geocoded city — not resolvable client-side without a network call
        false, // distance from last login — needs persisted history
        false, // GPS<->IP gap — needs a server-side IP lookup
        mounted && 'geolocation' in navigator,
      ],
      network: [
        !!connection.effectiveType,
        typeof connection.downlink === 'number',
        typeof connection.rtt === 'number',
        mounted,
        gpuRendererValue !== null && gpuRendererValue !== 'unavailable',
      ],
      device: [
        deviceInfo.platform !== 'unknown',
        true,
        deviceInfo.pointerEvents,
        true,
        deviceInfo.cpuCores > 0,
        deviceInfo.deviceMemory > 0,
        deviceInfo.screenRes !== 'unknown',
        deviceInfo.fingerprintShort !== '—',
      ],
      security: [tabSwitches >= 0, false, failedPinAttempts >= 0, true],
    }),
    [
      keystrokeEntries,
      touchMetrics,
      motion.live,
      variance,
      sessionPath,
      dwellTimes,
      transaction,
      network.lat,
      network.lon,
      connection.effectiveType,
      connection.downlink,
      connection.rtt,
      gpuRendererValue,
      deviceInfo,
      tabSwitches,
      failedPinAttempts,
      mounted,
    ]
  );

  const categories: CategoryProgress[] = CATEGORY_META.map((meta) => ({
    ...meta,
    captured: (capturedFlags[meta.key] ?? []).filter(Boolean).length,
  }));
  const totalCaptured = categories.reduce((sum, c) => sum + c.captured, 0);
  const totalFeatures = categories.reduce((sum, c) => sum + c.total, 0);

  const liveSignals: LiveSignal[] = [
    ...(tabSwitches > 0
      ? [{ label: 'Tab switches', value: tabSwitches, tone: 'warn' as const }]
      : []),
    ...(failedPinAttempts > 0
      ? [{ label: 'Failed PIN attempts', value: failedPinAttempts, tone: 'warn' as const }]
      : []),
    ...(touchMetrics.pointerType === 'mouse'
      ? [{ label: 'Non-touch pointer on mobile flow', value: 'mouse', tone: 'warn' as const }]
      : []),
    ...(network.isVpnLikely ? [{ label: 'VPN / proxy suspected', value: 'yes', tone: 'warn' as const }] : []),
  ];

  const payloadJson = useMemo(
    () => ({
      session_id: sessionId,
      started_at: new Date(startedAt).toISOString(),
      screen: currentScreen,
      keystroke: {
        count: keystrokeEntries.length,
        entries: keystrokeEntries,
      },
      touch: touchMetrics,
      motion: { ...motion.live, variance },
      navigation: { sessionPath, dwellTimes, backUsed: backUsed.current },
      transaction,
      location: { lat: network.lat, lon: network.lon, isVpnLikely: network.isVpnLikely },
      network: {
        effectiveType: connection.effectiveType ?? null,
        downlinkMbps: connection.downlink ?? null,
        rttMs: connection.rtt ?? null,
        online: network.isOnline,
        gpuRenderer: gpuRendererValue,
      },
      device: deviceInfo,
      security: { tabSwitches, failedPinAttempts },
    }),
    [
      sessionId,
      startedAt,
      currentScreen,
      keystrokeEntries,
      touchMetrics,
      motion.live,
      variance,
      sessionPath,
      dwellTimes,
      transaction,
      network.lat,
      network.lon,
      network.isVpnLikely,
      network.isOnline,
      connection.effectiveType,
      connection.downlink,
      connection.rtt,
      gpuRendererValue,
      deviceInfo,
      tabSwitches,
      failedPinAttempts,
    ]
  );

  const value: AnalyzeCaptureContextValue = {
    touchBind: touch.bind,
    keystrokeInputProps,
    registerVirtualKeypress,
    startSensors,
    visitScreen,
    recordFailedPin,
    recordTransaction,
    resetAll,
    categories,
    totalCaptured,
    totalFeatures,
    liveSignals,
    keystrokeCount: keystrokeEntries.length,
    keystrokeEntries,
    motion: motion.live,
    motionVariance: variance,
    touch: touch.live,
    touchMetrics,
    deviceInfo,
    locationInfo: {
      lat: network.lat,
      lon: network.lon,
      hasFix: network.lat !== 0 || network.lon !== 0,
      connectionType: connection.effectiveType ?? 'unknown',
      downlinkMbps: connection.downlink ?? null,
      rtt: connection.rtt ?? null,
      gpuRenderer: gpuRendererValue ?? 'unavailable',
      online: network.isOnline,
    },
    sessionInfo: { sessionId, timestamp: startedAt, screen: currentScreen },
    navigationInfo: { sessionPath, dwellTimes, backUsed: backUsed.current },
    transaction,
    tabSwitches,
    failedPinAttempts,
    payloadJson,
  };

  return (
    <AnalyzeCaptureContext.Provider value={value}>{children}</AnalyzeCaptureContext.Provider>
  );
}

export function useAnalyzeCapture() {
  const ctx = useContext(AnalyzeCaptureContext);
  if (!ctx) throw new Error('useAnalyzeCapture must be used within AnalyzeCaptureProvider');
  return ctx;
}
