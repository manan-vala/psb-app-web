import type { TelemetryPayload, RiskAssessment } from '@/types/telemetry';

/**
 * Port of the Expo app's `services/api.ts`, using `fetch` instead of axios.
 * Points at the same Express + Socket.io backend deployed on Render.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://psb-back.onrender.com';

const TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Round-trip time to the backend, in ms. Mirrors the app's `measureRTT`. */
export async function measureRTT(): Promise<number> {
  const t0 = Date.now();
  try {
    await request<{ status: string; timestamp: number }>('/api/ping');
    return Date.now() - t0;
  } catch {
    return 999;
  }
}

/** POSTs telemetry to the risk orchestrator and returns its assessment. */
export async function submitTelemetry(
  payload: TelemetryPayload
): Promise<RiskAssessment> {
  return request<RiskAssessment>('/api/assess', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Notifies the backend of a completed payment (drives dashboard events). */
export async function reportPayment(
  amount: string,
  payeeName: string,
  txId?: string,
  riskScore?: number,
  action?: string,
  timestamp?: number
): Promise<void> {
  try {
    await request('/api/payment', {
      method: 'POST',
      body: JSON.stringify({ amount, payeeName, txId, riskScore, action, timestamp }),
    });
  } catch (error) {
    console.error('Failed to report payment:', error);
  }
}
