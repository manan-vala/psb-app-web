'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useKeystrokeDynamics } from '@/hooks/useKeystrokeDynamics';
import { usePasteDetection } from '@/hooks/usePasteDetection';
import { useGyroscope } from '@/hooks/useGyroscope';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { useJourneyTracker } from '@/hooks/useJourneyTracker';
import { useNetworkSignals } from '@/hooks/useNetworkSignals';
import { measureRTT, submitTelemetry as submitTelemetryApi } from '@/services/api';
import type { RiskAssessment, TelemetryPayload } from '@/types/telemetry';

const DEMO_USER_ID = 'demo-user';

/**
 * Fallback used whenever the backend is unreachable. Fail *open*, matching the
 * TRD's rule that a service outage must never lock a legitimate customer out.
 */
const OFFLINE_ASSESSMENT: RiskAssessment = {
  riskScore: 10,
  action: 'ALLOW',
  engines: { network: 100, device: 100, behavior: 100, journey: 100 },
  flags: ['ASSESSMENT_UNAVAILABLE'],
  explanation: 'Risk service unreachable — proceeding without assessment.',
};

interface TelemetryContextValue {
  /** Spread onto an <input> to record keystroke dynamics. */
  keystrokeInputProps: () => {
    onKeyDown: (e: { key: string }) => void;
    onKeyUp: (e: { key: string }) => void;
  };
  /** Records a tap on the on-screen PIN keypad as a keypress. */
  registerVirtualKeypress: () => void;
  pasteHandlers: {
    onPaste: () => void;
    onFocusCapture: () => void;
    onChangeTextCapture: (value: string) => void;
  };
  startGyroSampling: () => void;
  stopGyroSampling: () => void;
  /** Builds the payload, POSTs /api/assess, stores and returns the verdict. */
  submitTelemetry: (eventLabel?: string) => Promise<RiskAssessment>;
  /** Clears per-attempt behavioural buffers (call after a submit). */
  resetBehavior: () => void;
  fingerprintHash: string;
  isVpnActive: boolean;
  isOnline: boolean;
  lastAssessment: RiskAssessment | null;
  /** 0-100, higher is safer. Drives the header trust dot. */
  trustScore: number;
  sessionId: string;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const keystroke = useKeystrokeDynamics();
  const paste = usePasteDetection();
  const gyro = useGyroscope();
  const { fingerprintHash, isFirstDevice, isDeviceChanged } = useDeviceFingerprint();
  const journey = useJourneyTracker();
  const network = useNetworkSignals();

  const [lastAssessment, setLastAssessment] = useState<RiskAssessment | null>(null);
  const sessionId = useRef(
    `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  ).current;

  const submitTelemetry = useCallback(
    async (eventLabel?: string): Promise<RiskAssessment> => {
      const rtt = await measureRTT();
      const behaviorMetrics = keystroke.getMetrics();
      const journeyData = journey.getCurrentJourney();

      const payload: TelemetryPayload = {
        userId: DEMO_USER_ID,
        sessionId,
        timestamp: Date.now(),
        network: {
          lat: network.lat,
          lon: network.lon,
          rtt,
          isVpn: network.isVpnLikely,
        },
        device: {
          fingerprintHash,
          platform: 'web',
          isFirstDevice,
          isDeviceChanged,
        },
        behavior: {
          ...behaviorMetrics,
          pasteDetected: paste.isPasteDetected(),
          gyroVariance: gyro.getVariance(),
        },
        journey: {
          currentScreen: eventLabel ?? journeyData.currentScreen,
          previousScreen: journeyData.previousScreen,
          dwellTime: journeyData.dwellTime,
          sessionPath: journeyData.sessionPath,
        },
      };

      try {
        const assessment = await submitTelemetryApi(payload);
        setLastAssessment(assessment);
        return assessment;
      } catch (error) {
        console.warn('Risk assessment unavailable:', error);
        setLastAssessment(OFFLINE_ASSESSMENT);
        return OFFLINE_ASSESSMENT;
      }
    },
    [
      fingerprintHash,
      isFirstDevice,
      isDeviceChanged,
      network.lat,
      network.lon,
      network.isVpnLikely,
      sessionId,
      // hook objects are stable refs by construction
      keystroke,
      journey,
      paste,
      gyro,
    ]
  );

  const resetBehavior = useCallback(() => {
    keystroke.reset();
    paste.reset();
  }, [keystroke, paste]);

  const trustScore = lastAssessment ? 100 - lastAssessment.riskScore : 95;

  const value = useMemo<TelemetryContextValue>(
    () => ({
      keystrokeInputProps: keystroke.getInputProps,
      registerVirtualKeypress: keystroke.registerVirtualKeypress,
      pasteHandlers: {
        onPaste: paste.onPaste,
        onFocusCapture: paste.onFocusCapture,
        onChangeTextCapture: paste.onChangeTextCapture,
      },
      startGyroSampling: gyro.startSampling,
      stopGyroSampling: gyro.stopSampling,
      submitTelemetry,
      resetBehavior,
      fingerprintHash,
      isVpnActive: network.isVpnLikely,
      isOnline: network.isOnline,
      lastAssessment,
      trustScore,
      sessionId,
    }),
    [
      keystroke,
      paste,
      gyro,
      submitTelemetry,
      resetBehavior,
      fingerprintHash,
      network.isVpnLikely,
      network.isOnline,
      lastAssessment,
      trustScore,
      sessionId,
    ]
  );

  return (
    <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
