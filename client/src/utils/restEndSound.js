/** Short chime URL (same-origin, precached with PWA). */
function restDoneSrc() {
  const b = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${b}/media/rest-done.mp3`;
}

let cached = null;

/**
 * Plays the rest-complete tone via HTMLAudioElement so it still fires when the tab is in the
 * background / lock screen (unlike Web Audio oscillators).
 */
export function playRestEndSound() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    if (!cached) {
      cached = new Audio(restDoneSrc());
      cached.preload = 'auto';
    }
    cached.currentTime = 0;
    cached.volume = 0.45;
    void cached.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
