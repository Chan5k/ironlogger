import { useCallback, useEffect, useRef } from 'react';
import { formatWeightInputValue } from '../utils/weightUnits.js';
import { siteOriginPrefix } from '../utils/siteBase.js';

function findFirstIncompleteSet(exercises) {
  const list = exercises || [];
  for (let exIdx = 0; exIdx < list.length; exIdx += 1) {
    const ex = list[exIdx];
    const sets = ex?.sets || [];
    for (let si = 0; si < sets.length; si += 1) {
      if (!sets[si].completed) {
        return { exIdx, si, exercise: ex, set: sets[si], setCount: sets.length };
      }
    }
  }
  return null;
}

function formatRestClock(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function setSummaryLine(set, weightUnit) {
  const w = formatWeightInputValue(Number(set.weight) || 0, weightUnit);
  const r = set.reps === '' || set.reps == null ? '—' : String(set.reps);
  return `${w} ${weightUnit} × ${r} reps`;
}

function lockScreenArtwork() {
  const base = siteOriginPrefix();
  return [
    { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ];
}

/**
 * Shows workout + rest state on the lock screen / notification shade via the Media Session API,
 * using a near-silent looping audio clip so the OS treats the tab as “playing media”.
 */
export function useWorkoutLockScreenMedia({
  active,
  workoutTitle,
  exercises,
  restRunning,
  restSecondsLeft,
  weightUnit,
}) {
  const audioRef = useRef(null);

  const ensureAudio = useCallback(() => {
    if (typeof document === 'undefined') return null;
    let a = audioRef.current;
    if (!a) {
      a = document.createElement('audio');
      a.preload = 'auto';
      a.loop = true;
      a.volume = 0.001;
      a.setAttribute('playsinline', '');
      a.setAttribute('webkit-playsinline', '');
      a.src = `${import.meta.env.BASE_URL}media/silence.wav`;
      document.body.appendChild(a);
      audioRef.current = a;
    }
    return a;
  }, []);

  useEffect(() => {
    if (
      !active ||
      typeof navigator === 'undefined' ||
      !navigator.mediaSession ||
      typeof MediaMetadata === 'undefined'
    ) {
      return undefined;
    }

    const spot = findFirstIncompleteSet(exercises);
    const name = (workoutTitle || '').trim() || 'Workout';
    let displayTitle;
    let displayArtist;
    const displayAlbum = name;

    if (restRunning && restSecondsLeft > 0) {
      displayTitle = `Rest ${formatRestClock(restSecondsLeft)}`;
      if (spot) {
        const exName = (spot.exercise.name || 'Exercise').trim() || 'Exercise';
        displayArtist = `Next: ${exName} · set ${spot.si + 1} of ${spot.setCount}`;
      } else {
        displayArtist = 'IronLog';
      }
    } else if (spot) {
      const exName = (spot.exercise.name || 'Exercise').trim() || 'Exercise';
      displayTitle = `${exName} · Set ${spot.si + 1} of ${spot.setCount}`;
      displayArtist = setSummaryLine(spot.set, weightUnit);
    } else {
      displayTitle = 'Session in progress';
      displayArtist = 'All sets done — finish when ready';
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle,
        artist: displayArtist,
        album: displayAlbum,
        artwork: lockScreenArtwork(),
      });
      const a = audioRef.current;
      navigator.mediaSession.playbackState = a && !a.paused ? 'playing' : 'paused';
    } catch {
      /* Some browsers reject artwork URLs; retry without */
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: displayTitle,
          artist: displayArtist,
          album: displayAlbum,
        });
      } catch {
        /* ignore */
      }
    }

    return undefined;
  }, [active, workoutTitle, exercises, restRunning, restSecondsLeft, weightUnit]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const audio = ensureAudio();
    if (!audio) return undefined;

    const tryPlay = () => {
      void audio.play().catch(() => {});
    };
    tryPlay();
    document.addEventListener('pointerdown', tryPlay, { capture: true, passive: true });

    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          void audio.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audio.pause();
          navigator.mediaSession.playbackState = 'paused';
        });
      } catch {
        /* ignore */
      }
    }

    return () => {
      document.removeEventListener('pointerdown', tryPlay, { capture: true });
      audio.pause();
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [active, ensureAudio]);

  useEffect(() => {
    if (active) return undefined;
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
    return undefined;
  }, [active]);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.remove();
        audioRef.current = null;
      }
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
}
