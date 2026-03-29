import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appConfirm } from '../lib/appDialogApi.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me, refreshUser } = useAuth();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErr('');
    try {
      const [u, w, t, a] = await Promise.all([
        api.get(`/admin/users/${userId}`),
        api.get(`/admin/users/${userId}/workouts?limit=20`),
        api.get(`/admin/users/${userId}/templates?limit=30`),
        api.get(`/admin/users/${userId}/activity?limit=30`),
      ]);
      setUser(u.data.user);
      setStats(u.data.stats);
      setWorkouts(w.data.workouts || []);
      setTemplates(t.data.templates || []);
      setActivity(a.data.logs || []);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAdmin() {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, { isAdmin: !user.isAdmin });
      setUser(data.user);
      if (String(me?.id) === String(user.id)) {
        await refreshUser();
      }
      setMsg('Admin flag updated.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!user) return;
    if (
      !(await appConfirm(
        `Permanently delete ${user.email} and all workouts, plans, activity, and custom exercises?`
      ))
    ) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.delete(`/admin/users/${userId}`);
      navigate(appPath('admin'));
    } catch (e) {
      setMsg(e.response?.data?.error || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }
  if (err || !user) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">{err || 'User not found'}</p>
        <Link to={appPath('admin')} className="text-accent-muted hover:underline">
          ← Back to users
        </Link>
      </div>
    );
  }

  const isSelf = String(userId) === String(me?.id);

  return (
    <div className="space-y-6">
      <div>
        <Link to={appPath('admin')} className="text-sm text-accent-muted hover:underline">
          ← All users
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">{user.name || '—'}</h1>
        <p className="text-sm text-slate-400">{user.email}</p>
        {user.isAdmin ? (
          <span className="mt-1 inline-block rounded bg-amber-950/60 px-2 py-0.5 text-xs text-amber-200">
            Admin
          </span>
        ) : null}
      </div>

      {msg ? (
        <p className={msg.includes('failed') || msg.includes('Cannot') ? 'text-sm text-red-400' : 'text-sm text-emerald-400'}>
          {msg}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Summary</h2>
        <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <li>Workouts: {stats?.workouts ?? 0}</li>
          <li>Plans (templates): {stats?.templates ?? 0}</li>
          <li>Activity entries: {stats?.activityEntries ?? 0}</li>
          <li>Custom exercises: {stats?.customExercises ?? 0}</li>
          <li>Joined: {fmt(user.createdAt)}</li>
          <li>Updated: {fmt(user.updatedAt)}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={toggleAdmin}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {user.isAdmin ? 'Remove admin' : 'Make admin'}
          </button>
          <button
            type="button"
            disabled={busy || isSelf}
            onClick={deleteUser}
            className="rounded-xl bg-red-950/50 px-4 py-2 text-sm text-red-200 ring-1 ring-red-900/60 disabled:opacity-40"
          >
            Delete user
          </button>
        </div>
        {isSelf ? (
          <p className="mt-2 text-xs text-slate-500">You cannot delete your own account here.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Recent workouts</h2>
        {workouts.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {workouts.map((w) => (
              <li key={w._id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 py-2 last:border-0">
                <span className="text-white">{w.title}</span>
                <span className="text-xs text-slate-500">
                  {fmt(w.startedAt)}
                  {w.completedAt ? ' · completed' : ' · open'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Plans</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {templates.map((t) => (
              <li key={t._id} className="border-b border-slate-800/80 py-2 last:border-0">
                <span className="font-medium text-white">{t.name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {t.items?.length ?? 0} exercises · {fmt(t.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Recent activity logs</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-400">
            {activity.map((log) => (
              <li key={log._id}>
                {log.dayKey} — steps {log.steps}, kcal {log.activeCalories}, min {log.exerciseMinutes}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
