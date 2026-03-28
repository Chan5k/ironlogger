/** Base path for the authenticated app (everything except landing and auth). */
export const APP_BASE = '/app';

/** In-app route, e.g. `appPath()` → `/app`, `appPath('workouts')` → `/app/workouts`. */
export function appPath(segment = '') {
  if (!segment) return APP_BASE;
  const s = segment.startsWith('/') ? segment.slice(1) : segment;
  return `${APP_BASE}/${s}`;
}
