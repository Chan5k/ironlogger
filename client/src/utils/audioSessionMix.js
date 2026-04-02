/**
 * Web Audio Session API (Safari / iOS 16.4+, limited Chromium). Lets the OS mix our audio with
 * Spotify / podcasts instead of taking exclusive "playback" focus when the browser supports it.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type
 */

export function preferAmbientAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'ambient';
    }
  } catch {
    /* ignore */
  }
}

/** Short UI sounds — may duck other audio briefly; usually does not fully pause music. */
export function preferTransientAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'transient';
    }
  } catch {
    /* ignore */
  }
}
