import { siteOriginPrefix } from './siteBase.js';

/** Full URL to open a shared workout/plan preview (same origin + Vite base as the SPA). */
export function sharePageUrl(token) {
  const enc = encodeURIComponent(token);
  if (typeof window === 'undefined') {
    const b = import.meta.env.BASE_URL || '/';
    return `${b}share/${enc}`.replace(/\/+/g, '/');
  }
  return `${siteOriginPrefix()}/share/${enc}`;
}
