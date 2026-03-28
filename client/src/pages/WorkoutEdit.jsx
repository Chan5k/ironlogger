import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
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
import PrCelebrationOverlay, { playPrFanfare } from '../components/PrCelebrationOverlay.jsx';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';

const emptySet = (type = 'normal') => ({
  reps: 10,
  weight: 0,
  completed: false,
  setType: type,
});

const REST_SOUND_KEY = 'ironlog_rest_sound';
const REST_HAPTIC_KEY = 'ironlog_rest_haptic';

export default function WorkoutEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [title, setTitle] = useState('Workout');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
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

  const dismissPrCelebration = useCallback(() => setPrCelebration(null), []);

  const restRunning = restSecondsLeft > 0;

  useEffect(() => {
    if (!restRunning) return undefined;
    const t = setInterval(() => {
      setRestSecondsLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(t);
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
    if (isNew) {
      setSessionStartedLocal(toDatetimeLocalValue(new Date()));
      setSessionEndedLocal('');
      setDurHours(0);
      setDurMins(0);
      setExercises([
        {
          _local: crypto.randomUUID(),
          exerciseId: null,
          name: 'Exercise',
          category: 'other',
          sets: [emptySet('normal'), emptySet('normal'), emptySet('normal')],
        },
      ]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/workouts/${id}`);
        if (!alive) return;
        const w = data.workout;
        setTitle(w.title);
        setNotes(w.notes || '');
        setSessionStartedLocal(toDatetimeLocalValue(w.startedAt));
        const endL = w.completedAt ? toDatetimeLocalValue(w.completedAt) : '';
        setSessionEndedLocal(endL);
        if (endL) {
          const total = diffMinutesFromLocal(toDatetimeLocalValue(w.startedAt), endL);
          if (total != null) {
            setDurHours(Math.floor(total / 60));
            setDurMins(total % 60);
          } else {
            setDurHours(0);
            setDurMins(0);
          }
        } else {
          setDurHours(0);
          setDurMins(0);
        }
        setExercises(
          (w.exercises || []).map((e) => ({
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
          }))
        );
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
      next[exIdx] = {
        ...next[exIdx],
        sets: [...next[exIdx].sets, emptySet('normal')],
      };
      return next;
    });
  }

  function addWarmupSet(exIdx) {
    setExercises((prev) => {
      const next = [...prev];
      next[exIdx] = {
        ...next[exIdx],
        sets: [...next[exIdx].sets, emptySet('warmup')],
      };
      return next;
    });
  }

  function beginRestAfterSet() {
    if (!sessionInProgress) return;
    const dur = readRestDurationSeconds();
    setRestTotal(dur);
    setRestSecondsLeft(dur);
  }

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
      alert(e.message);
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
          navigate(appPath(`workouts/${data.workout._id}`), { replace: true });
        } catch (e) {
          if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'POST', url: '/workouts', data: body })) {
            alert(
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
        } catch (e) {
          if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'PUT', url: `/workouts/${id}`, data: body })) {
            alert('Offline: changes queued. They will sync automatically when you are online, or tap Sync in the header.');
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
        const { data } = await api.get(`/workouts/${id}`);
        const w = data.workout;
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
            const endL = toDatetimeLocalValue(new Date());
            setSessionEndedLocal(endL);
            const startL = sessionStartedLocal;
            const total = diffMinutesFromLocal(startL, endL);
            if (total != null) {
              setDurHours(Math.floor(total / 60));
              setDurMins(total % 60);
            }
          } else {
            setSessionEndedLocal('');
            setDurHours(0);
            setDurMins(0);
          }
          alert('Offline: completion change queued. Sync when you are back online.');
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
      alert(e.response?.data?.error || 'Could not create share link');
    }
  }

  async function deleteWorkout() {
    if (!confirm('Delete this workout permanently?')) return;
    try {
      await api.delete(`/workouts/${id}`);
      navigate(appPath('workouts'));
    } catch (e) {
      if (isOfflineQueueableError(e) && enqueueOfflineRequest({ method: 'DELETE', url: `/workouts/${id}`, data: null })) {
        alert('Offline: delete queued. It will run when you are online. This workout may still appear until sync.');
        navigate(appPath('workouts'));
      } else {
        throw e;
      }
    }
  }

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

  return (
    <div className={`space-y-6 ${restRunning ? 'pb-32' : 'pb-8'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={appPath('workouts')} className="text-sm text-slate-500 hover:text-white">
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

      <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="session-start">
              Start
            </label>
            <input
              id="session-start"
              type="datetime-local"
              step="1"
              value={sessionStartedLocal}
              onChange={handleSessionStartChange}
              className="w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 font-mono text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="session-end">
              End (optional)
            </label>
            <input
              id="session-end"
              type="datetime-local"
              step="1"
              value={sessionEndedLocal}
              onChange={handleSessionEndChange}
              className="w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 font-mono text-white"
            />
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

      <div className="space-y-4">
        {exercises.map((ex, exIdx) => (
          <div
            key={ex._local}
            className="rounded-2xl border border-slate-800 bg-surface-card p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => setPickerFor(exIdx)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300"
              >
                From library
              </button>
              <button
                type="button"
                onClick={() => removeExercise(exIdx)}
                className="text-xs text-red-400"
              >
                Remove
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-500">{ex.category}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pb-2 pr-2">Set</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2">Wt ({weightUnit})</th>
                    <th className="pb-2 pr-2">Reps</th>
                    <th className="pb-2 pr-2">PR</th>
                    <th className="pb-2">Done</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, si) => {
                    const st = normalizeSetType(s.setType);
                    const base = prBaselines[exIdx];
                    const prevMax = base?.maxWeight ?? 0;
                    const wNum = Number(s.weight) || 0;
                    const isWeightPr =
                      st !== 'warmup' &&
                      !!s.completed &&
                      wNum > prevMax;
                    return (
                    <tr
                      key={si}
                      className={
                        st === 'warmup'
                          ? 'bg-slate-800/25'
                          : st === 'failure'
                            ? 'bg-amber-950/20'
                            : ''
                      }
                    >
                      <td className="py-1 pr-2 text-slate-400">{si + 1}</td>
                      <td className="py-1 pr-2">
                        <select
                          value={st}
                          onChange={(e) => updateSet(exIdx, si, 'setType', e.target.value)}
                          className="max-w-[7.5rem] rounded border border-slate-700 bg-surface py-1.5 pl-2 pr-1 text-xs text-white"
                          aria-label={`Set ${si + 1} type`}
                        >
                          {SET_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={formatWeightInputValue(s.weight, weightUnit)}
                          onChange={(e) =>
                            updateSet(exIdx, si, 'weight', parseWeightInput(e.target.value, weightUnit))
                          }
                          className="w-24 rounded border border-slate-700 bg-surface px-2 py-1 text-white"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={s.reps}
                          onChange={(e) => updateSet(exIdx, si, 'reps', e.target.value)}
                          className="w-16 rounded border border-slate-700 bg-surface px-2 py-1 text-white"
                        />
                      </td>
                      <td className="py-1 pr-2 align-middle">
                        {isWeightPr ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            PR
                          </span>
                        ) : st !== 'warmup' && s.completed && prevMax > 0 ? (
                          <span className="text-[10px] text-slate-600" title="Prior best weight (completed, non-warmup)">
                            max {prevMax}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={!!s.completed}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              const prevMax = prBaselines[exIdx]?.maxWeight ?? 0;
                              const wNum = Number(s.weight) || 0;
                              if (st !== 'warmup' && wNum > prevMax) {
                                window.setTimeout(() => playPrFanfare(), 200);
                                setPrCelebration({
                                  ts: Date.now(),
                                  exerciseName: ex.name?.trim() || 'Lift',
                                  weight: wNum,
                                  weightUnit,
                                });
                              }
                              beginRestAfterSet();
                            }
                            updateSet(exIdx, si, 'completed', checked);
                          }}
                          className="h-5 w-5 accent-accent"
                        />
                      </td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() => removeSet(exIdx, si)}
                          className="text-xs text-slate-500"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => addSet(exIdx)}
                className="text-xs text-accent-muted"
              >
                + Add set
              </button>
              <button
                type="button"
                onClick={() => addWarmupSet(exIdx)}
                className="text-xs text-slate-500 hover:text-slate-300"
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save workout'}
        </button>
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

      <PrCelebrationOverlay
        key={prCelebration?.ts ?? 'closed'}
        open={!!prCelebration}
        exerciseName={prCelebration?.exerciseName}
        weight={prCelebration?.weight}
        weightUnit={prCelebration?.weightUnit}
        onDismiss={dismissPrCelebration}
      />

      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotal}
        onSkip={() => setRestSecondsLeft(0)}
        onAddSeconds={(n) => setRestSecondsLeft((s) => s + n)}
        soundEnabled={restSoundEnabled}
        hapticEnabled={restHapticEnabled}
      />

      {pickerFor !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-surface-card shadow-xl">
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium text-white">Choose exercise</span>
                <button
                  type="button"
                  onClick={() => setPickerFor(null)}
                  className="text-slate-400"
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
            <div className="max-h-[50vh] overflow-y-auto p-2 sm:max-h-[60vh]">
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
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-surface-elevated"
                            >
                              {e.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
