'use client';

import { useMemo, useRef } from 'react';

/**
 * Web port of the Expo app's `usePasteDetection`.
 *
 * The native version inferred a paste from a >4 character jump in a single
 * change event. The browser fires a real `paste` event, so detection here is
 * exact — the length-delta heuristic is kept as a secondary signal to catch
 * programmatic value injection (autofill bots, Selenium `send_keys`).
 */
export function usePasteDetection() {
  const pasteDetected = useRef(false);
  const previousValue = useRef('');

  /** Attach to the input's `onPaste`. */
  function onPaste() {
    pasteDetected.current = true;
  }

  /** Call from `onChange` with the new value. */
  function onChangeTextCapture(newValue: string) {
    const delta = newValue.length - previousValue.current.length;
    if (delta > 4) pasteDetected.current = true;
    previousValue.current = newValue;
  }

  function onFocusCapture() {
    /* Parity with the native hook's clipboard snapshot step. The browser
       does not permit reading the clipboard without an explicit user gesture
       and permission prompt, so we rely on the paste event instead. */
  }

  function isPasteDetected() {
    return pasteDetected.current;
  }

  function reset() {
    pasteDetected.current = false;
    previousValue.current = '';
  }

  // Stable identity — see the note in useKeystrokeDynamics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({ onPaste, onFocusCapture, onChangeTextCapture, isPasteDetected, reset }),
    []
  );
}
