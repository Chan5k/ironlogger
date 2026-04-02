/**
 * Web Audio Session API (Safari / iOS 16.4+, limited Chromium).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type
 */

/** Prefer IronLog as the primary Now Playing / lock-screen session; other apps’ audio may pause or duck. */
export function preferPlaybackAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'playback';
    }
  } catch {
    /* ignore */
  }
}

/** Mix with Spotify / podcasts; less likely to show IronLog first on the lock screen. */
export function preferAmbientAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'ambient';
    }
  } catch {
    /* ignore */
  }
}

export function resetAudioSessionType() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'auto';
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
