import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 minutes before logout

type IdleTimerOptions = {
  timeoutMs?: number;
  warningBeforeMs?: number;
  onIdle?: () => void;
  onWarning?: (remainingMs: number) => void;
};

export function useIdleTimer({
  timeoutMs = IDLE_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
  onIdle,
  onWarning,
}: IdleTimerOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const warningFiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningFiredRef.current = false;
  }, []);

  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      reset();
    };

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    // Poll every 10 seconds. Using an interval (not a single setTimeout) ensures:
    // 1. The warning fires reliably when the user is idle for (timeoutMs - warningBeforeMs).
    // 2. The logout fires reliably when the user is idle for timeoutMs.
    // 3. After activity resets the timer, the next tick correctly recalculates elapsed time.
    const TICK_MS = 10_000;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        onIdle?.();
        // Stop ticking after logout to prevent repeated calls.
        clearInterval(intervalRef.current);
        return;
      }

      if (!warningFiredRef.current && elapsed >= timeoutMs - warningBeforeMs) {
        warningFiredRef.current = true;
        onWarning?.(timeoutMs - elapsed);
      }
    }, TICK_MS);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity));
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeoutMs, warningBeforeMs, onIdle, onWarning, reset]);

  return { reset };
}
