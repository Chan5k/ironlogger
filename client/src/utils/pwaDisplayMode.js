/**
 * True when the app runs as an installed PWA / “Add to Home Screen” (not a normal browser tab).
 * Used for lock-screen media and similar OS integrations.
 */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  try {
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}
