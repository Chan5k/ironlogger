import { useEffect, useMemo, useRef, useState } from 'react';
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

const emptySet = () => ({ reps: 10, weight: 0, completed: false, setType: 'normal' });

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
          sets: [emptySet(), emptySet(), emptySet()],
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
        sets: [emptySet(), emptySet()],
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
        sets: [...next[exIdx].sets, emptySet()],
      };
      return next;
    });
  }

  function removeSet(exIdx, setIdx) {
    setExercises((prev) => {
      const next = [...prev];
      const sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
      next[exIdx] = { ...next[exIdx], sets: sets.length ? sets : [emptySet()] };
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
        const { data } = await api.post('/workouts', {
          title,
          notes,
          exercises: payloadExercises(),
          startedAt: times.startedAt,
          completedAt: times.completedAt,
        });
        navigate(appPath(`workouts/${data.workout._id}`), { replace: true });
      } else {
        await api.put(`/workouts/${id}`, {
          title,
          notes,
          exercises: payloadExercises(),
          startedAt: times.startedAt,
          completedAt: times.completedAt,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(done) {
    setSaving(true);
    try {
      await api.put(`/workouts/${id}`, {
        completedAt: done ? new Date().toISOString() : null,
      });
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
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkout() {
    if (!confirm('Delete this workout permanently?')) return;
    await api.delete(`/workouts/${id}`);
    navigate(appPath('workouts'));
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
    <div className="space-y-6 pb-8">
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
              <table className="w-full min-w-[380px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pb-2 pr-2">Set</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2">Wt ({weightUnit})</th>
                    <th className="pb-2 pr-2">Reps</th>
                    <th className="pb-2">Done</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, si) => {
                    const st = normalizeSetType(s.setType);
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
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={!!s.completed}
                          onChange={(e) => updateSet(exIdx, si, 'completed', e.target.checked)}
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
            <button
              type="button"
              onClick={() => addSet(exIdx)}
              className="mt-2 text-xs text-accent-muted"
            >
              + Add set
            </button>
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
              onClick={deleteWorkout}
              className="rounded-xl border border-red-900 px-6 py-3 text-red-400"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>

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
