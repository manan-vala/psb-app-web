'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { FaceReading } from './useMediaPipe';

/**
 * Issues one randomly-chosen liveness challenge per attempt and samples
 * landmark-derived signals (eye openness, head yaw) throughout a short
 * window, per spec v2 §8b.
 *
 * This is a coarse, motion-based liveness check — sufficient to defeat a
 * static printed photo or a paused video frame (the two cheapest and most
 * likely attacks against a step-up face check), but it does not claim to
 * defeat a live deepfake stream or a pre-recorded video primed with the
 * correct action. See spec v2 §9 for the full threat table.
 *
 * The client-side pass/fail here is only used for immediate visual feedback
 * and to avoid an obviously-doomed submission — the *server* re-validates
 * the same landmark sequence and is the actual source of truth (see
 * ml/face_api/liveness.py).
 */

export type Challenge = 'blink' | 'turn_left' | 'turn_right';

export interface LivenessFrame {
  tMs: number;
  eyeAspectRatio: number;
  headYawDeg: number;
}

const CHALLENGE_WINDOW_MS = 2500;
const BLINK_EAR_THRESHOLD = 0.4; // below this, eyes are considered closed
const TURN_YAW_THRESHOLD_DEG = 15;

/**
 * Pool used when a challenge is chosen at random — i.e. at VERIFICATION time.
 *
 * `blink` is deliberately excluded. It is not weaker security: per the spec's
 * threat table (§9) blink and head-turn cover exactly the same attacks —
 * both defeat a printed photo or a paused frame, neither defeats a video
 * replay that performs the requested action. But a blink is a ~100-150ms
 * transient, where a held turn spans dozens of frames, so blink produced
 * almost all of the false rejections while adding no coverage.
 *
 * Verification is the moment that must not fail spuriously: it gates a
 * transaction and the user gets one shot before falling back to a password.
 * Enrollment is guided and retryable, so it still uses blink for its frontal
 * pose (see MultiPoseEnroll) — that's the one place a challenge has to leave
 * the head facing the camera.
 *
 * `blink` remains in the `Challenge` type and is still accepted and validated
 * server-side, so enrollment keeps working and no API contract changes.
 */
const RANDOM_CHALLENGES: Challenge[] = ['turn_left', 'turn_right'];

const INSTRUCTIONS: Record<Challenge, string> = {
  blink: 'Blink now',
  turn_left: 'Turn your head left',
  turn_right: 'Turn your head right',
};

export type LivenessStatus = 'idle' | 'in-progress' | 'passed' | 'failed';

interface UseLivenessChallengeReturn {
  challenge: Challenge;
  status: LivenessStatus;
  instructionText: string;
  /**
   * Starts a fresh challenge window (call once a stable face is detected).
   *
   * Pass `forced` to pin the challenge instead of picking randomly — used by
   * multi-pose enrollment, which needs a *known* sequence (blink, then left,
   * then right) so each capture contributes a different head angle to the
   * averaged template. Verification deliberately keeps the random default:
   * an unpredictable challenge is what makes a pre-recorded clip harder to
   * stage, and that property matters at verify time, not at enroll time.
   */
  begin: (forced?: Challenge) => void;
  /** Call every animation frame with the latest reading while a challenge is in progress. */
  sample: (reading: FaceReading) => void;
  reset: () => void;
  getSequence: () => LivenessFrame[];
}

function pickChallenge(): Challenge {
  return RANDOM_CHALLENGES[Math.floor(Math.random() * RANDOM_CHALLENGES.length)];
}

export function useLivenessChallenge(): UseLivenessChallengeReturn {
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge());
  const [status, setStatus] = useState<LivenessStatus>('idle');

  const sequenceRef = useRef<LivenessFrame[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const baselineYawRef = useRef<number | null>(null);

  const begin = useCallback((forced?: Challenge) => {
    setChallenge(forced ?? pickChallenge());
    setStatus('in-progress');
    sequenceRef.current = [];
    startedAtRef.current = performance.now();
    baselineYawRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    sequenceRef.current = [];
    startedAtRef.current = null;
    baselineYawRef.current = null;
  }, []);

  const sample = useCallback(
    (reading: FaceReading) => {
      if (status !== 'in-progress' || startedAtRef.current === null) return;

      const tMs = performance.now() - startedAtRef.current;
      sequenceRef.current.push({
        tMs,
        eyeAspectRatio: reading.eyeAspectRatio,
        headYawDeg: reading.headYawDeg,
      });
      if (baselineYawRef.current === null) baselineYawRef.current = reading.headYawDeg;

      if (tMs >= CHALLENGE_WINDOW_MS) {
        setStatus(evaluateLocally(challenge, sequenceRef.current, baselineYawRef.current) ? 'passed' : 'failed');
      }
    },
    [status, challenge]
  );

  const getSequence = useCallback(() => sequenceRef.current, []);

  return useMemo(
    () => ({
      challenge,
      status,
      instructionText: INSTRUCTIONS[challenge],
      begin,
      sample,
      reset,
      getSequence,
    }),
    [challenge, status, begin, sample, reset, getSequence]
  );
}

/**
 * Client-side pre-check only (see file header) — mirrors, but does not
 * replace, the server-side validation in ml/face_api/liveness.py.
 */
function evaluateLocally(challenge: Challenge, frames: LivenessFrame[], baselineYaw: number | null): boolean {
  if (frames.length < 3) return false;

  if (challenge === 'blink') {
    return frames.some((f) => f.eyeAspectRatio < BLINK_EAR_THRESHOLD);
  }

  if (baselineYaw === null) return false;
  // Positive yaw delta = turned left, negative = turned right, per
  // yawFromMatrix's convention in useMediaPipe.ts. This is a coarse client
  // pre-check only; the server independently validates the same sequence.
  return frames.some((f) => {
    const delta = f.headYawDeg - baselineYaw;
    return challenge === 'turn_left' ? delta >= TURN_YAW_THRESHOLD_DEG : delta <= -TURN_YAW_THRESHOLD_DEG;
  });
}
