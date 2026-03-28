import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { LBS_PER_KG } from '../utils/weightUnits.js';
import { formatWorkoutDuration } from '../utils/workoutDuration.js';
import { useLiveClock } from '../hooks/useLiveClock.js';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function Dashboard() {
  const weightUnit = useWeightUnit();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, w] = await Promise.all([
          api.get('/workouts/summary'),
          api.get('/workouts?limit=5'),
        ]);
        if (!alive) return;
        setSummary(s.data);
        setRecent(w.data.workouts || []);
      } catch (e) {
        if (alive) setErr(e.response?.data?.error || 'Failed to load');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hasOpenWorkout =
    !!summary &&
    ((summary.lastWorkout && !summary.lastWorkout.completedAt) ||
      recent.some((w) => !w.completedAt));
  const liveNow = useLiveClock(hasOpenWorkout);

  if (err) {
    return <p className="text-red-400">{err}</p>;
  }

  if (!summary) {
    return <p className="text-slate-500">Loading dashboard…</p>;
  }

  const displayVolume =
    weightUnit === 'lbs'
      ? Math.round(summary.estimatedTotalVolume * LBS_PER_KG)
      : summary.estimatedTotalVolume;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Your training at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
          <p className="text-xs text-slate-500">Total sessions</p>
          <p className="text-2xl font-semibold text-white">{summary.totalWorkouts}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
          <p className="text-xs text-slate-500">This week</p>
          <p className="text-2xl font-semibold text-white">{summary.workoutsThisWeek}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
          <p className="text-xs text-slate-500">This month</p>
          <p className="text-2xl font-semibold text-white">{summary.workoutsThisMonth}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
          <p className="text-xs text-slate-500">Est. volume ({weightUnit}×reps)</p>
          <p className="text-2xl font-semibold text-white">
            {displayVolume.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">Warm-up sets excluded</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <p className="text-xs text-slate-500">Last session</p>
        {summary.lastWorkout ? (
          <>
            <p className="mt-1 font-medium text-white">{summary.lastWorkout.title}</p>
            <p className="text-sm text-slate-400">{fmtDate(summary.lastWorkout.startedAt)}</p>
            <p className="font-mono text-xs text-slate-500">
              {formatWorkoutDuration(
                summary.lastWorkout.startedAt,
                summary.lastWorkout.completedAt,
                {
                  live: !summary.lastWorkout.completedAt,
                  now: liveNow,
                }
              )}
            </p>
            {summary.lastWorkout.completedAt ? (
              <span className="mt-2 inline-block rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                Completed
              </span>
            ) : (
              <span className="mt-2 inline-block rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
                In progress
              </span>
            )}
          </>
        ) : (
          <p className="mt-1 text-slate-400">No workouts yet</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={appPath('workouts/new')}
          className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-white"
        >
          New workout
        </Link>
        <Link
          to={appPath('templates')}
          className="rounded-xl border border-slate-600 px-4 py-3 text-center text-sm font-medium text-slate-200"
        >
          From plan
        </Link>
        <Link
          to={appPath('progress')}
          className="rounded-xl border border-slate-600 px-4 py-3 text-center text-sm font-medium text-slate-200"
        >
          View progress
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent workouts
        </h2>
        <ul className="space-y-2">
          {recent.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500">
              Log your first workout to see it here
            </li>
          ) : (
            recent.map((w) => (
              <li key={w._id}>
                <Link
                  to={appPath(`workouts/${w._id}`)}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-surface-elevated px-4 py-3 active:bg-slate-800"
                >
                  <div>
                    <p className="font-medium text-white">{w.title}</p>
                    <p className="text-xs text-slate-500">{fmtDate(w.startedAt)}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {formatWorkoutDuration(w.startedAt, w.completedAt, {
                        live: !w.completedAt,
                        now: liveNow,
                      })}
                    </p>
                  </div>
                  <span className="text-slate-500">→</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
