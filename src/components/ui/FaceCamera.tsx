'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
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
export function FaceCamera({ mode, onCapture, onError, disabled }: FaceCameraProps) {
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

  // Once the face has been stable for STABLE_FRAME_COUNT frames, kick off
  // the liveness challenge exactly once per attempt.
  useEffect(() => {
    if (mediapipe.guideState === 'stable' && !challengeStartedRef.current && !captured) {
      challengeStartedRef.current = true;
      liveness.begin();
    }
    if (mediapipe.guideState !== 'stable' && liveness.status === 'idle') {
      challengeStartedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediapipe.guideState, captured]);

  // Feed every reading to the liveness sampler while a challenge is running.
  useEffect(() => {
    if (liveness.status === 'in-progress' && mediapipe.lastReading) {
      liveness.sample(mediapipe.lastReading);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediapipe.lastReading, liveness.status]);

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

  const instruction = instructionFor(visualState, mediapipe.error, liveness.instructionText, captured);

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
    </div>
  );
}

function instructionFor(
  state: VisualState,
  error: string | null,
  challengeText: string,
  captured: boolean
): string {
  if (error) return error;
  if (captured) return 'Analyzing…';
  switch (state) {
    case 'loading-mediapipe':
      return 'Initializing camera…';
    case 'searching':
      return 'Position your face in the oval';
    case 'found':
      return 'Hold still…';
    case 'challenge':
      return challengeText;
    default:
      return '';
  }
}
