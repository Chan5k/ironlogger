import { useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * GET /api/health on the real API origin (e.g. Render) so the dyno stays warm.
 * Requires `VITE_API_URL` in production builds (same as API calls).
 */
export function getApiKeepAliveHealthUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw && String(raw).trim()) {
    const origin = String(raw).replace(/\/$/, '');
    return `${origin}/api/health`;
  }
  return null;
}

export default function ApiKeepAlive() {
  useEffect(() => {
    const url = getApiKeepAliveHealthUrl();
    if (!url) return;

    const intervalMs = Number(import.meta.env.VITE_API_KEEPALIVE_MS);
    const ms = Number.isFinite(intervalMs) && intervalMs > 10_000 ? intervalMs : DEFAULT_INTERVAL_MS;

    const ping = () => {
      fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' }).catch(() => {});
    };

    ping();
    const id = setInterval(ping, ms);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
