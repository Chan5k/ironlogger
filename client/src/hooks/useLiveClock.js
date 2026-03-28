import { useEffect, useState } from 'react';

/**
 * Returns a `now` timestamp (ms) that updates every second while `enabled`.
 * Use with duration helpers so in-progress workouts tick without full page reload.
 */
export function useLiveClock(enabled) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return now;
}
