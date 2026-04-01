import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import NewWorkoutLink from '../components/NewWorkoutLink.jsx';
import { appPath } from '../constants/routes.js';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import { formatWorkoutDuration } from '../utils/workoutDuration.js';
import { useLiveClock } from '../hooks/useLiveClock.js';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';

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
    if (!(await appConfirm('Delete this workout?'))) return;
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
      await appAlert(e.response?.data?.error || 'Could not create share link');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Workouts</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{total} total</p>
        </div>
        <NewWorkoutLink className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white touch-manipulation transition-opacity duration-motion ease-motion-standard hover:opacity-90 sm:min-h-0 sm:py-2">
          + New
        </NewWorkoutLink>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li
              key={w._id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-card p-3 sm:flex-row sm:items-stretch sm:gap-3 sm:p-3"
            >
              <Link
                to={appPath(`workouts/${w._id}`)}
                className="min-w-0 flex-1 rounded-lg outline-none ring-blue-500/0 transition-shadow duration-motion ease-motion-standard focus-visible:ring-2 sm:py-0.5"
              >
                <p className="truncate font-medium text-slate-900 dark:text-white">{w.title}</p>
                <p className="text-xs text-slate-500">{fmt(w.startedAt)}</p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
                  {formatWorkoutDuration(w.startedAt, w.completedAt, {
                    live: !w.completedAt,
                    now: liveNow,
                  })}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                  Volume{' '}
                  {(w.totalVolumeKg ?? 0).toLocaleString()} kg
                </p>
                {w.completedAt ? (
                  <span className="mt-1 inline-block text-xs font-medium text-emerald-700 dark:text-emerald-500">Done</span>
                ) : (
                  <span className="mt-1 inline-block text-xs font-medium text-amber-700 dark:text-amber-500">Open</span>
                )}
              </Link>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-col sm:justify-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => shareWorkout(w._id)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300/90 dark:border-slate-600/80 bg-slate-100 px-3 text-sm font-semibold text-slate-800 touch-manipulation transition-colors duration-motion ease-motion-standard hover:border-slate-400 hover:bg-slate-200 active:bg-slate-200/90 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:active:bg-slate-800/80 sm:min-h-10 sm:min-w-[7.5rem] sm:px-3 sm:text-xs sm:font-medium"
                >
                  <Share2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => remove(w._id)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-300/90 bg-red-50 px-3 text-sm font-semibold text-red-800 touch-manipulation transition-colors duration-motion ease-motion-standard hover:border-red-400 hover:bg-red-100 active:bg-red-100/90 dark:border-red-900/55 dark:bg-red-950/25 dark:text-red-200 dark:hover:border-red-800/80 dark:hover:bg-red-950/45 dark:active:bg-red-950/55 sm:min-h-10 sm:min-w-[7.5rem] sm:px-3 sm:text-xs sm:font-medium"
                >
                  <Trash2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
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
