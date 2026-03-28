import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { formatWorkoutDuration } from '../utils/workoutDuration.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDay(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function FollowingFeed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data } = await api.get('/social/feed');
        if (alive) setItems(data.items || []);
      } catch (e) {
        if (alive) setErr(e.response?.data?.error || 'Could not load feed');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Following</h1>
        <p className="text-sm text-slate-400">
          Session counts and each person&apos;s last few completed workouts (title and duration only — no sets or
          exercises).
        </p>
      </div>

      {loading ? <p className="text-slate-500">Loading…</p> : null}
      {err ? <p className="text-red-400">{err}</p> : null}

      {!loading && !err && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
          <p>You are not following anyone yet.</p>
          <p className="mt-2 text-sm">
            Open a friend&apos;s public profile and tap <span className="text-slate-400">Follow</span>.
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.slug} className="rounded-xl border border-slate-800 bg-surface-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to={`/u/${encodeURIComponent(row.slug)}`}
                  className="font-medium text-white hover:text-accent-muted"
                >
                  {row.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {row.completedSessionsLast14Days} completed session
                  {row.completedSessionsLast14Days !== 1 ? 's' : ''} (last 14 days)
                </p>
                {row.lastCompletedAt ? (
                  <p className="text-xs text-slate-600">Most recent: {fmt(row.lastCompletedAt)}</p>
                ) : null}
              </div>
              <Link
                to={`/u/${encodeURIComponent(row.slug)}`}
                className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
              >
                Profile
              </Link>
            </div>

            {row.recentWorkouts?.length ? (
              <div className="mt-3 border-t border-slate-800/80 pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Recent workouts
                </p>
                <ul className="space-y-2">
                  {row.recentWorkouts.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-lg bg-surface-elevated/80 px-3 py-2 text-sm text-slate-300"
                    >
                      <p className="font-medium text-white">{w.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtDay(w.completedAt || w.startedAt)}
                        <span className="text-slate-600"> · </span>
                        <span className="font-mono text-slate-400">
                          {formatWorkoutDuration(w.startedAt, w.completedAt)}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 border-t border-slate-800/80 pt-3 text-xs text-slate-600">
                No completed workouts to show yet.
              </p>
            )}
          </li>
        ))}
      </ul>

      <Link to={appPath()} className="text-sm text-slate-500 hover:text-white">
        ← Dashboard
      </Link>
    </div>
  );
}
