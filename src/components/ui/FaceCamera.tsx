'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { useMediaPipe, STABLE_FRAME_COUNT } from '@/hooks/useMediaPipe';
import { useLivenessChallenge, type Challenge, type LivenessFrame } from '@/hooks/useLivenessChallenge';

export interface FaceCapturePayload {
  imageBase64: string;
  challenge: Challenge;
  landmarkSequence: LivenessFrame[];
}

interface FaceCameraProps {
  mode: 'enroll' | 'verify';
  onCapture: (payload: FaceCapturePayload) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  /**
   * 'auto' (default) fires the challenge the instant the face goes stable —
   * the original behaviour, kept for verification and the single-shot enroll
   * path so nothing existing changes.
   *
   * 'manual' waits for the user to press Capture. The button only enables
   * once the face is already stable, so the frame that gets cropped and sent
   * is one the detector has already vouched for — this is what removes the
   * half-turned / motion-blurred captures that auto mode can occasionally
   * grab on the very first stable frame.
   */
  captureMode?: 'auto' | 'manual';
  /** Pins the liveness challenge instead of choosing randomly. See useLivenessChallenge.begin. */
  forcedChallenge?: Challenge;
  /** Label for the manual capture button. Ignored in auto mode. */
  captureLabel?: string;
  /**
   * Change this value to clear a completed capture and arm the camera for
   * another one, *without* remounting — a remount would tear down the
   * MediaPipe landmarker and the getUserMedia stream and pay the multi-second
   * init cost again, which is exactly what multi-pose enrollment must avoid
   * between poses.
   */
  resetToken?: number;
}

type VisualState =
  | 'loading-mediapipe'
  | 'searching'
  | 'found'
  | 'challenge'
  | 'captured'
  | 'error';

const OVAL_COLOR: Record<VisualState, string> = {
  'loading-mediapipe': 'var(--outline)',
  searching: 'var(--outline)',
  found: 'var(--warning)',
  challenge: 'var(--warning)',
  captured: 'var(--success)',
  error: 'var(--error)',
};

/**
 * Reusable webcam + MediaPipe detection + liveness-challenge component, per
 * spec v2 §8. Used by both the /face-enroll page (mode="enroll") and
 * StepUpModal (mode="verify").
 *
 * Must only be rendered client-side — imported via `next/dynamic` with
 * `ssr: false` wherever it's used, since MediaPipe touches WebAssembly.
 */
export function FaceCamera({
  mode,
  onCapture,
  onError,
  disabled,
  captureMode = 'auto',
  forcedChallenge,
  captureLabel = 'Capture',
  resetToken = 0,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediapipe = useMediaPipe();
  const liveness = useLivenessChallenge();
  const [captured, setCaptured] = useState(false);
  const challengeStartedRef = useRef(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!mediapipe.ready || !videoRef.current || disabled) return;
    mediapipe.startCamera(videoRef.current);
    return () => mediapipe.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediapipe.ready, disabled]);

  useEffect(() => {
    if (mediapipe.error) onError(mediapipe.error);
  }, [mediapipe.error, onError]);

  // Re-arm for the next capture when the parent bumps resetToken. Skipped on
  // the initial render (resetToken starts at its initial value) so this
  // doesn't fight the mount-time state.
  const lastResetRef = useRef(resetToken);
  useEffect(() => {
    if (lastResetRef.current === resetToken) return;
    lastResetRef.current = resetToken;
    setCaptured(false);
    challengeStartedRef.current = false;
    submittedRef.current = false;
    liveness.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const beginChallenge = useCallback(() => {
    if (challengeStartedRef.current || captured) return;
    challengeStartedRef.current = true;
    liveness.begin(forcedChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captured, forcedChallenge, liveness.begin]);

  // Auto mode only: once the face has been stable for STABLE_FRAME_COUNT
  // frames, kick off the liveness challenge exactly once per attempt. In
  // manual mode this is driven by the Capture button instead.
  useEffect(() => {
    // `disabled` is honoured here as well as on the manual button. Without it,
    // auto mode would start a fresh challenge while the parent still had the
    // previous capture in flight — so a caller counting attempts could be
    // handed two before it had finished judging the first.
    if (
      captureMode === 'auto' &&
      !disabled &&
      mediapipe.guideState === 'stable' &&
      !challengeStartedRef.current &&
      !captured
    ) {
      beginChallenge();
    }
    if (mediapipe.guideState !== 'stable' && liveness.status === 'idle') {
      challengeStartedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediapipe.guideState, captured, captureMode, disabled]);

  // Feed every reading to the liveness sampler while a challenge is running.
  //
  // Subscribing to the rAF loop rather than watching a piece of state: state
  // only surfaces what React has committed, which silently dropped frames
  // whenever inference outpaced rendering. See subscribeToFrames in
  // useMediaPipe for why that broke blink detection specifically.
  useEffect(() => {
    if (liveness.status !== 'in-progress') return;
    mediapipe.subscribeToFrames(liveness.sample);
    return () => mediapipe.subscribeToFrames(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveness.status, liveness.sample]);

  // Challenge window closed (passed or failed, client-side pre-check) —
  // capture and submit regardless, since the server re-validates the same
  // landmark sequence and is the actual source of truth (spec v2 §8b).
  useEffect(() => {
    if ((liveness.status === 'passed' || liveness.status === 'failed') && !submittedRef.current && videoRef.current) {
      submittedRef.current = true;
      const imageBase64 = mediapipe.captureCropBase64(videoRef.current);
      if (!imageBase64) {
        onError('Could not capture a clear frame. Please try again.');
        liveness.reset();
        challengeStartedRef.current = false;
        submittedRef.current = false;
        return;
      }
      setCaptured(true);
      onCapture({
        imageBase64,
        challenge: liveness.challenge,
        landmarkSequence: liveness.getSequence(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveness.status]);

  const visualState: VisualState = mediapipe.error
    ? 'error'
    : captured
    ? 'captured'
    : liveness.status === 'in-progress'
    ? 'challenge'
    : mediapipe.guideState === 'found' || mediapipe.guideState === 'stable'
    ? 'found'
    : mediapipe.guideState === 'loading-mediapipe'
    ? 'loading-mediapipe'
    : 'searching';

  const isManual = captureMode === 'manual';
  const canCapture = isManual && !captured && !disabled && liveness.status !== 'in-progress' && mediapipe.guideState === 'stable';

  const instruction = instructionFor(
    visualState,
    mediapipe.error,
    liveness.instructionText,
    captured,
    isManual && canCapture,
    captureLabel
  );

  return (
    <div className="face-camera">
      <div className="face-camera__frame">
        <video
          ref={videoRef}
          className="face-camera__video"
          playsInline
          muted
          aria-label={mode === 'enroll' ? 'Face enrollment camera' : 'Face verification camera'}
        />
        <svg className="face-camera__oval" viewBox="0 0 300 300" aria-hidden="true">
          <ellipse
            cx="150"
            cy="150"
            rx="110"
            ry="140"
            fill="none"
            stroke={OVAL_COLOR[visualState]}
            strokeWidth={4}
            strokeDasharray={visualState === 'loading-mediapipe' || visualState === 'searching' ? '10 8' : undefined}
            className={visualState === 'challenge' || visualState === 'captured' ? 'face-camera__oval--pulse' : undefined}
          />
        </svg>
      </div>
      <p className="face-camera__instruction">{instruction}</p>

      {isManual && !captured && (
        <Button
          label={captureLabel}
          icon="photo-camera"
          onClick={beginChallenge}
          disabled={!canCapture}
          style={{ marginTop: 4 }}
        />
      )}
    </div>
  );
}

function instructionFor(
  state: VisualState,
  error: string | null,
  challengeText: string,
  captured: boolean,
  /** True only when manual mode is armed *and* the face is already stable. */
  awaitingCapturePress: boolean,
  captureLabel: string
): string {
  if (error) return error;
  if (captured) return 'Analyzing…';
  switch (state) {
    case 'loading-mediapipe':
      return 'Initializing camera…';
    case 'searching':
      return 'Position your face in the oval';
    case 'found':
      // In manual mode a stable face is the *precondition* for capturing, not
      // the trigger — so once stable, say what the user is now expected to do
      // instead of "hold still", which implies something happens on its own.
      return awaitingCapturePress ? `Looking good — press ${captureLabel}` : 'Hold still…';
    case 'challenge':
      return challengeText;
    default:
      return '';
  }
}
