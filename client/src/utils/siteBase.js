/**
 * Origin + Vite `base` (no trailing slash). Use for absolute links to /u/, /share/, etc.
 * With `base: '/'` this is just `window.location.origin`.
 */
export function siteOriginPrefix() {
  if (typeof window === 'undefined') return '';
  let path = import.meta.env.BASE_URL || '/';
  if (path.endsWith('/')) path = path.slice(0, -1);
  return `${window.location.origin}${path}`;
}
