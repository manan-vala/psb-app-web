'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceCamera, type FaceCapturePayload } from './FaceCamera';
import { Icon } from './Icon';
import type { Challenge } from '@/hooks/useLivenessChallenge';

/**
 * Three-pose enrollment: the user captures the same face at three head
 * angles, one at a time, each behind an explicit Capture press.
 *
 * Why three: the server averages the resulting embeddings into a single
 * centroid template (see ml/face_api/face_service.py:get_template_embedding).
 * One embedding taken at an unlucky angle or under bad lighting otherwise
 * *defines* the stored identity; averaging across poses pulls the template
 * toward the middle of that person's embedding cluster, so later verification
 * from any of those angles lands closer to it.
 *
 * Note this is enrollment-only. Verification still takes a single capture
 * with a randomly-chosen challenge — an unpredictable challenge is what makes
 * a pre-recorded clip harder to stage, and that matters at verify time, not
 * here. A fixed, announced pose order at enrollment is a deliberate tradeoff
 * for capture quality; see the security note in the spec.
 */

export interface PoseStep {
  challenge: Challenge;
  title: string;
  hint: string;
}

export const POSE_STEPS: PoseStep[] = [
  { challenge: 'blink', title: 'Face forward', hint: 'Look straight at the camera, then blink when prompted.' },
  { challenge: 'turn_left', title: 'Turn left', hint: 'Turn your head slightly to your left when prompted.' },
  { challenge: 'turn_right', title: 'Turn right', hint: 'Turn your head slightly to your right when prompted.' },
];

interface MultiPoseEnrollProps {
  /** Called once all poses are captured, with one payload per pose in order. */
  onComplete: (captures: FaceCapturePayload[]) => void;
  onError: (msg: string) => void;
  /** Freezes the camera while the parent submits. */
  disabled?: boolean;
}

export function MultiPoseEnroll({ onComplete, onError, disabled }: MultiPoseEnrollProps) {
  const [captures, setCaptures] = useState<FaceCapturePayload[]>([]);
  const [resetToken, setResetToken] = useState(0);

  const stepIndex = captures.length;
  const step = POSE_STEPS[stepIndex];
  const done = stepIndex >= POSE_STEPS.length;

  // The updater passed to setState must be pure — React may call it during
  // render. Calling `onComplete` (which sets state on the parent) from inside
  // one is what produced "Cannot update a component while rendering a
  // different component". So the updater now only appends, and the reaction to
  // that new length happens in an effect, after commit.
  const handleCapture = useCallback((payload: FaceCapturePayload) => {
    setCaptures((prev) =>
      prev.length >= POSE_STEPS.length ? prev : [...prev, payload]
    );
  }, []);

  // Fires once per completed set. React runs effects twice in StrictMode dev,
  // and `onComplete` submits to the server, so the ref guard is what stops a
  // double enroll rather than just tidying up a warning.
  const completedRef = useRef(false);

  useEffect(() => {
    if (captures.length === 0) return;

    if (captures.length >= POSE_STEPS.length) {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(captures);
      return;
    }

    // Re-arm the same camera instance for the next pose — no remount, so
    // MediaPipe and the video stream stay warm between poses.
    setResetToken((t) => t + 1);
  }, [captures, onComplete]);

  const retake = useCallback(() => {
    completedRef.current = false;
    setCaptures([]);
    setResetToken((t) => t + 1);
  }, []);

  return (
    <div className="w-full flex-col items-center">
      <ol className="pose-steps" aria-label="Enrollment progress">
        {POSE_STEPS.map((s, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo';
          return (
            <li key={s.challenge} className={`pose-steps__item pose-steps__item--${state}`}>
              <span className="pose-steps__dot" aria-hidden="true">
                {state === 'done' ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className="t-label-sm">{s.title}</span>
            </li>
          );
        })}
      </ol>

      {!done && step && (
        <>
          <p className="t-body-sm c-variant text-center mb-md">{step.hint}</p>
          <FaceCamera
            mode="enroll"
            captureMode="manual"
            forcedChallenge={step.challenge}
            captureLabel={`Capture ${stepIndex + 1} of ${POSE_STEPS.length}`}
            resetToken={resetToken}
            onCapture={handleCapture}
            onError={onError}
            disabled={disabled}
          />
        </>
      )}

      {done && (
        <p className="t-body-sm c-variant text-center mt-md">
          All {POSE_STEPS.length} poses captured — building your face template…
        </p>
      )}

      {stepIndex > 0 && !disabled && (
        <button onClick={retake} className="t-label-sm c-primary mt-md" style={{ textDecoration: 'underline' }}>
          Start over
        </button>
      )}
    </div>
  );
}
