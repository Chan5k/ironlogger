import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import { formatWorkoutDuration } from '../utils/workoutDuration.js';
import { useLiveClock } from '../hooks/useLiveClock.js';

function fmt(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/workouts?limit=50');
      setWorkouts(data.workouts || []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hasOpenWorkout = workouts.some((w) => !w.completedAt);
  const liveNow = useLiveClock(hasOpenWorkout);

  async function remove(id) {
    if (!confirm('Delete this workout?')) return;
    await api.delete(`/workouts/${id}`);
    load();
  }

  async function shareWorkout(id) {
    try {
      const { data } = await api.post(`/share/workouts/${id}`);
      const url = sharePageUrl(data.token);
      await offerShareLink(url, {
        shareTitle: 'Workout',
        successMessage: 'Share link copied to clipboard.',
      });
    } catch (e) {
      alert(e.response?.data?.error || 'Could not create share link');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Workouts</h1>
          <p className="text-sm text-slate-400">{total} total</p>
        </div>
        <Link
          to={appPath('workouts/new')}
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          + New
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li
              key={w._id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-surface-card p-3"
            >
              <Link to={appPath(`workouts/${w._id}`)} className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{w.title}</p>
                <p className="text-xs text-slate-500">{fmt(w.startedAt)}</p>
                <p className="font-mono text-xs text-slate-400">
                  {formatWorkoutDuration(w.startedAt, w.completedAt, {
                    live: !w.completedAt,
                    now: liveNow,
                  })}
                </p>
                {w.completedAt ? (
                  <span className="mt-1 inline-block text-xs text-emerald-500">Done</span>
                ) : (
                  <span className="mt-1 inline-block text-xs text-amber-500">Open</span>
                )}
              </Link>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => shareWorkout(w._id)}
                  className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => remove(w._id)}
                  className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
