/**
 * Shared contract with the Aegis backend (`psb-back`, deployed on Render).
 * Kept byte-for-byte compatible with the Expo app's `types/telemetry.ts` so
 * the same `/api/assess` endpoint serves both clients.
 */

export interface TelemetryPayload {
  userId: string;
  sessionId: string;
  timestamp: number;

  network: {
    lat: number;
    lon: number;
    rtt: number;
    isVpn?: boolean;
  };

  device: {
    fingerprintHash: string;
    /** The backend only branches on `isFirstDevice` / `isDeviceChanged`, so
     *  widening this to 'web' is safe and more honest than claiming android. */
    platform: 'android' | 'web';
    isFirstDevice?: boolean;
    isDeviceChanged?: boolean;
  };

  behavior: {
    meanHoldTime: number;
    meanFlightTime: number;
    typingStdDev: number;
    wpmEstimate: number;
    keypressCount: number;
    pasteDetected: boolean;
    gyroVariance: number;
  };

  journey: {
    currentScreen: string;
    previousScreen: string;
    dwellTime: number;
    sessionPath: string[];
  };
}

export interface RiskAssessment {
  riskScore: number;
  action: 'ALLOW' | 'STEP_UP' | 'BLOCK';
  engines: {
    network: number;
    device: number;
    behavior: number;
    journey: number;
  };
  flags: string[];
  explanation?: string;
}
