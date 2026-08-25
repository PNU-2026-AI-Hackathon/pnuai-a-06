import { useCallback, useRef } from 'react';

export const PRESS_GUARD_INTERVAL_MS = 2000;

type PressGuardState = {
  lastAcceptedAt: number;
};

export function usePressGuard() {
  const state = useRef<PressGuardState>({ lastAcceptedAt: 0 }).current;

  return useCallback(() => {
    const now = Date.now();

    if (now - state.lastAcceptedAt < PRESS_GUARD_INTERVAL_MS) {
      return false;
    }

    state.lastAcceptedAt = now;
    return true;
  }, [state]);
}
