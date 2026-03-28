import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';

export default function PublicProfile() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    setData(null);
    (async () => {
      try {
        const { data: d } = await api.get(`/public/profile/${encodeURIComponent(slug || '')}`);
        if (alive) setData(d);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.status === 404 ? 'This profile is not public or does not exist.' : 'Could not load profile.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-surface px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← IronLog home
        </Link>

        {loading ? <p className="text-slate-400">Loading…</p> : null}
        {!loading && err ? (
          <div className="rounded-2xl border border-slate-800 bg-surface-card p-6">
            <p className="text-slate-300">{err}</p>
            <Link
              to={appPath()}
              className="mt-4 inline-block text-sm font-medium text-accent-muted hover:text-accent"
            >
              Open app
            </Link>
          </div>
        ) : null}

        {!loading && data ? (
          <div className="rounded-2xl border border-slate-800 bg-surface-card p-6">
            <h1 className="text-2xl font-bold text-white">{data.profile?.name || 'Athlete'}</h1>
            <p className="mt-1 text-sm text-slate-500">Public IronLog profile</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-800/80 pb-3">
                <dt className="text-slate-500">Completed workouts</dt>
                <dd className="font-mono text-slate-200">{data.stats?.totalWorkouts ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-800/80 pb-3">
                <dt className="text-slate-500">Last 30 days</dt>
                <dd className="font-mono text-slate-200">{data.stats?.workoutsLast30Days ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Est. total volume ({data.profile?.weightUnit || 'kg'}×reps)</dt>
                <dd className="font-mono text-slate-200">
                  {data.stats?.estimatedTotalVolume != null ? data.stats.estimatedTotalVolume : '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-slate-600">
              Email and detailed logs are never shown here. Stats reflect completed sessions only
              (warm-up sets excluded from volume).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
