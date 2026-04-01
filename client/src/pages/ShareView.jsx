import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import { appAlert } from '../lib/appDialogApi.js';
import ExerciseIcon from '../components/ExerciseIcon.jsx';

export default function ShareView() {
  const { token } = useParams();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr('');
    setData(null);
    (async () => {
      try {
        const { data: d } = await api.get(`/public/share/${encodeURIComponent(token || '')}`);
        if (alive) setData(d);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.status === 404 ? 'This share link is invalid or was removed.' : 'Could not load share.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function saveWorkout() {
    if (!token) return;
    setBusy(true);
    try {
      const { data: d } = await api.post('/share/import-workout', { token });
      navigate(appPath(`workouts/${d.workout._id}`), { replace: true });
    } catch (e) {
      await appAlert(e?.response?.data?.error || 'Could not save workout');
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    if (!token) return;
    setBusy(true);
    try {
      const { data: d } = await api.post('/share/import-template', { token });
      navigate(appPath(`templates/${d.template._id}`), { replace: true });
    } catch (e) {
      await appAlert(e?.response?.data?.error || 'Could not save plan');
    } finally {
      setBusy(false);
    }
  }

  const snap = data?.snapshot;

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-lg space-y-6">
        <Link
          to="/"
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white"
        >
          ← IronLog home
        </Link>

        {err ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-6">
            <p className="text-slate-300">{err}</p>
          </div>
        ) : null}

        {!err && !data ? <p className="text-slate-500">Loading…</p> : null}

        {data?.kind === 'workout' && snap ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-muted">Shared workout</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{snap.title}</h1>
            {snap.notes ? <p className="mt-2 text-sm text-slate-400">{snap.notes}</p> : null}
            <p className="mt-4 text-sm text-slate-500">
              {(snap.exercises || []).length} exercise{(snap.exercises || []).length !== 1 ? 's' : ''} · sets
              included (not marked done)
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">
              {(snap.exercises || []).map((ex, i) => (
                <li key={i} className="flex items-center gap-2">
                  <ExerciseIcon name={ex.name} category={ex.category} className="h-4 w-4 shrink-0 text-slate-500" />
                  <span>
                    {ex.name}{' '}
                    <span className="text-slate-600">({ex.category})</span>
                  </span>
                </li>
              ))}
            </ul>
            {loading ? null : isAuthenticated ? (
              <button
                type="button"
                disabled={busy}
                onClick={saveWorkout}
                className="mt-6 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save to my workouts'}
              </button>
            ) : (
              <Link
                to="/login"
                state={{ from: `/share/${token}` }}
                className="mt-6 block w-full rounded-xl bg-accent py-3 text-center font-semibold text-white"
              >
                Log in to save this workout
              </Link>
            )}
          </div>
        ) : null}

        {data?.kind === 'template' && snap ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-muted">Shared plan</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{snap.name}</h1>
            {snap.description ? <p className="mt-2 text-sm text-slate-400">{snap.description}</p> : null}
            <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
              {(snap.items || []).map((it, i) => (
                <li key={i} className="border-b border-slate-200/80 dark:border-slate-800/80 pb-2 text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{it.exerciseName}</span>
                  <span className="text-slate-600"> · {it.category}</span>
                  <span className="block text-xs text-slate-500">
                    {it.defaultSets}×{it.defaultReps} @ {it.defaultWeight} kg template defaults
                  </span>
                </li>
              ))}
            </ul>
            {loading ? null : isAuthenticated ? (
              <button
                type="button"
                disabled={busy}
                onClick={savePlan}
                className="mt-6 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save to my plans'}
              </button>
            ) : (
              <Link
                to="/login"
                state={{ from: `/share/${token}` }}
                className="mt-6 block w-full rounded-xl bg-accent py-3 text-center font-semibold text-white"
              >
                Log in to save this plan
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
