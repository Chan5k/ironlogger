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

function buildMetadataPayload(s) {
  const name = (s.workoutTitle || '').trim() || 'Workout';
  const spot = findFirstIncompleteSet(s.exercises);
  let displayTitle;
  let displayArtist;
  const displayAlbum = name;

  if (s.restRunning && s.restSecondsLeft > 0) {
    displayTitle = `Rest ${formatRestClock(s.restSecondsLeft)}`;
    if (spot) {
      const exName = (spot.exercise.name || 'Exercise').trim() || 'Exercise';
      displayArtist = `Next: ${exName} · set ${spot.si + 1} of ${spot.setCount}`;
    } else {
      displayArtist = 'IronLog';
    }
  } else if (spot) {
    const exName = (spot.exercise.name || 'Exercise').trim() || 'Exercise';
    displayTitle = `${exName} · Set ${spot.si + 1} of ${spot.setCount}`;
    displayArtist = setSummaryLine(spot.set, s.weightUnit);
  } else {
    displayTitle = 'Session in progress';
    displayArtist = 'All sets done — finish when ready';
  }

  return { displayTitle, displayArtist, displayAlbum };
}

/**
 * Lock screen / shade via Media Session. Audio must start from a user gesture — call `engagePlayback`
 * from taps (see WorkoutEdit). Uses a looping silent MP3 so the OS shows media controls.
 */
export function useWorkoutLockScreenMedia({
  active,
  workoutTitle,
  exercises,
  restRunning,
  restSecondsLeft,
  restTotal,
  weightUnit,
}) {
  const audioRef = useRef(null);
  const stateRef = useRef({});

  stateRef.current = {
    active,
    workoutTitle,
    exercises,
    restRunning,
    restSecondsLeft,
    restTotal: Number(restTotal) || 0,
    weightUnit,
  };

  const ensureAudio = useCallback(() => {
    if (typeof document === 'undefined') return null;
    let a = audioRef.current;
    if (!a) {
      a = document.createElement('audio');
      a.preload = 'auto';
      a.loop = true;
      /** iOS / some Android builds hide “Now playing” when volume is ~0 */
      a.volume = 0.08;
      a.defaultMuted = false;
      a.muted = false;
      a.setAttribute('playsinline', '');
      a.setAttribute('webkit-playsinline', '');
      const base = import.meta.env.BASE_URL || '/';
      const mp3 = `${base}media/silence.mp3`;
      const wav = `${base}media/silence.wav`;
      a.src = mp3;
      a.addEventListener(
        'error',
        () => {
          if (a && String(a.src || '').includes('silence.mp3')) {
            a.src = wav;
            void a.load();
          }
        },
        { once: true }
      );
      document.body.appendChild(a);
      audioRef.current = a;
    }
    return a;
  }, []);

  const applyMetadata = useCallback(() => {
    const s = stateRef.current;
    if (
      !s.active ||
      typeof navigator === 'undefined' ||
      !navigator.mediaSession ||
      typeof MediaMetadata === 'undefined'
    ) {
      return;
    }

    const { displayTitle, displayArtist, displayAlbum } = buildMetadataPayload(s);

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle,
        artist: displayArtist,
        album: displayAlbum,
        artwork: lockScreenArtwork(),
      });
    } catch {
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

    if (typeof navigator.mediaSession.setPositionState === 'function') {
      try {
        const total = s.restTotal;
        if (s.restRunning && s.restSecondsLeft >= 0 && total > 0) {
          const elapsed = Math.min(total, Math.max(0, total - s.restSecondsLeft));
          navigator.mediaSession.setPositionState({
            duration: total,
            playbackRate: 1,
            position: elapsed,
          });
        } else {
          navigator.mediaSession.setPositionState(null);
        }
      } catch {
        /* Chrome throws if duration is invalid; ignore */
      }
    }

    const a = audioRef.current;
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = a && !a.paused ? 'playing' : 'paused';
    }
  }, []);

  /** Call from click / pointerdown while `active` so `play()` is allowed (autoplay policies). */
  const engagePlayback = useCallback(() => {
    const s = stateRef.current;
    if (!s.active || typeof document === 'undefined') return;
    const audio = ensureAudio();
    if (!audio) return;

    void audio
      .play()
      .then(() => {
        applyMetadata();
        if (typeof navigator !== 'undefined' && navigator.mediaSession) {
          navigator.mediaSession.playbackState = 'playing';
        }
      })
      .catch(() => {});
  }, [ensureAudio, applyMetadata]);

  useEffect(() => {
    if (!active) return undefined;
    applyMetadata();
    return undefined;
  }, [
    active,
    workoutTitle,
    exercises,
    restRunning,
    restSecondsLeft,
    restTotal,
    weightUnit,
    applyMetadata,
  ]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const audio = ensureAudio();
    if (!audio) return undefined;

    const onPointerDown = () => {
      engagePlayback();
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });

    const onVis = () => {
      if (document.visibilityState === 'visible' && audioRef.current?.paused) {
        engagePlayback();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);

    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          void audio.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
          applyMetadata();
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
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
      audio.pause();
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setPositionState?.(null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [active, ensureAudio, engagePlayback, applyMetadata]);

  useEffect(() => {
    if (active) return undefined;
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      try {
        navigator.mediaSession.setPositionState?.(null);
      } catch {
        /* ignore */
      }
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
          navigator.mediaSession.setPositionState?.(null);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { engagePlayback };
}
