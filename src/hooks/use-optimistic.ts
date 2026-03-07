import { useState, useEffect, useCallback } from 'react';

/**
 * Provides optimistic local state that overlays a server value.
 *
 * When the user makes a selection, call `setOptimistic(newValue)` to
 * immediately reflect the change in the UI.  Once the Convex subscription
 * delivers the real update (i.e. `serverValue` changes), the optimistic
 * override is automatically cleared.
 *
 * A safety timeout (default 5 s) clears stale optimistic state if the
 * server never catches up (e.g. mutation failure).
 *
 * Uses the official React pattern of adjusting state during render when
 * props change (no refs needed).
 */
export function useOptimisticValue<T>(
  serverValue: T,
  timeoutMs = 5000,
): [T, (value: T) => void] {
  const [pending, setPending] = useState<T | null>(null);
  const [prevServer, setPrevServer] = useState(serverValue);

  // Official React pattern: adjust state during render when props change
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes
  if (prevServer !== serverValue) {
    setPrevServer(serverValue);
    if (pending !== null) {
      setPending(null);
    }
  }

  // Safety timeout: clear stale optimistic state asynchronously
  useEffect(() => {
    if (pending !== null) {
      const id = setTimeout(() => setPending(null), timeoutMs);
      return () => clearTimeout(id);
    }
  }, [pending, timeoutMs]);

  const setOptimistic = useCallback((value: T) => {
    setPending(value);
  }, []);

  return [pending ?? serverValue, setOptimistic];
}

/**
 * Array variant — compares by JSON serialisation so reference changes
 * from Convex don't cause false positives.
 */
export function useOptimisticArray<T>(
  serverValue: T[],
  timeoutMs = 5000,
): [T[], (value: T[]) => void] {
  const [pending, setPending] = useState<T[] | null>(null);
  const serialised = JSON.stringify(serverValue);
  const [prevSerialised, setPrevSerialised] = useState(serialised);

  if (prevSerialised !== serialised) {
    setPrevSerialised(serialised);
    if (pending !== null) {
      setPending(null);
    }
  }

  useEffect(() => {
    if (pending !== null) {
      const id = setTimeout(() => setPending(null), timeoutMs);
      return () => clearTimeout(id);
    }
  }, [pending, timeoutMs]);

  const setOptimistic = useCallback((value: T[]) => {
    setPending(value);
  }, []);

  return [pending ?? serverValue, setOptimistic];
}
