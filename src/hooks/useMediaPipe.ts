'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Wraps `@mediapipe/tasks-vision`'s FaceLandmarker for real-time face
 * detection + landmarks from a `<video>` element, per spec v2 §8.
 *
 * MediaPipe uses WebAssembly, so this hook must only ever run client-side —
 * `FaceCamera.tsx` is loaded via `next/dynamic` with `ssr: false`, and the
 * MediaPipe package itself is dynamically imported here rather than at
 * module scope so nothing touches `WebAssembly`/`navigator` during SSR.
 *
 * FaceLandmarker (not the older BlazeFace-only detector) is used because it
 * also gives us the per-frame blendshapes/transform data the liveness
 * challenge in useLivenessChallenge.ts needs (eye-openness, head yaw) — one
 * model covers both detection and liveness signal, no separate BlazeFace
 * dependency required.
 */

export const DETECTION_CONFIDENCE = 0.85;
export const MIN_FACE_AREA_RATIO = 0.1;
export const MAX_FACE_AREA_RATIO = 0.65;
export const STABLE_FRAME_COUNT = 3;
// Margin added around the detected face box before cropping.
//
// Raised from 0.25: the server runs SCRFD on whatever we send, and a face that
// fills the frame edge-to-edge scores *lower* than one with surrounding
// context, because the detector was trained on faces occupying part of a
// scene. Padding the crop is the cheapest way to lift det_score, and it costs
// nothing downstream — ArcFace re-aligns from its own 5-point landmarks, so
// the embedding is normalized regardless of how much margin we include.
export const CROP_PADDING = 0.4;
export const CROP_OUTPUT_SIZE = 480;

export interface FaceBox {
  x: number; // 0-1, normalized to video width
  y: number;
  width: number;
  height: number;
}

export interface FaceReading {
  detected: boolean;
  confidence: number;
  box: FaceBox | null;
  /** Eye aspect ratio, averaged across both eyes — lower means more closed. */
  eyeAspectRatio: number;
  /** Estimated head yaw in degrees, 0 = facing camera, +/- = turned. */
  headYawDeg: number;
}

export type GuideState =
  | 'loading-mediapipe'
  | 'searching'
  | 'found'
  | 'stable'
  | 'error';

interface UseMediaPipeReturn {
  ready: boolean;
  error: string | null;
  guideState: GuideState;
  /**
   * Registers a callback invoked synchronously with EVERY detection, straight
   * from the rAF loop. Pass null to unsubscribe.
   *
   * This exists because the previous design published readings via React state
   * and let consumers observe them in an effect. Detections are produced once
   * per animation frame, but a state update only surfaces after React commits
   * — so whenever inference plus render exceeded one frame interval, readings
   * were overwritten before anyone saw them.
   *
   * That silently broke blink detection. A blink lasts ~100-150ms (3-5 frames
   * at 30fps), so dropping half the frames could mean zero eyes-closed samples
   * ever reached the liveness check. Head turns masked the bug because a
   * turned head is sustained across dozens of frames.
   */
  subscribeToFrames: (fn: ((reading: FaceReading) => void) | null) => void;
  startCamera: (video: HTMLVideoElement) => Promise<void>;
  stopCamera: () => void;
  /** Crops the current video frame to the last-known face box, padded, and returns a base64 JPEG (no data: prefix). */
  captureCropBase64: (video: HTMLVideoElement) => string | null;
}

// Blendshape categories used to estimate eye-openness without hand-rolling
// eye-landmark geometry ourselves — FaceLandmarker already computes these.
const LEFT_BLINK = 'eyeBlinkLeft';
const RIGHT_BLINK = 'eyeBlinkRight';

export function useMediaPipe(): UseMediaPipeReturn {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideState, setGuideState] = useState<GuideState>('loading-mediapipe');
  /**
   * Held in a ref, not state. Nothing renders the raw reading, so publishing
   * it through state cost a re-render every animation frame and — worse — made
   * consumers see a lossy, render-rate-limited sample of the detections rather
   * than all of them.
   */
  const lastReadingRef = useRef<FaceReading | null>(null);
  const frameSubscriberRef = useRef<((reading: FaceReading) => void) | null>(null);

  const landmarkerRef = useRef<import('@mediapipe/tasks-vision').FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
        setGuideState('searching');
      } catch (err) {
        if (cancelled) return;
        console.error('MediaPipe init failed:', err);
        setError('Could not initialize face detection. Please try again.');
        setGuideState('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stableCountRef.current = 0;
  }, []);

  const startCamera = useCallback(
    async (video: HTMLVideoElement) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        console.error('Camera access failed:', err);
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError') {
          setError(
            'Camera access is needed for face verification. Please allow camera access in your browser and try again.'
          );
        } else if (name === 'NotFoundError') {
          setError('No camera detected. Please use a device with a camera, or verify using your password.');
        } else if (name === 'NotReadableError') {
          setError('Your camera is being used by another app. Close it and try again.');
        } else if (!navigator.mediaDevices?.getUserMedia) {
          setError("Your browser doesn't support camera access. Please update your browser or use a different one.");
        } else {
          setError('Could not start the camera. Please try again.');
        }
        setGuideState('error');
        return;
      }

      const loop = () => {
        const landmarker = landmarkerRef.current;
        if (!landmarker || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const result = landmarker.detectForVideo(video, performance.now());
        const reading = readingFromResult(result, video.videoWidth, video.videoHeight);

        // Synchronous, in the loop — no React scheduling between producing a
        // detection and delivering it, so the liveness sampler sees every
        // frame including the handful where the eyes are actually shut.
        lastReadingRef.current = reading;
        frameSubscriberRef.current?.(reading);

        if (reading.detected) {
          const areaOk =
            reading.box &&
            reading.box.width * reading.box.height >= MIN_FACE_AREA_RATIO &&
            reading.box.width * reading.box.height <= MAX_FACE_AREA_RATIO;
          const good = reading.confidence >= DETECTION_CONFIDENCE && areaOk;

          if (good) {
            stableCountRef.current += 1;
            setGuideState(stableCountRef.current >= STABLE_FRAME_COUNT ? 'stable' : 'found');
          } else {
            stableCountRef.current = 0;
            setGuideState('found');
          }
        } else {
          stableCountRef.current = 0;
          setGuideState('searching');
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    []
  );

  const subscribeToFrames = useCallback(
    (fn: ((reading: FaceReading) => void) | null) => {
      frameSubscriberRef.current = fn;
    },
    []
  );

  const captureCropBase64 = useCallback((video: HTMLVideoElement): string | null => {
    // Reads the ref, so the crop uses the most recent detection rather than
    // whatever React last committed — the box could otherwise be a frame or
    // more stale, which matters when the head is mid-turn.
    const reading = lastReadingRef.current;
    if (!reading?.box) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const padX = reading.box.width * vw * CROP_PADDING;
    const padY = reading.box.height * vh * CROP_PADDING;

    const x = Math.max(0, reading.box.x * vw - padX);
    const y = Math.max(0, reading.box.y * vh - padY);
    const w = Math.min(vw - x, reading.box.width * vw + padX * 2);
    const h = Math.min(vh - y, reading.box.height * vh + padY * 2);

    const canvas = document.createElement('canvas');
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Video is displayed mirrored (CSS scaleX(-1)) for the selfie feel, but
    // the underlying frame data is not mirrored — draw it as-is so the crop
    // sent to the server matches what InsightFace expects, unflipped.
    ctx.drawImage(video, x, y, w, h, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1] ?? null;
  }, []);

  return useMemo(
    () => ({ ready, error, guideState, subscribeToFrames, startCamera, stopCamera, captureCropBase64 }),
    [ready, error, guideState, subscribeToFrames, startCamera, stopCamera, captureCropBase64]
  );
}

function readingFromResult(
  result: import('@mediapipe/tasks-vision').FaceLandmarkerResult,
  videoWidth: number,
  videoHeight: number
): FaceReading {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) {
    return { detected: false, confidence: 0, box: null, eyeAspectRatio: 1, headYawDeg: 0 };
  }

  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const box: FaceBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  // Blendshapes give a direct 0-1 "how closed is this eye" score, which is a
  // more reliable liveness signal across webcams than hand-computed EAR from
  // raw landmark distances would be at 480x480 crop resolution.
  const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
  const leftBlink = blendshapes.find((c: { categoryName: string; score: number }) => c.categoryName === LEFT_BLINK)?.score ?? 0;
  const rightBlink = blendshapes.find((c: { categoryName: string; score: number }) => c.categoryName === RIGHT_BLINK)?.score ?? 0;
  // Convert "blink score" (1 = fully closed) into an eye-aspect-ratio-shaped
  // signal (higher = more open) so the rest of the pipeline reads naturally.
  const eyeAspectRatio = 1 - (leftBlink + rightBlink) / 2;

  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const headYawDeg = matrix ? yawFromMatrix(matrix) : 0;

  // Detection confidence: FaceLandmarker doesn't expose a single scalar the
  // way a bare detector does, so approximate it from landmark presence + box
  // plausibility (a degenerate near-zero box means a spurious detection).
  const boxArea = box.width * box.height;
  const confidence = boxArea > 0.01 ? 0.95 : 0.4;

  return { detected: true, confidence, box, eyeAspectRatio, headYawDeg };
}

/** Extracts an approximate yaw angle (degrees) from MediaPipe's 4x4 facial transformation matrix. */
function yawFromMatrix(m: Float32Array | number[]): number {
  // Column-major 4x4; m[0], m[2] give enough of the rotation's forward-axis
  // projection to estimate yaw for a coarse liveness check (not aiming for
  // camera-calibration-grade precision here).
  const m0 = m[0];
  const m2 = m[2];
  const yawRad = Math.atan2(-m2, m0);
  return (yawRad * 180) / Math.PI;
}
