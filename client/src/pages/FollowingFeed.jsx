import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/client.js';
import RemoveFriendDialog from '../components/RemoveFriendDialog.jsx';
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
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [removeFriend, setRemoveFriend] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeErr, setRemoveErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data } = await api.get('/social/feed');
        if (!cancelled) setItems(data.items || []);
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.error || 'Could not load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key]);

  async function executeRemove() {
    const uid = removeFriend?.userId;
    if (!uid) return;
    setRemoveBusy(true);
    setRemoveErr('');
    try {
      await api.delete(`/social/following/${encodeURIComponent(uid)}`);
      setItems((prev) => prev.filter((i) => i.userId !== uid));
    } catch (e) {
      setRemoveErr(e.response?.data?.error || 'Could not remove');
      throw e;
    } finally {
      setRemoveBusy(false);
    }
  }

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
            Ask them for their <span className="text-slate-400">friend invite</span> link, or open their public
            profile and tap <span className="text-slate-400">Follow</span>.
          </p>
        </div>
      ) : null}

      <RemoveFriendDialog
        friend={removeFriend}
        onClosed={() => {
          setRemoveFriend(null);
          setRemoveErr('');
        }}
        onRemove={executeRemove}
        busy={removeBusy}
        error={removeErr}
      />

      <ul className="space-y-3">
        {items.map((row) => (
          <li
            key={row.userId || row.slug || row.name}
            className="rounded-xl border border-slate-800 bg-surface-card px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {row.slug ? (
                  <Link
                    to={`/u/${encodeURIComponent(row.slug)}`}
                    className="font-medium text-white hover:text-accent-muted"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <>
                    <span className="font-medium text-white">{row.name}</span>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      No public profile URL yet — they won&apos;t appear on /u/… until they add one in Settings.
                    </p>
                  </>
                )}
                {row.slug && row.profilePublic === false ? (
                  <p className="mt-0.5 text-[11px] text-amber-500/90">Public profile is off</p>
                ) : null}
                <p className="text-xs text-slate-500">
                  {row.completedSessionsLast14Days} completed session
                  {row.completedSessionsLast14Days !== 1 ? 's' : ''} (last 14 days)
                </p>
                {row.lastCompletedAt ? (
                  <p className="text-xs text-slate-600">Most recent: {fmt(row.lastCompletedAt)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {row.slug ? (
                  <Link
                    to={`/u/${encodeURIComponent(row.slug)}`}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
                  >
                    Profile
                  </Link>
                ) : null}
                {row.userId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveErr('');
                      setRemoveFriend({ userId: row.userId, name: row.name || 'Athlete' });
                    }}
                    className="rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-1.5 text-xs font-medium text-rose-300/95 transition-colors hover:bg-rose-950/45"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
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
