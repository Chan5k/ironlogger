import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ExerciseIcon from '../components/ExerciseIcon.jsx';
import { appAlert } from '../lib/appDialogApi.js';

const CATEGORIES = ['chest', 'legs', 'back', 'shoulders', 'arms', 'cardio', 'core', 'other'];

export default function AdminExercises() {
  const { user } = useAuth();
  const canEdit = !!user?.isAdmin;
  const [exercises, setExercises] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?category=${filter}` : '';
      const { data } = await api.get(`/exercises${q}`);
      setExercises(data.exercises || []);
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Failed to load exercises');
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const globals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises
      .filter((ex) => ex.isGlobal)
      .filter((ex) => !q || ex.name.toLowerCase().includes(q));
  }, [exercises, search]);

  async function saveVideo() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/exercises/${editing._id}`, {
        videoUrl: editing.videoUrl ?? '',
      });
      setEditing(null);
      load();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not update demo link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        HTTPS demo URLs for built-in exercises (same as Library admin control, grouped here for convenience).
        {!canEdit ? (
          <span className="mt-1 block text-amber-200/80">
            Support accounts can view this list; only full admins can save changes.
          </span>
        ) : null}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-surface-card px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-surface-card px-3 py-2 text-sm text-white outline-none focus:border-accent sm:max-w-xs"
        />
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {globals.map((ex) => (
            <li
              key={ex._id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ExerciseIcon name={ex.name} category={ex.category} boxed className="h-5 w-5 text-slate-300" />
                <div className="min-w-0">
                  <p className="font-medium text-white">{ex.name}</p>
                  <p className="text-xs text-slate-500">{ex.category}</p>
                  {ex.videoUrl ? (
                    <p className="mt-1 truncate text-xs text-slate-400" title={ex.videoUrl}>
                      {ex.videoUrl}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600">No demo URL</p>
                  )}
                </div>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing({ ...ex })}
                  className="shrink-0 rounded-xl border border-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-800/50"
                >
                  Edit demo URL
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {globals.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">No built-in exercises match this filter.</p>
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-ex-video-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#121826] p-5 shadow-xl">
            <h2 id="admin-ex-video-title" className="text-lg font-semibold text-white">
              Demo video URL
            </h2>
            <p className="mt-1 text-xs text-slate-500">{editing.name}</p>
            <input
              type="url"
              value={editing.videoUrl ?? ''}
              onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
              placeholder="https://…"
              className="mt-4 w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-3 text-sm text-white outline-none focus:border-accent"
            />
            <p className="mt-2 text-xs text-slate-500">Must be https or empty.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => saveVideo()}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
