import { useCallback, useEffect, useRef } from 'react';
import {
  preferPlaybackAudioSession,
  resetAudioSessionType,
} from '../utils/audioSessionMix.js';
import { formatWeightInputValue } from '../utils/weightUnits.js';

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

function fmtClock(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setLine(set, unit) {
  const w = formatWeightInputValue(Number(set.weight) || 0, unit);
  const r = set.reps === '' || set.reps == null ? '—' : String(set.reps);
  return `${w} ${unit} × ${r} reps`;
}

function artworkUrls() {
  const b = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return [
    { src: `${b}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${b}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ];
}

const HAS_MEDIA_SESSION =
  typeof navigator !== 'undefined' &&
  'mediaSession' in navigator &&
  typeof MediaMetadata !== 'undefined';

const MEDIA_ACTIONS = ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'];

function clearMediaActionHandlers() {
  if (!HAS_MEDIA_SESSION) return;
  for (const a of MEDIA_ACTIONS) {
    try {
      navigator.mediaSession.setActionHandler(a, null);
    } catch {
      /* ignore */
    }
  }
}

function applyMeta(state) {
  if (!HAS_MEDIA_SESSION) return;
  const spot = findFirstIncompleteSet(state.exercises);
  let album = (state.workoutTitle || '').trim() || 'Workout';
  let title;
  let artist;

  if (state.restRunning && state.restSecondsLeft > 0) {
    // Match in-app rest bar: countdown + “Rest”; album is IronLog so the card reads as the timer, not a track.
    title = `${fmtClock(state.restSecondsLeft)} · Rest`;
    artist = spot
      ? `Next: ${(spot.exercise.name || 'Exercise').trim()} · set ${spot.si + 1}/${spot.setCount} · skip » · +15s «`
      : 'Ready for next set · skip » · +15s «';
    album = 'IronLog';
  } else if (spot) {
    title = `${(spot.exercise.name || 'Exercise').trim()} · Set ${spot.si + 1}/${spot.setCount}`;
    artist = setLine(spot.set, state.weightUnit);
  } else {
    title = 'Session in progress';
    artist = 'All sets done — finish when ready';
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: artworkUrls(),
    });
  } catch {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album });
    } catch {
      /* give up */
    }
  }

  try {
    const total = Number(state.restTotal) || 0;
    if (state.restRunning && state.restSecondsLeft >= 0 && total > 0) {
      navigator.mediaSession.setPositionState({
        duration: total,
        playbackRate: 1,
        position: Math.min(total, Math.max(0, total - state.restSecondsLeft)),
      });
    } else {
      navigator.mediaSession.setPositionState({
        duration: 0,
        playbackRate: 1,
        position: 0,
      });
    }
  } catch {
    /* older browsers */
  }
}

/**
 * Lock screen / notification shade workout card via Media Session + silent keepalive.
 * Uses Audio Session `"playback"` when starting or resuming the keepalive so IronLog can own the
 * lock-screen card (other audio may pause then). Does not re-assert playback on every tap while the
 * silent loop is already running — avoids repeated interruptions from in-workout UI actions.
 */
export function useWorkoutLockScreenMedia({
  active,
  workoutTitle,
  exercises,
  restRunning,
  restSecondsLeft,
  restTotal,
  weightUnit,
  skipRestRef,
  extendRestRef,
}) {
  const audioRef = useRef(null);
  const stateRef = useRef({});
  const playingRef = useRef(false);

  stateRef.current = {
    active,
    workoutTitle,
    exercises,
    restRunning,
    restSecondsLeft,
    restTotal,
    weightUnit,
  };

  const getAudio = useCallback(() => {
    if (typeof document === 'undefined') return null;
    if (audioRef.current) return audioRef.current;
    const a = document.createElement('audio');
    a.preload = 'auto';
    a.loop = true;
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    a.src = `${base}/media/silence.mp3`;
    document.body.appendChild(a);
    audioRef.current = a;
    return a;
  }, []);

  const resumeKeepaliveAfterControl = useCallback(() => {
    getAudio();
    const a = audioRef.current;
    if (!stateRef.current.active || !a) return;
    applyMeta(stateRef.current);
    if (HAS_MEDIA_SESSION) {
      navigator.mediaSession.playbackState = 'playing';
    }
    if (a.paused) {
      preferPlaybackAudioSession();
    }
    void a.play().catch(() => {});
    playingRef.current = true;
  }, [getAudio]);

  const engagePlayback = useCallback(() => {
    if (!stateRef.current.active) return;
    const a = getAudio();
    if (!a) return;
    applyMeta(stateRef.current);
    if (HAS_MEDIA_SESSION) {
      navigator.mediaSession.playbackState = 'playing';
    }
    if (!a.paused) {
      playingRef.current = true;
      return;
    }
    preferPlaybackAudioSession();
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        playingRef.current = true;
      }).catch(() => {
        playingRef.current = false;
      });
    }
  }, [getAudio]);

  const prevRestRunningRef = useRef(false);
  useEffect(() => {
    if (!active) {
      prevRestRunningRef.current = restRunning;
      return;
    }
    if (restRunning && !prevRestRunningRef.current) {
      engagePlayback();
    }
    prevRestRunningRef.current = restRunning;
  }, [active, restRunning, engagePlayback]);

  useEffect(() => {
    if (!active) return;
    applyMeta(stateRef.current);
    if (HAS_MEDIA_SESSION && playingRef.current) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }, [active, workoutTitle, exercises, restRunning, restSecondsLeft, restTotal, weightUnit]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    getAudio();

    const onInteraction = () => {
      if (!stateRef.current.active) return;
      if (playingRef.current && audioRef.current && !audioRef.current.paused) return;
      engagePlayback();
    };

    document.addEventListener('pointerdown', onInteraction, { capture: true, passive: true });
    document.addEventListener('touchstart', onInteraction, { capture: true, passive: true });
    document.addEventListener('click', onInteraction, { capture: true, passive: true });

    const onVisible = () => {
      if (document.visibilityState === 'visible' && stateRef.current.active) {
        engagePlayback();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const skipRef = skipRestRef;
    const extRef = extendRestRef;

    const forwardSkip = () => {
      const s = stateRef.current;
      if (!s.restRunning || s.restSecondsLeft <= 0) return;
      skipRef?.current?.();
      resumeKeepaliveAfterControl();
    };

    const backExtend = () => {
      const s = stateRef.current;
      if (!s.restRunning || s.restSecondsLeft <= 0) return;
      extRef?.current?.();
      resumeKeepaliveAfterControl();
    };

    if (HAS_MEDIA_SESSION) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          preferPlaybackAudioSession();
          const a = audioRef.current;
          if (a) void a.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
          playingRef.current = true;
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
          navigator.mediaSession.playbackState = 'paused';
          playingRef.current = false;
        });
        navigator.mediaSession.setActionHandler('seekforward', forwardSkip);
        navigator.mediaSession.setActionHandler('nexttrack', forwardSkip);
        navigator.mediaSession.setActionHandler('seekbackward', backExtend);
        navigator.mediaSession.setActionHandler('previoustrack', backExtend);
      } catch {
        /* ignore */
      }
    }

    return () => {
      document.removeEventListener('pointerdown', onInteraction, { capture: true });
      document.removeEventListener('touchstart', onInteraction, { capture: true });
      document.removeEventListener('click', onInteraction, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
      audioRef.current?.pause();
      playingRef.current = false;
      clearMediaActionHandlers();
    };
  }, [active, getAudio, engagePlayback, skipRestRef, extendRestRef, resumeKeepaliveAfterControl]);

  useEffect(() => {
    if (active) return;
    resetAudioSessionType();
    if (HAS_MEDIA_SESSION) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, [active]);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.remove();
        audioRef.current = null;
      }
      playingRef.current = false;
      resetAudioSessionType();
      if (HAS_MEDIA_SESSION) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        clearMediaActionHandlers();
      }
    };
  }, []);

  return { engagePlayback };
}
