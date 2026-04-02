/** Short chime URL (same-origin, precached with PWA). */
function restDoneSrc() {
  const b = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${b}/media/rest-done.mp3`;
}

let cached = null;

/**
 * Optional rest-complete chime. **HTMLAudioElement can pause or duck Spotify / Apple Music on iOS**
 * when this runs, so the app defaults to sound off and only plays when the user opts in in workout
 * settings. Vibration is handled separately in RestTimerBar.
 */
export function playRestEndSound() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    if (!cached) {
      cached = new Audio(restDoneSrc());
      cached.preload = 'auto';
      cached.setAttribute('playsinline', '');
      cached.setAttribute('webkit-playsinline', '');
    }
    cached.currentTime = 0;
    cached.volume = 0.4;
    void cached.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
