import { useEffect } from 'react';

/**
 * IronLog intentionally does **not** register the Web Media Session or play silent keepalive audio.
 * That behavior caused Spotify / Apple Music / etc. to pause or lose lock-screen and headset controls.
 *
 * Rest timer feedback uses vibration (see RestTimerBar) and optional UI; lock-screen skip/seek for
 * rest is not available without claiming the media session.
 */
const HAS_MEDIA_SESSION = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

const MEDIA_ACTIONS = ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'];

function releaseMediaSession() {
  if (!HAS_MEDIA_SESSION) return;
  try {
    for (const a of MEDIA_ACTIONS) {
      try {
        navigator.mediaSession.setActionHandler(a, null);
      } catch {
        /* ignore */
      }
    }
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    /* ignore */
  }
}

export function useWorkoutLockScreenMedia({ active }) {
  useEffect(() => {
    return () => releaseMediaSession();
  }, []);

  useEffect(() => {
    if (!active) releaseMediaSession();
  }, [active]);

  return { engagePlayback: () => {} };
}
