import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appConfirm, appPrompt } from '../lib/appDialogApi.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

const PAGE_LIMIT = 20;

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me, refreshUser, setToken } = useAuth();
  const meIsFullAdmin = !!me?.isAdmin;
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [workoutTotal, setWorkoutTotal] = useState(0);
  const [workoutSkip, setWorkoutSkip] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templateSkip, setTemplateSkip] = useState(0);
  const [activity, setActivity] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activitySkip, setActivitySkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  const uid = user?._id || user?.id;

  const loadCore = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErr('');
    setWorkoutSkip(0);
    setTemplateSkip(0);
    setActivitySkip(0);
    try {
      const [u, w, t, a] = await Promise.all([
        api.get(`/admin/users/${userId}`),
        api.get(`/admin/users/${userId}/workouts?limit=${PAGE_LIMIT}&skip=0`),
        api.get(`/admin/users/${userId}/templates?limit=${PAGE_LIMIT}&skip=0`),
        api.get(`/admin/users/${userId}/activity?limit=${PAGE_LIMIT}&skip=0`),
      ]);
      setUser(u.data.user);
      setNotesDraft(u.data.user?.adminNotes ?? '');
      setStats(u.data.stats);
      setWorkouts(w.data.workouts || []);
      setWorkoutTotal(w.data.total ?? 0);
      setWorkoutSkip(w.data.workouts?.length ?? 0);
      setTemplates(t.data.templates || []);
      setTemplateTotal(t.data.total ?? t.data.templates?.length ?? 0);
      setTemplateSkip(t.data.templates?.length ?? 0);
      setActivity(a.data.logs || []);
      setActivityTotal(a.data.total ?? a.data.logs?.length ?? 0);
      setActivitySkip(a.data.logs?.length ?? 0);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  async function loadMoreWorkouts() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const { data } = await api.get(
        `/admin/users/${userId}/workouts?limit=${PAGE_LIMIT}&skip=${workoutSkip}`
      );
      const next = data.workouts || [];
      setWorkouts((prev) => [...prev, ...next]);
      setWorkoutSkip((s) => s + next.length);
      setWorkoutTotal(data.total ?? workoutTotal);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to load workouts');
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreTemplates() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const { data } = await api.get(
        `/admin/users/${userId}/templates?limit=${PAGE_LIMIT}&skip=${templateSkip}`
      );
      const next = data.templates || [];
      setTemplates((prev) => [...prev, ...next]);
      setTemplateSkip((s) => s + next.length);
      setTemplateTotal(data.total ?? templateTotal);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to load plans');
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreActivity() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const { data } = await api.get(
        `/admin/users/${userId}/activity?limit=${PAGE_LIMIT}&skip=${activitySkip}`
      );
      const next = data.logs || [];
      setActivity((prev) => [...prev, ...next]);
      setActivitySkip((s) => s + next.length);
      setActivityTotal(data.total ?? activityTotal);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to load activity');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin() {
    if (!user || !meIsFullAdmin) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, { isAdmin: !user.isAdmin });
      setUser(data.user);
      setNotesDraft(data.user?.adminNotes ?? notesDraft);
      if (String(me?.id) === String(uid)) {
        await refreshUser();
      }
      setMsg('Admin flag updated.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSupport() {
    if (!user || !meIsFullAdmin || isSelf) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, { isSupport: !user.isSupport });
      setUser(data.user);
      setNotesDraft(data.user?.adminNotes ?? notesDraft);
      setMsg('Support access updated.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!userId || !meIsFullAdmin) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, { adminNotes: notesDraft });
      setUser(data.user);
      setNotesDraft(data.user?.adminNotes ?? '');
      setMsg('Notes saved.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not save notes');
    } finally {
      setBusy(false);
    }
  }

  async function startImpersonation() {
    if (!uid || !meIsFullAdmin) return;
    if (!(await appConfirm(`Sign in as ${user.email}? You will use their account until you exit.`))) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.post('/auth/impersonate', { userId: uid });
      setToken(data.token, data.user);
      navigate(appPath());
    } catch (e) {
      setMsg(e.response?.data?.error || 'Impersonation failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!user || !meIsFullAdmin) return;
    if (
      !(await appConfirm(
        `Permanently delete ${user.email} and all workouts, plans, activity, and custom exercises?`
      ))
    ) {
      return;
    }
    const typed = await appPrompt({
      title: 'Confirm email',
      message: `Type this user’s email exactly to confirm deletion:\n${user.email}`,
      placeholder: user.email,
      confirmLabel: 'Delete account',
    });
    if (typed == null) return;
    if (typed.toLowerCase() !== user.email.toLowerCase()) {
      setMsg('Email did not match. Delete cancelled.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.delete(`/admin/users/${userId}`, { data: { confirmEmail: typed } });
      navigate(appPath('admin/users'));
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
        <Link
          to={appPath('admin/users')}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center rounded-xl px-3 py-2 text-accent-muted transition-colors hover:bg-slate-800/60 hover:underline"
        >
          ← Back to users
        </Link>
      </div>
    );
  }

  const isSelf = String(userId) === String(me?.id);
  const publicSlug = user.publicProfileSlug?.trim();
  const showPublicLink = user.publicProfileEnabled && publicSlug;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={appPath('admin/users')}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center rounded-xl px-3 py-2 text-sm text-accent-muted transition-colors hover:bg-slate-800/60 hover:underline"
        >
          ← All users
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">{user.name || '—'}</h1>
        <p className="text-sm text-slate-400">{user.email}</p>
        {user.isAdmin ? (
          <span className="mt-1 inline-block rounded bg-amber-950/60 px-2 py-0.5 text-xs text-amber-200">
            Admin
          </span>
        ) : null}
        {user.isSupport ? (
          <span className="mt-1 ml-2 inline-block rounded bg-slate-700/80 px-2 py-0.5 text-xs text-slate-200">
            Support
          </span>
        ) : null}
        {showPublicLink ? (
          <p className="mt-2 text-sm">
            <Link
              to={`/u/${publicSlug}`}
              className="text-accent-muted hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open public profile /u/{publicSlug} ↗
            </Link>
          </p>
        ) : null}
      </div>

      {msg ? (
        <p
          className={
            msg.includes('failed') || msg.includes('Cannot') || msg.includes('cancelled')
              ? 'text-sm text-red-400'
              : 'text-sm text-emerald-400'
          }
        >
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
          <li>Last login: {fmt(user.lastLoginAt)}</li>
          <li>Joined: {fmt(user.createdAt)}</li>
          <li>Updated: {fmt(user.updatedAt)}</li>
        </ul>

        <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-4">
          <h3 className="text-sm font-medium text-slate-300">Internal notes</h3>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!meIsFullAdmin || busy}
            rows={4}
            className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent disabled:opacity-50"
            placeholder={meIsFullAdmin ? 'Visible to admin staff…' : 'Only full admins can edit notes.'}
          />
          {meIsFullAdmin ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => saveNotes()}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save notes
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
          {meIsFullAdmin ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleAdmin()}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {user.isAdmin ? 'Remove admin' : 'Make admin'}
              </button>
              <button
                type="button"
                disabled={busy || isSelf}
                onClick={() => toggleSupport()}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
              >
                {user.isSupport ? 'Remove support (read-only)' : 'Grant support (read-only)'}
              </button>
              <button
                type="button"
                disabled={busy || isSelf}
                onClick={() => startImpersonation()}
                className="rounded-xl border border-violet-600/60 bg-violet-950/30 px-4 py-2 text-sm text-violet-100 disabled:opacity-40"
              >
                View as this user
              </button>
              <button
                type="button"
                disabled={busy || isSelf}
                onClick={() => deleteUser()}
                className="rounded-xl bg-red-950/50 px-4 py-2 text-sm text-red-200 ring-1 ring-red-900/60 disabled:opacity-40"
              >
                Delete user
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Support access is read-only. Ask a full admin to change roles, notes, or delete accounts.
            </p>
          )}
        </div>
        {isSelf ? (
          <p className="mt-2 text-xs text-slate-500">You cannot impersonate or delete your own account here.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Workouts</h2>
        {workouts.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {workouts.map((w) => (
              <li
                key={w._id}
                className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 py-2 last:border-0"
              >
                <span className="text-white">{w.title}</span>
                <span className="text-xs text-slate-500">
                  {fmt(w.startedAt)}
                  {w.completedAt ? ' · completed' : ' · open'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {workouts.length < workoutTotal ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => loadMoreWorkouts()}
            className="mt-3 text-sm text-accent-muted hover:underline disabled:opacity-50"
          >
            Load more ({workouts.length} / {workoutTotal})
          </button>
        ) : null}
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
        {templates.length < templateTotal ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => loadMoreTemplates()}
            className="mt-3 text-sm text-accent-muted hover:underline disabled:opacity-50"
          >
            Load more ({templates.length} / {templateTotal})
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-3 font-semibold text-white">Activity logs</h2>
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
        {activity.length < activityTotal ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => loadMoreActivity()}
            className="mt-3 text-sm text-accent-muted hover:underline disabled:opacity-50"
          >
            Load more ({activity.length} / {activityTotal})
          </button>
        ) : null}
      </section>
    </div>
  );
}
