import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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
          High-level activity from public profiles you follow. No workout titles or exercise details.
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

      <ul className="space-y-2">
        {items.map((row) => (
          <li
            key={row.slug}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-surface-card px-4 py-3"
          >
            <div>
              <Link to={`/u/${encodeURIComponent(row.slug)}`} className="font-medium text-white hover:text-accent-muted">
                {row.name}
              </Link>
              <p className="text-xs text-slate-500">
                {row.completedSessionsLast14Days} completed session
                {row.completedSessionsLast14Days !== 1 ? 's' : ''} (last 14 days)
              </p>
              <p className="text-xs text-slate-600">Last session: {fmt(row.lastCompletedAt)}</p>
            </div>
            <Link
              to={`/u/${encodeURIComponent(row.slug)}`}
              className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
            >
              Profile
            </Link>
          </li>
        ))}
      </ul>

      <Link to={appPath()} className="text-sm text-slate-500 hover:text-white">
        ← Dashboard
      </Link>
    </div>
  );
}
