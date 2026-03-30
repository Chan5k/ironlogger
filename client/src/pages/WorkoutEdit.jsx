import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  clearWorkoutDraft,
  loadWorkoutDraft,
  newUnsavedWorkoutDraftKey,
  resetNewWorkoutDraftSession,
  saveWorkoutDraft,
  workoutDraftKey,
} from '../utils/workoutDraftStorage.js';
import {
  evaluateSetPr,
  mergeSetIntoBaseline,
  mergeTwoBaselines,
  sessionBaselineMapFromExercises,
} from '../utils/prBaseline.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import {
  filterExercisesByQuery,
  groupExercisesByCategory,
} from '../utils/exercisePickerFilter.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { formatWeightInputValue, parseWeightInput } from '../utils/weightUnits.js';
import { SET_TYPE_OPTIONS, normalizeSetType } from '../constants/setTypes.js';
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatWorkoutDuration,
  diffMinutesFromLocal,
  addMinutesToLocalDatetime,
} from '../utils/workoutDuration.js';
import { useLiveClock } from '../hooks/useLiveClock.js';
import RestTimerBar, {
  readRestDurationSeconds,
  writeRestDurationSeconds,
} from '../components/RestTimerBar.jsx';
import {
  enqueueOfflineRequest,
  isOfflineQueueableError,
} from '../utils/offlineQueue.js';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';
import PrCelebrationOverlay, { playPrFanfare } from '../components/PrCelebrationOverlay.jsx';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import {
  computeWorkoutShareStats,
  inferWorkoutKind,
} from '../utils/workoutShareStats.js';
import WorkoutShareModal from '../components/WorkoutShareModal.jsx';
import ExerciseIcon from '../components/ExerciseIcon.jsx';

const emptySet = (type = 'normal') => ({
  reps: 10,
  weight: 0,
  completed: false,
  setType: type,
});

const REST_SOUND_KEY = 'ironlog_rest_sound';
const REST_HAPTIC_KEY = 'ironlog_rest_haptic';

function userInitials(name) {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function WorkoutEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('Workout');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [serverCompleted, setServerCompleted] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [exercisePickerQuery, setExercisePickerQuery] = useState('');
  const exercisePickerInputRef = useRef(null);
  const [sessionStartedLocal, setSessionStartedLocal] = useState(() =>
    toDatetimeLocalValue(new Date())
  );
  const [sessionEndedLocal, setSessionEndedLocal] = useState('');
  const [durHours, setDurHours] = useState(0);
  const [durMins, setDurMins] = useState(0);
  const [prBaselines, setPrBaselines] = useState([]);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [restDurationPick, setRestDurationPick] = useState(() => readRestDurationSeconds());
  const [restSoundEnabled, setRestSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(REST_SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [restHapticEnabled, setRestHapticEnabled] = useState(() => {
    try {
      return localStorage.getItem(REST_HAPTIC_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [prCelebration, setPrCelebration] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [setPulse, setSetPulse] = useState(null);
  const [newSetKey, setNewSetKey] = useState(null);
  /** Per-exercise (_local) rolling baseline for sets completed in this session (server baselines exclude current workout). */
  const [sessionBaselineByLocal, setSessionBaselineByLocal] = useState({});
  const [restBarHeight, setRestBarHeight] = useState(0);
  const [pinnedActionsHeight, setPinnedActionsHeight] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const workoutActionsRef = useRef(null);

  const dismissPrCelebration = useCallback(() => setPrCelebration(null), []);

  const restRunning = restSecondsLeft > 0;

  const handleRestBarHeight = useCallback((h) => {
    setRestBarHeight(typeof h === 'number' && h > 0 ? h : 0);
  }, []);

  useEffect(() => {
    if (!restRunning) return undefined;
    const t = setInterval(() => {
      setRestSecondsLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [restRunning]);

  useLayoutEffect(() => {
    if (!restRunning) {
      setPinnedActionsHeight(0);
      return undefined;
    }
    const el = workoutActionsRef.current;
    if (!el) return undefined;
    const report = () => setPinnedActionsHeight(Math.round(el.getBoundingClientRect().height));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [restRunning]);

  useEffect(() => {
    const targets = exercises.map((e) => ({
      exerciseId: e.exerciseId ? String(e.exerciseId) : undefined,
      name: e.name || '',
    }));
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post('/workouts/pr-baselines', {
          targets,
          excludeWorkoutId: isNew ? undefined : id,
        });
        if (!cancelled && Array.isArray(data.baselines)) {
          setPrBaselines(data.baselines);
        }
      } catch {
        if (!cancelled) setPrBaselines([]);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exercises, id, isNew]);

  useEffect(() => {
    try {
      localStorage.setItem(REST_SOUND_KEY, restSoundEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [restSoundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(REST_HAPTIC_KEY, restHapticEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [restHapticEnabled]);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/exercises');
      setLibrary(data.exercises || []);
    })();
  }, []);

  useEffect(() => {
    if (pickerFor === null) return;
    setExercisePickerQuery('');
    const id = requestAnimationFrame(() => exercisePickerInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [pickerFor]);

  useEffect(() => {
    const locked = pickerFor !== null || discardConfirmOpen;
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerFor, discardConfirmOpen]);

  useEffect(() => {
    setSessionBaselineByLocal({});
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) {
      const key = newUnsavedWorkoutDraftKey();
      const draft = loadWorkoutDraft(key);
      const fromDraft =
        draft &&
        Array.isArray(draft.exercises) &&
        draft.exercises.length > 0 &&
        typeof draft.title === 'string';
      if (fromDraft) {
        setServerCompleted(false);
        setTitle(draft.title);
        setNotes(typeof draft.notes === 'string' ? draft.notes : '');
        setSessionStartedLocal(
          typeof draft.sessionStartedLocal === 'string' && draft.sessionStartedLocal
            ? draft.sessionStartedLocal
            : toDatetimeLocalValue(new Date())
        );
        setSessionEndedLocal(typeof draft.sessionEndedLocal === 'string' ? draft.sessionEndedLocal : '');
        setDurHours(Number.isFinite(draft.durHours) ? draft.durHours : 0);
        setDurMins(Number.isFinite(draft.durMins) ? draft.durMins : 0);
        const restored = draft.exercises.map((e) => ({
          ...e,
          _local: e._local || crypto.randomUUID(),
          exerciseId: e.exerciseId || null,
          name: e.name || 'Exercise',
          category: e.category || 'other',
          sets: (e.sets || []).map((s) => ({
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            completed: !!s.completed,
            setType: normalizeSetType(s.setType),
            _id: s._id,
          })),
        }));
        setSessionBaselineByLocal(sessionBaselineMapFromExercises(restored));
        setExercises(restored);
        setLoading(false);
        return;
      }
      setServerCompleted(false);
      setSessionStartedLocal(toDatetimeLocalValue(new Date()));
      setSessionEndedLocal('');
      setDurHours(0);
      setDurMins(0);
      const initial = [
        {
          _local: crypto.randomUUID(),
          exerciseId: null,
          name: 'Exercise',
          category: 'other',
          sets: [emptySet('normal'), emptySet('normal'), emptySet('normal')],
        },
      ];
      setSessionBaselineByLocal(sessionBaselineMapFromExercises(initial));
      setExercises(initial);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/workouts/${id}`);
        if (!alive) return;
        const w = data.workout;
        const completed = !!w.completedAt;
        setServerCompleted(completed);
        const key = workoutDraftKey(id, false);
        if (completed) {
          clearWorkoutDraft(key);
        }
        const draft = !completed ? loadWorkoutDraft(key) : null;
        const useDraft =
          draft &&
          Array.isArray(draft.exercises) &&
          draft.exercises.length > 0 &&
          typeof draft.title === 'string';

        setTitle(useDraft ? draft.title : w.title);
        setNotes(useDraft && typeof draft.notes === 'string' ? draft.notes : w.notes || '');
        setSessionStartedLocal(
          useDraft && typeof draft.sessionStartedLocal === 'string' && draft.sessionStartedLocal
            ? draft.sessionStartedLocal
            : toDatetimeLocalValue(w.startedAt)
        );
        const endL = w.completedAt ? toDatetimeLocalValue(w.completedAt) : '';
        const draftEnd =
          useDraft && typeof draft.sessionEndedLocal === 'string' ? draft.sessionEndedLocal : '';
        setSessionEndedLocal(useDraft && !w.completedAt ? draftEnd : endL);
        const effectiveEnd = useDraft && !w.completedAt ? draftEnd : endL;
        if (effectiveEnd) {
          const startForDur = useDraft && !w.completedAt
            ? typeof draft.sessionStartedLocal === 'string' && draft.sessionStartedLocal
              ? draft.sessionStartedLocal
              : toDatetimeLocalValue(w.startedAt)
            : toDatetimeLocalValue(w.startedAt);
          const total = diffMinutesFromLocal(startForDur, effectiveEnd);
          if (total != null) {
            setDurHours(Math.floor(total / 60));
            setDurMins(total % 60);
          } else if (useDraft && Number.isFinite(draft.durHours) && Number.isFinite(draft.durMins)) {
            setDurHours(draft.durHours);
            setDurMins(draft.durMins);
          } else {
            setDurHours(0);
            setDurMins(0);
          }
        } else {
          if (useDraft && Number.isFinite(draft.durHours) && Number.isFinite(draft.durMins)) {
            setDurHours(draft.durHours);
            setDurMins(draft.durMins);
          } else {
            setDurHours(0);
            setDurMins(0);
          }
        }
        if (useDraft) {
          const restored = draft.exercises.map((e) => ({
            ...e,
            _local: e._local || crypto.randomUUID(),
            exerciseId: e.exerciseId || null,
            name: e.name || 'Exercise',
            category: e.category || 'other',
            sets: (e.sets || []).map((s) => ({
              reps: s.reps ?? 0,
              weight: s.weight ?? 0,
              completed: !!s.completed,
              setType: normalizeSetType(s.setType),
              _id: s._id,
            })),
          }));
          setSessionBaselineByLocal(sessionBaselineMapFromExercises(restored));
          setExercises(restored);
        } else {
          const fromServer = (w.exercises || []).map((e) => ({
            ...e,
            _local: e._id || crypto.randomUUID(),
            exerciseId: e.exerciseId || null,
            sets: (e.sets || []).map((s) => ({
              reps: s.reps ?? 0,
              weight: s.weight ?? 0,
              completed: !!s.completed,
              setType: normalizeSetType(s.setType),
              _id: s._id,
            })),
          }));
          setSessionBaselineByLocal(sessionBaselineMapFromExercises(fromServer));
          setExercises(fromServer);
        }
      } catch {
        navigate(appPath('workouts'), { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isNew, navigate]);

  useEffect(() => {
    if (loading || serverCompleted) return;
    const key = isNew ? newUnsavedWorkoutDraftKey() : workoutDraftKey(id, false);
    const t = window.setTimeout(() => {
      saveWorkoutDraft(key, {
        title,
        notes,
        sessionStartedLocal,
        sessionEndedLocal,
        durHours,
        durMins,
        exercises,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [
    loading,
    serverCompleted,
    isNew,
    id,
    title,
    notes,
    sessionStartedLocal,
    sessionEndedLocal,
    durHours,
    durMins,
    exercises,
  ]);

  const weightUnit = useWeightUnit();

  const startedISO = useMemo(
    () => fromDatetimeLocalValue(sessionStartedLocal),
    [sessionStartedLocal]
  );
  const endedISO = useMemo(
    () => (sessionEndedLocal.trim() ? fromDatetimeLocalValue(sessionEndedLocal) : null),
    [sessionEndedLocal]
  );

  const sessionInProgress = !endedISO;
  const liveNow = useLiveClock(sessionInProgress);

  const durationLabel = useMemo(() => {
    if (!startedISO) return '—';
    return formatWorkoutDuration(startedISO, endedISO, {
      live: sessionInProgress,
      now: liveNow,
    });
  }, [startedISO, endedISO, sessionInProgress, liveNow]);

  const shareStats = useMemo(
    () => computeWorkoutShareStats(exercises, prBaselines, weightUnit),
    [exercises, prBaselines, weightUnit]
  );
  const shareKind = useMemo(() => inferWorkoutKind(title, exercises), [title, exercises]);
  const shareCardOptions = useMemo(
    () => ({
      displayName: (user?.name || user?.email || 'Athlete').trim() || 'Athlete',
      initials: userInitials(user?.name || user?.email || ''),
      workoutTitle: title,
      workoutKind: shareKind,
      durationLabel,
      displayVolume: shareStats.displayVolume,
      volumeUnitLabel: 'kg',
      setCount: shareStats.setCount,
      prLines: shareStats.prLines,
      topExercises: shareStats.topExercises,
    }),
    [user, title, shareKind, durationLabel, shareStats, weightUnit]
  );

  const startedAtDisplay = useMemo(() => {
    if (!startedISO) return '';
    return new Date(startedISO).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  }, [startedISO]);

  function handleSessionStartChange(e) {
    const newStart = e.target.value;
    const oldStartIso = fromDatetimeLocalValue(sessionStartedLocal);
    const endIso = fromDatetimeLocalValue(sessionEndedLocal);
    setSessionStartedLocal(newStart);
    if (sessionEndedLocal.trim() && oldStartIso && endIso) {
      const durMs = new Date(endIso).getTime() - new Date(oldStartIso).getTime();
      if (durMs >= 0) {
        const newStartIso = fromDatetimeLocalValue(newStart);
        if (newStartIso) {
          setSessionEndedLocal(toDatetimeLocalValue(new Date(new Date(newStartIso).getTime() + durMs)));
        }
      }
    }
  }

  function applyDurationParts(hStr, mStr) {
    const H0 = Math.max(0, Math.floor(Number(hStr) || 0));
    const M0 = Math.max(0, Math.floor(Number(mStr) || 0));
    const total = H0 * 60 + M0;
    if (total === 0) {
      setDurHours(0);
      setDurMins(0);
      setSessionEndedLocal('');
      return;
    }
    setDurHours(Math.floor(total / 60));
    setDurMins(total % 60);
    const newEnd = addMinutesToLocalDatetime(sessionStartedLocal, total);
    if (newEnd) setSessionEndedLocal(newEnd);
  }

  function handleSessionEndChange(e) {
    const v = e.target.value;
    setSessionEndedLocal(v);
    if (!v.trim()) {
      setDurHours(0);
      setDurMins(0);
      return;
    }
    const total = diffMinutesFromLocal(sessionStartedLocal, v);
    if (total != null) {
      setDurHours(Math.floor(total / 60));
      setDurMins(total % 60);
    }
  }

  function sessionTimePayload() {
    const start = fromDatetimeLocalValue(sessionStartedLocal);
    if (!start) {
      throw new Error('Start time is required');
    }
    const end = sessionEndedLocal.trim() ? fromDatetimeLocalValue(sessionEndedLocal) : null;
    if (sessionEndedLocal.trim() && !end) {
      throw new Error('Invalid end time');
    }
    if (end && new Date(end) < new Date(start)) {
      throw new Error('End time must be after start time');
    }
    return { startedAt: start, completedAt: end };
  }

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      {
        _local: crypto.randomUUID(),
        exerciseId: null,
        name: 'Exercise',
        category: 'other',
        sets: [emptySet('normal'), emptySet('normal')],
      },
    ]);
  }

  function removeExercise(idx) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExercises((prev) => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  }

  function addSet(exIdx) {
    setExercises((prev) => {
      const next = [...prev];
      const newIdx = next[exIdx].sets.length;
      next[exIdx] = {
        ...next[exIdx],
        sets: [...next[exIdx].sets, emptySet('normal')],
      };
      setNewSetKey(`${next[exIdx]._local}-${newIdx}`);
      window.setTimeout(() => setNewSetKey(null), 300);
      return next;
    });
  }

  function addWarmupSet(exIdx) {
    setExercises((prev) => {
      const next = [...prev];
      const newIdx = next[exIdx].sets.length;
      next[exIdx] = {
        ...next[exIdx],
        sets: [...next[exIdx].sets, emptySet('warmup')],
      };
      setNewSetKey(`${next[exIdx]._local}-${newIdx}`);
      window.setTimeout(() => setNewSetKey(null), 300);
      return next;
    });
  }

  function beginRestAfterSet() {
    if (!sessionInProgress) return;
    const dur = readRestDurationSeconds();
    setRestTotal(dur);
    setRestSecondsLeft(dur);
  }

  const toggleSetComplete = useCallback(
    (exIdx, setIdx, checked) => {
      const ex = exercises[exIdx];
      const s = ex?.sets?.[setIdx];
      if (!ex || !s) return;
      const st = normalizeSetType(s.setType);
      if (checked) {
        if (st !== 'warmup') {
          const wNum = Number(s.weight) || 0;
          const rNum = Math.floor(Number(s.reps) || 0);
          const serverB = prBaselines[exIdx];
          const sessionB = sessionBaselineByLocal[ex._local];
          const effective = mergeTwoBaselines(serverB, sessionB);
          const pr = evaluateSetPr(effective, wNum, rNum);
          if (pr) {
            window.setTimeout(() => playPrFanfare(), 200);
            setPrCelebration({
              ts: Date.now(),
              exerciseName: ex.name?.trim() || 'Lift',
              exerciseCategory: ex.category || 'other',
              weight: wNum,
              reps: rNum,
              weightUnit,
              headline: pr.headline,
            });
          }
          setSessionBaselineByLocal((prev) => ({
            ...prev,
            [ex._local]: mergeSetIntoBaseline(prev[ex._local], wNum, rNum),
          }));
        }
        beginRestAfterSet();
      }
      updateSet(exIdx, setIdx, 'completed', checked);
      setSetPulse({ exIdx, si: setIdx });
      window.setTimeout(() => setSetPulse(null), 450);
    },
    [exercises, prBaselines, sessionBaselineByLocal, weightUnit, sessionInProgress]
  );

  function applyRestPreset(sec) {
    const v = writeRestDurationSeconds(sec);
    setRestDurationPick(v);
  }

  function removeSet(exIdx, setIdx) {
    setExercises((prev) => {
      const next = [...prev];
      const sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
      next[exIdx] = { ...next[exIdx], sets: sets.length ? sets : [emptySet('normal')] };
      return next;
    });
  }

  function pickExercise(exIdx, exLib) {
    setExercises((prev) => {
      const next = [...prev];
      next[exIdx] = {
        ...next[exIdx],
        exerciseId: exLib._id,
        name: exLib.name,
        category: exLib.category,
      };
      return next;
    });
    setPickerFor(null);
  }

  function payloadExercises() {
    return exercises.map((e, order) => ({
      exerciseId: e.exerciseId || undefined,
      name: e.name,
      category: e.category || 'other',
      order,
      sets: e.sets.map((s) => ({
        reps: Number(s.reps) || 0,
        weight: Number(s.weight) || 0,
        completed: !!s.completed,
        setType: normalizeSetType(s.setType),
      })),
    }));
  }

  async function save() {
    let times;
    try {
      times = sessionTimePayload();
    } catch (e) {
      await appAlert(e.message);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const body = {
          title,
          notes,
          exercises: payloadExercises(),
          startedAt: times.startedAt,
          completedAt: times.completedAt,
        };
        try {
          const { data } = await api.post('/workouts', body);
          clearWorkoutDraft(newUnsavedWorkoutDraftKey());
          resetNewWorkoutDraftSession();
          navigate(appPath(`workouts/${data.workout._id}`), { replace: true });
        } catch (e) {
          if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'POST', url: '/workouts', data: body })) {
            await appAlert(
              'You appear offline. This workout is queued and will be created when you are back online. Keep this tab and use Sync from the app header when connected.'
            );
          } else {
            throw e;
          }
        }
      } else {
        const body = {
          title,
          notes,
          exercises: payloadExercises(),
          startedAt: times.startedAt,
          completedAt: times.completedAt,
        };
        try {
          await api.put(`/workouts/${id}`, body);
          clearWorkoutDraft(workoutDraftKey(id, false));
        } catch (e) {
          if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'PUT', url: `/workouts/${id}`, data: body })) {
            await appAlert('Offline: changes queued. They will sync automatically when you are online, or tap Sync in the header.');
          } else {
            throw e;
          }
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(done) {
    setSaving(true);
    try {
      const payload = { completedAt: done ? new Date().toISOString() : null };
      try {
        await api.put(`/workouts/${id}`, payload);
        if (done) clearWorkoutDraft(workoutDraftKey(id, false));
        const { data } = await api.get(`/workouts/${id}`);
        const w = data.workout;
        setServerCompleted(!!w.completedAt);
        const startL = toDatetimeLocalValue(w.startedAt);
        const endL = w.completedAt ? toDatetimeLocalValue(w.completedAt) : '';
        setSessionStartedLocal(startL);
        setSessionEndedLocal(endL);
        if (endL) {
          const total = diffMinutesFromLocal(startL, endL);
          if (total != null) {
            setDurHours(Math.floor(total / 60));
            setDurMins(total % 60);
          }
        } else {
          setDurHours(0);
          setDurMins(0);
        }
      } catch (e) {
        if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'PUT', url: `/workouts/${id}`, data: payload })) {
          if (done) {
            clearWorkoutDraft(workoutDraftKey(id, false));
            setServerCompleted(true);
            const endL = toDatetimeLocalValue(new Date());
            setSessionEndedLocal(endL);
            const startL = sessionStartedLocal;
            const total = diffMinutesFromLocal(startL, endL);
            if (total != null) {
              setDurHours(Math.floor(total / 60));
              setDurMins(total % 60);
            }
          } else {
            setServerCompleted(false);
            setSessionEndedLocal('');
            setDurHours(0);
            setDurMins(0);
          }
          await appAlert('Offline: completion change queued. Sync when you are back online.');
        } else {
          throw e;
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function shareWorkoutLink() {
    if (isNew || !id) return;
    try {
      const { data } = await api.post(`/share/workouts/${id}`);
      const url = sharePageUrl(data.token);
      await offerShareLink(url, {
        shareTitle: 'Workout',
        successMessage:
          'Share link copied. Recipients can open it without an account; logging in lets them save a copy to their workouts.',
      });
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not create share link');
    }
  }

  async function deleteWorkout() {
    if (!(await appConfirm('Delete this workout permanently?'))) return;
    try {
      await api.delete(`/workouts/${id}`);
      clearWorkoutDraft(workoutDraftKey(id, false));
      navigate(appPath('workouts'));
    } catch (e) {
      if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'DELETE', url: `/workouts/${id}`, data: null })) {
        await appAlert('Offline: delete queued. It will run when you are online. This workout may still appear until sync.');
        navigate(appPath('workouts'));
      } else {
        throw e;
      }
    }
  }

  const performDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    setRestSecondsLeft(0);
    if (isNew) {
      clearWorkoutDraft(newUnsavedWorkoutDraftKey());
      resetNewWorkoutDraftSession();
    } else {
      clearWorkoutDraft(workoutDraftKey(id, false));
    }
    navigate(appPath('workouts'));
  }, [isNew, id, navigate]);

  const filteredPickerExercises = useMemo(
    () => filterExercisesByQuery(library, exercisePickerQuery),
    [library, exercisePickerQuery]
  );
  const groupedPicker = useMemo(
    () => groupExercisesByCategory(filteredPickerExercises),
    [filteredPickerExercises]
  );

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const showDiscard = isNew || !serverCompleted;

  const workoutActionsInner = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save workout'}
        </button>
        {showDiscard ? (
          <button
            type="button"
            onClick={() => setDiscardConfirmOpen(true)}
            disabled={saving}
            className="rounded-xl border border-red-900/80 px-6 py-3 text-sm font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/25 disabled:opacity-50"
          >
            Discard
          </button>
        ) : null}
        {!isNew ? (
          <>
            <button
              type="button"
              onClick={() => markComplete(true)}
              disabled={saving}
              className="rounded-xl border border-emerald-700 px-6 py-3 font-medium text-emerald-400"
            >
              Mark complete
            </button>
            <button
              type="button"
              onClick={() => markComplete(false)}
              disabled={saving}
              className="rounded-xl border border-slate-600 px-6 py-3 text-slate-300"
            >
              Reopen
            </button>
            <button
              type="button"
              onClick={() => shareWorkoutLink()}
              disabled={saving}
              className="rounded-xl border border-slate-600 px-6 py-3 text-slate-300"
            >
              Share link
            </button>
            <button
              type="button"
              onClick={deleteWorkout}
              className="rounded-xl border border-red-900 px-6 py-3 text-red-400"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="min-w-0 space-y-6 pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={appPath('workouts')}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-white active:bg-slate-800"
        >
          ← Back
        </Link>
      </div>

      {!isNew && endedISO ? (
        <p className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-400">
          Session has an end time — it counts toward progress charts. Clear “End” and save to
          reopen.
        </p>
      ) : null}

      <div>
        <label className="mb-1 block text-xs text-slate-500">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
        />
      </div>

      <div className="min-w-0 overflow-x-clip rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">Session time</h2>
        <p className="mb-3 text-xs text-slate-500">
          Use <span className="font-medium text-slate-400">hours and minutes</span> to set how long
          the session was — the end time updates automatically. Changing start keeps that length.
          You can still edit start or end directly.
        </p>
        {startedAtDisplay ? (
          <p className="mb-2 text-sm text-slate-400">
            Started: <span className="font-mono text-slate-200">{startedAtDisplay}</span>
          </p>
        ) : null}
        <p className="mb-4 text-lg font-medium text-accent-muted">
          Duration: <span className="font-mono text-white">{durationLabel}</span>
          {sessionInProgress ? (
            <span className="ml-2 text-xs font-normal text-slate-500">live, every second</span>
          ) : null}
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="dur-hours">
              Hours
            </label>
            <input
              id="dur-hours"
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={durHours}
              onChange={(e) => applyDurationParts(e.target.value, durMins)}
              className="w-20 rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="dur-mins">
              Minutes
            </label>
            <input
              id="dur-mins"
              type="number"
              min={0}
              inputMode="numeric"
              value={durMins}
              onChange={(e) => applyDurationParts(durHours, e.target.value)}
              className="w-20 rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
            />
          </div>
          <p className="pb-2 text-xs text-slate-600">
            0h 0m clears the end (session in progress). Use Mark complete to stamp &quot;now&quot;.
          </p>
        </div>
        {/*
          iOS WebKit: datetime-local + horizontal padding + w-full overflows the card (same as type="date").
          Shell carries border/bg/padding; input is flex-sized with zero padding.
        */}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="session-start">
              Start
            </label>
            <div className="group w-full min-w-0 max-w-full">
              <div className="flex min-h-[44px] w-full min-w-0 max-w-full items-center rounded-xl border border-slate-700 bg-surface px-3 py-2 transition-[border-color,box-shadow] duration-motion ease-motion-standard group-focus-within:border-slate-500 group-focus-within:shadow-[0_0_0_1px_rgba(100,116,139,0.35)]">
                <input
                  id="session-start"
                  type="datetime-local"
                  step="1"
                  value={sessionStartedLocal}
                  onChange={handleSessionStartChange}
                  className="min-w-0 flex-1 basis-0 border-0 bg-transparent p-0 font-mono text-base text-white outline-none focus:ring-0 focus-visible:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="session-end">
              End (optional)
            </label>
            <div className="group w-full min-w-0 max-w-full">
              <div className="flex min-h-[44px] w-full min-w-0 max-w-full items-center rounded-xl border border-slate-700 bg-surface px-3 py-2 transition-[border-color,box-shadow] duration-motion ease-motion-standard group-focus-within:border-slate-500 group-focus-within:shadow-[0_0_0_1px_rgba(100,116,139,0.35)]">
                <input
                  id="session-end"
                  type="datetime-local"
                  step="1"
                  value={sessionEndedLocal}
                  onChange={handleSessionEndChange}
                  className="min-w-0 flex-1 basis-0 border-0 bg-transparent p-0 font-mono text-base text-white outline-none focus:ring-0 focus-visible:ring-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {sessionInProgress ? (
        <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
          <h2 className="mb-1 text-sm font-semibold text-white">Rest timer</h2>
          <p className="mb-3 text-xs text-slate-500">
            Starts when you tick <span className="text-slate-400">Done</span> on a set. Change the
            default length below; use +30s on the bar if you need more time.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => applyRestPreset(sec)}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  restDurationPick === sec
                    ? 'bg-accent text-white'
                    : 'border border-slate-600 text-slate-300'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={restSoundEnabled}
                onChange={(e) => setRestSoundEnabled(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              <span className="text-sm text-slate-300">Play a short tone when rest hits zero</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={restHapticEnabled}
                onChange={(e) => setRestHapticEnabled(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              <span className="text-sm text-slate-300">
                Vibration when rest ends (supported phones / PWAs only)
              </span>
            </label>
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs text-slate-500">Workout notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How it felt, injuries, cues…"
          className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
        />
        <p className="mt-2 text-xs text-slate-500">
          Set type: warm-up sets are skipped in dashboard volume and progress charts; normal and
          failure sets count.
        </p>
      </div>

      {!isNew && endedISO ? (
        <section className="rounded-2xl border border-slate-800 bg-surface-card p-4 ring-1 ring-emerald-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Session summary
          </p>
          <p className="mt-2 text-lg font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{shareKind}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-surface/80 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Duration</p>
              <p className="mt-1 font-mono text-sm text-white">{durationLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-surface/80 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Volume</p>
              <p className="mt-1 font-mono text-sm text-white">
                {shareStats.displayVolume.toLocaleString()} kg
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-surface/80 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Sets</p>
              <p className="mt-1 font-mono text-sm text-white">{shareStats.setCount}</p>
            </div>
            <div className="flex items-end sm:col-span-1">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="h-11 w-full rounded-xl border border-blue-500/40 bg-blue-600/15 px-4 text-sm font-semibold text-blue-200 transition-colors duration-motion ease-motion-standard hover:bg-blue-600/25"
              >
                Share image
              </button>
            </div>
          </div>
          {shareStats.prLines.length ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-200/95">
              {shareStats.prLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-4">
        {exercises.map((ex, exIdx) => (
          <div
            key={ex._local}
            className="rounded-2xl border border-slate-800 bg-surface-card p-4"
          >
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ExerciseIcon name={ex.name} category={ex.category} boxed className="h-5 w-5 shrink-0 text-slate-300" />
                <input
                  value={ex.name}
                  onChange={(e) =>
                    setExercises((prev) => {
                      const n = [...prev];
                      n[exIdx] = { ...n[exIdx], name: e.target.value };
                      return n;
                    })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-surface px-3 py-2 text-sm font-medium text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setPickerFor(exIdx)}
                  className="min-h-11 w-full rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-surface-elevated/60 active:bg-surface-elevated sm:w-auto sm:min-w-[9.5rem]"
                >
                  From library
                </button>
                <button
                  type="button"
                  onClick={() => removeExercise(exIdx)}
                  className="min-h-11 w-full rounded-xl border border-red-900/50 bg-red-950/15 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-950/30 active:bg-red-950/40 sm:w-auto sm:min-w-[9.5rem]"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="mb-2 text-xs text-slate-500">{ex.category}</p>
            <div className="space-y-2" role="table" aria-label={`Sets for ${ex.name || 'exercise'}`}>
              <div className="hidden text-xs text-slate-500 sm:flex sm:items-center sm:gap-2 sm:px-1 sm:pb-1">
                <span className="w-8 shrink-0">Set</span>
                <span className="w-[7.5rem] shrink-0">Type</span>
                <span className="min-w-0 flex-1">Wt ({weightUnit})</span>
                <span className="w-16 shrink-0">Reps</span>
                <span className="w-14 shrink-0 text-center">PR</span>
                <span className="h-11 w-11 shrink-0" aria-hidden />
                <span className="w-8 shrink-0" aria-hidden />
              </div>
              {ex.sets.map((s, si) => {
                const st = normalizeSetType(s.setType);
                const base = prBaselines[exIdx];
                const prevMax = base?.maxWeight ?? 0;
                const wNum = Number(s.weight) || 0;
                const rNum = Math.floor(Number(s.reps) || 0);
                const sessionB = sessionBaselineByLocal[ex._local];
                const effectiveB = mergeTwoBaselines(base, sessionB);
                const prResult = st !== 'warmup' && !!s.completed
                  ? evaluateSetPr(effectiveB, wNum, rNum)
                  : null;
                const pulsing =
                  setPulse && setPulse.exIdx === exIdx && setPulse.si === si;
                const rowBg =
                  st === 'warmup'
                    ? 'bg-slate-800/25'
                    : st === 'failure'
                      ? 'bg-amber-950/20'
                      : s.completed
                        ? 'bg-emerald-950/20'
                        : 'bg-transparent';
                return (
                  <div
                    key={si}
                    role="row"
                    className={`flex flex-wrap items-center gap-2 rounded-xl border px-2 py-2 transition-[background-color,box-shadow,border-color] duration-motion ease-motion-standard sm:flex-nowrap sm:gap-2 sm:px-1 ${rowBg} ${
                      s.completed
                        ? 'border-emerald-500/25'
                        : 'border-slate-800/80 hover:border-slate-700'
                    } ${pulsing ? 'ring-2 ring-blue-500/45' : ''} ${
                      newSetKey === `${ex._local}-${si}` ? 'animate-set-slide-in' : ''
                    }`}
                    onClick={(e) => {
                      if (e.target.closest('input, select, button, textarea, [data-no-row-toggle]')) return;
                      toggleSetComplete(exIdx, si, !s.completed);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSetComplete(exIdx, si, !s.completed);
                      }
                    }}
                    tabIndex={0}
                  >
                    <span
                      className="flex h-11 w-8 shrink-0 items-center text-sm text-slate-400"
                      role="cell"
                    >
                      {si + 1}
                    </span>
                    <select
                      value={st}
                      onChange={(e) => updateSet(exIdx, si, 'setType', e.target.value)}
                      className="h-11 max-w-[9rem] shrink-0 rounded-lg border border-slate-700 bg-surface py-0 pl-2 pr-8 text-xs text-white sm:max-w-[7.5rem]"
                      aria-label={`Set ${si + 1} type`}
                      data-no-row-toggle
                    >
                      {SET_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={formatWeightInputValue(s.weight, weightUnit)}
                      onChange={(e) =>
                        updateSet(exIdx, si, 'weight', parseWeightInput(e.target.value, weightUnit))
                      }
                      className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-surface px-3 text-white sm:max-w-[6.5rem] sm:flex-none sm:basis-24"
                      aria-label={`Set ${si + 1} weight`}
                      data-no-row-toggle
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => updateSet(exIdx, si, 'reps', e.target.value)}
                      className="h-11 w-[4.5rem] shrink-0 rounded-lg border border-slate-700 bg-surface px-2 text-white sm:w-16"
                      aria-label={`Set ${si + 1} reps`}
                      data-no-row-toggle
                    />
                    <div
                      className="flex h-11 min-w-[2.5rem] flex-1 items-center justify-center sm:w-14 sm:flex-none"
                      role="cell"
                    >
                      {prResult ? (
                        <span className="inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-muted">
                          PR
                        </span>
                      ) : st !== 'warmup' && s.completed && prevMax > 0 ? (
                        <span
                          className="text-[10px] text-slate-600"
                          title="Prior best weight (completed, non-warmup)"
                        >
                          max {prevMax}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </div>
                    <button
                      type="button"
                      data-no-row-toggle
                      aria-pressed={!!s.completed}
                      aria-label={
                        s.completed ? `Unmark set ${si + 1} as done` : `Mark set ${si + 1} done`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSetComplete(exIdx, si, !s.completed);
                      }}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-colors duration-motion ease-motion-standard sm:h-11 sm:w-11 ${
                        s.completed
                          ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-600 bg-slate-800/60 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      data-no-row-toggle
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSet(exIdx, si);
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                      aria-label={`Remove set ${si + 1}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addSet(exIdx)}
                className="min-h-11 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-muted transition-colors hover:bg-accent/20 active:bg-accent/25"
              >
                + Add set
              </button>
              <button
                type="button"
                onClick={() => addWarmupSet(exIdx)}
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/70 active:bg-slate-800"
              >
                + Warm-up set
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addExercise}
        className="w-full rounded-xl border border-dashed border-slate-600 py-3 text-sm text-slate-400"
      >
        + Add exercise
      </button>

      {restRunning ? (
        <>
          <div
            aria-hidden
            className="shrink-0"
            style={{ height: Math.max(pinnedActionsHeight, 88) }}
          />
          {createPortal(
            <div
              ref={workoutActionsRef}
              className="fixed left-0 right-0 z-[55] border-t border-slate-800 bg-surface-card/98 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
              style={{ bottom: restBarHeight }}
            >
              <div className="mx-auto w-full max-w-6xl px-4 md:px-8">{workoutActionsInner}</div>
            </div>,
            document.body
          )}
        </>
      ) : (
        <div ref={workoutActionsRef}>{workoutActionsInner}</div>
      )}

      <PrCelebrationOverlay
        key={prCelebration?.ts ?? 'closed'}
        open={!!prCelebration}
        exerciseName={prCelebration?.exerciseName}
        exerciseCategory={prCelebration?.exerciseCategory}
        weight={prCelebration?.weight}
        reps={prCelebration?.reps}
        weightUnit={prCelebration?.weightUnit}
        headline={prCelebration?.headline}
        onDismiss={dismissPrCelebration}
      />

      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotal}
        onSkip={() => setRestSecondsLeft(0)}
        onAddSeconds={(n) => setRestSecondsLeft((s) => s + n)}
        soundEnabled={restSoundEnabled}
        hapticEnabled={restHapticEnabled}
        onBarHeightChange={handleRestBarHeight}
      />

      <WorkoutShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        cardOptions={shareCardOptions}
      />

      {discardConfirmOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[310] flex min-h-[100dvh] items-center justify-center overflow-y-auto overflow-x-hidden p-4"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="workout-discard-title"
              aria-describedby="workout-discard-desc"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close discard dialog"
                className="animate-ui-backdrop-in fixed inset-0 bg-black/65 backdrop-blur-[2px] motion-reduce:animate-none motion-reduce:opacity-100"
                onClick={() => setDiscardConfirmOpen(false)}
              />
              <div
                className="animate-ui-modal-in relative z-10 my-auto w-full max-w-sm rounded-2xl border border-red-900/55 bg-red-950/45 p-5 shadow-2xl shadow-black/50 ring-1 ring-red-500/20 backdrop-blur-sm motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none"
                onClick={(e) => e.stopPropagation()}
              >
                <p id="workout-discard-title" className="text-base font-semibold text-red-100">
                  Discard this workout?
                </p>
                <p id="workout-discard-desc" className="mt-2 text-sm leading-relaxed text-red-200/90">
                  {isNew
                    ? 'Your draft will be removed. This cannot be undone.'
                    : 'Unsaved changes will be lost. The saved workout on the server stays as it was until you save again.'}
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setDiscardConfirmOpen(false)}
                    className="rounded-xl border border-slate-600 bg-surface-card/80 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-slate-800/90"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={performDiscard}
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
                  >
                    Yes, discard
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {pickerFor !== null
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex min-h-[100dvh] items-center justify-center overflow-y-auto overflow-x-hidden p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="workout-exercise-picker-title"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close exercise picker"
                className="animate-ui-backdrop-in fixed inset-0 bg-black/65 backdrop-blur-[2px] motion-reduce:animate-none motion-reduce:opacity-100"
                onClick={() => setPickerFor(null)}
              />
              <div
                className="animate-ui-modal-in relative z-10 my-auto flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-surface-card shadow-2xl shadow-black/40 ring-1 ring-white/5 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 border-b border-slate-800 px-4 py-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span id="workout-exercise-picker-title" className="font-medium text-white">
                      Choose exercise
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerFor(null)}
                      className="min-h-10 min-w-10 rounded-lg px-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <label className="sr-only" htmlFor="workout-exercise-search">
                    Search exercises
                  </label>
                  <input
                    id="workout-exercise-search"
                    ref={exercisePickerInputRef}
                    type="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder="Type to filter by name or category…"
                    value={exercisePickerQuery}
                    onChange={(e) => setExercisePickerQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-accent"
                  />
                  {exercisePickerQuery.trim() ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {filteredPickerExercises.length} match
                      {filteredPickerExercises.length !== 1 ? 'es' : ''}
                    </p>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  {filteredPickerExercises.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-500">
                      No exercises match “{exercisePickerQuery.trim()}”. Try fewer words or a category
                      like chest or legs.
                    </p>
                  ) : (
                    Object.entries(groupedPicker)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cat, list]) => (
                        <div key={cat} className="mb-4">
                          <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">
                            {cat}
                          </p>
                          <ul className="space-y-1">
                            {list.map((e) => (
                              <li key={e._id}>
                                <button
                                  type="button"
                                  onClick={() => pickExercise(pickerFor, e)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-surface-elevated"
                                >
                                  <ExerciseIcon
                                    name={e.name}
                                    category={e.category}
                                    className="h-4 w-4 text-slate-500"
                                  />
                                  <span>{e.name}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
