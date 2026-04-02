import { preferAmbientAudioSession, preferTransientAudioSession } from './audioSessionMix.js';

/** Short chime URL (same-origin, precached with PWA). */
function restDoneSrc() {
  const b = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${b}/media/rest-done.mp3`;
}

let cached = null;

function ensureRestDoneAudio() {
  if (cached) return cached;
  const a = new Audio(restDoneSrc());
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  a.setAttribute('webkit-playsinline', '');
  const backToAmbient = () => {
    preferAmbientAudioSession();
  };
  a.addEventListener('ended', backToAmbient);
  a.addEventListener('error', backToAmbient);
  cached = a;
  return cached;
}

/**
 * Rest-complete chime. Uses a transient audio session when supported so other music is less likely to
 * stay paused; ambient is restored after the clip ends. Vibration is handled in RestTimerBar.
 */
export function playRestEndSound() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    const el = ensureRestDoneAudio();
    preferTransientAudioSession();
    el.currentTime = 0;
    el.volume = 0.4;
    void el.play().catch(() => {
      preferAmbientAudioSession();
    });
  } catch {
    preferAmbientAudioSession();
  }
}
