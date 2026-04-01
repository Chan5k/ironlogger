import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../api/client.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { kgToLbs, LBS_PER_KG } from '../utils/weightUnits.js';
import {
  filterExercisesByQuery,
  groupExercisesByCategory,
} from '../utils/exercisePickerFilter.js';
import ExerciseIcon from '../components/ExerciseIcon.jsx';

const LISTBOX_ID = 'progress-exercise-suggestions';

function fmtShort(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Progress() {
  const weightUnit = useWeightUnit();
  const [exercises, setExercises] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const [points, setPoints] = useState([]);
  const [estimatedOneRM, setEstimatedOneRM] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/exercises');
      setExercises(data.exercises || []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPoints([]);
      setEstimatedOneRM(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/workouts/progress/${selectedId}`);
        if (!alive) return;
        setEstimatedOneRM(data.estimatedOneRM || null);
        setPoints(
          (data.points || []).map((p) => ({
            ...p,
            label: fmtShort(p.date),
          }))
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const filtered = useMemo(
    () => filterExercisesByQuery(exercises, searchQuery),
    [exercises, searchQuery]
  );

  const groupedFiltered = useMemo(() => groupExercisesByCategory(filtered), [filtered]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPickerOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery]);

  const selected = exercises.find((e) => e._id === selectedId);

  function pickExercise(ex) {
    setSelectedId(ex._id);
    setSearchQuery('');
    setPickerOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function clearSelection() {
    setSelectedId('');
    setPoints([]);
    setSearchQuery('');
    setPickerOpen(false);
    inputRef.current?.focus();
  }

  function onSearchKeyDown(e) {
    if (!pickerOpen || !searchQuery.trim()) {
      if (e.key === 'Escape') {
        setPickerOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    const n = filtered.length;
    if (n === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < n - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < n) {
      e.preventDefault();
      pickExercise(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPickerOpen(false);
      setActiveIndex(-1);
    }
  }

  const showSuggestions = pickerOpen && searchQuery.trim().length > 0;
  const chartPoints = useMemo(() => {
    if (weightUnit === 'kg') return points;
    return points.map((p) => ({
      ...p,
      maxWeight: kgToLbs(p.maxWeight),
      volume: p.volume * LBS_PER_KG,
    }));
  }, [points, weightUnit]);

  const fmtWt = (v) =>
    `${typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v} ${weightUnit}`;
  const fmtVol = (v) =>
    `${typeof v === 'number' ? Math.round(v).toLocaleString() : v} ${weightUnit}×reps`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Progress</h1>
        <p className="text-sm text-slate-400">
          Completed workouts only. Max weight, reps, and volume ignore warm-up sets; normal and
          failure sets count.
        </p>
      </div>

      <div className="space-y-3">
        <label className="mb-1 block text-xs text-slate-500" htmlFor="progress-exercise-search">
          Exercise
        </label>

        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ExerciseIcon name={selected.name} category={selected.category} boxed className="h-5 w-5 text-slate-300" />
              <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Selected</p>
              <p className="truncate font-medium text-slate-900 dark:text-white">
                {selected.name}{' '}
                <span className="font-normal text-slate-500">({selected.category})</span>
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div ref={wrapRef} className="relative">
          <input
            ref={inputRef}
            id="progress-exercise-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? LISTBOX_ID : undefined}
            aria-activedescendant={
              showSuggestions && activeIndex >= 0 && filtered[activeIndex]
                ? `progress-ex-opt-${filtered[activeIndex]._id}`
                : undefined
            }
            placeholder={
              selected
                ? 'Search to pick a different exercise…'
                : 'Type name or category — matches update as you type'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onKeyDown={onSearchKeyDown}
            className="min-h-[48px] w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3 text-base text-slate-900 dark:text-white placeholder:text-slate-500 outline-none focus:border-accent"
          />

          {searchQuery.trim() ? (
            <p className="mt-1 text-xs text-slate-500">
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
            </p>
          ) : null}

          {showSuggestions ? (
          <div
            id={LISTBOX_ID}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card py-2 shadow-xl"
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No exercises match &quot;{searchQuery.trim()}&quot;. Try fewer words or a category
                like chest or legs.
              </p>
            ) : (
              Object.entries(groupedFiltered)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, list]) => (
                  <div key={cat}>
                    <p className="sticky top-0 bg-surface-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {cat}
                    </p>
                    <ul className="px-1 pb-2">
                      {list.map((e) => {
                        const idx = filtered.findIndex((x) => x._id === e._id);
                        const isActive = idx === activeIndex;
                        return (
                          <li key={e._id}>
                            <button
                              type="button"
                              role="option"
                              id={`progress-ex-opt-${e._id}`}
                              aria-selected={isActive}
                              className={`flex w-full items-center rounded-lg px-3 py-3 text-left text-sm text-slate-900 dark:text-white sm:py-2.5 ${
                                isActive ? 'bg-surface-elevated ring-1 ring-slate-600/60' : 'hover:bg-surface-elevated/80'
                              }`}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => pickExercise(e)}
                            >
                              <ExerciseIcon name={e.name} category={e.category} className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
                              <span className="font-medium">{e.name}</span>
                              <span className="ml-2 text-xs text-slate-500">{e.category}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
            )}
          </div>
        ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading chart…</p>
      ) : points.length === 0 && selectedId ? (
        <p className="text-slate-500">No completed sessions with this exercise yet.</p>
      ) : points.length === 0 ? (
        <p className="text-slate-500">Search and choose an exercise to see charts.</p>
      ) : (
        <div className="space-y-8">
          {estimatedOneRM ? (
            <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm">
              <p className="font-medium text-amber-200/90">Estimated 1RM (from your best logged set)</p>
              <p className="mt-2 font-mono text-lg text-slate-900 dark:text-white">
                Epley ≈ {fmtWt(weightUnit === 'kg' ? estimatedOneRM.epley : kgToLbs(estimatedOneRM.epley))}
                {estimatedOneRM.brzycki != null ? (
                  <>
                    {' '}
                    · Brzycki ≈{' '}
                    {fmtWt(
                      weightUnit === 'kg' ? estimatedOneRM.brzycki : kgToLbs(estimatedOneRM.brzycki)
                    )}
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Based on {estimatedOneRM.fromWeight} {weightUnit} × {estimatedOneRM.fromReps} reps (completed,
                non–warm-up). {estimatedOneRM.caveat}
              </p>
            </div>
          ) : null}

          <div className="h-64 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">
              Max weight ({weightUnit})
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value) => [fmtWt(value), `Weight (${weightUnit})`]}
                />
                <Legend />
                <Line type="monotone" dataKey="maxWeight" name={`Weight (${weightUnit})`} stroke="#60a5fa" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">Total reps (session)</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="totalReps" name="Reps" stroke="#34d399" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">
              Volume ({weightUnit} × reps)
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value) => [fmtVol(value), 'Volume']}
                />
                <Legend />
                <Line type="monotone" dataKey="volume" name={`Volume (${weightUnit}×reps)`} stroke="#f472b6" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
