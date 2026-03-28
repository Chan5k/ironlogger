/** Full URL to open a shared workout/plan preview (same origin as the SPA). */
export function sharePageUrl(token) {
  if (typeof window === 'undefined') return `/share/${token}`;
  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
}
