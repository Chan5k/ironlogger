import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ExerciseVideoModal from '../components/ExerciseVideoModal.jsx';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';

const CATEGORIES = [
  'chest',
  'legs',
  'back',
  'shoulders',
  'arms',
  'cardio',
  'core',
  'other',
];

export default function Library() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [exercises, setExercises] = useState([]);
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('chest');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adminVideo, setAdminVideo] = useState(null);
  const [videoModal, setVideoModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [demosOnly, setDemosOnly] = useState(false);

  async function load() {
    const q = filter ? `?category=${filter}` : '';
    const { data } = await api.get(`/exercises${q}`);
    setExercises(data.exercises || []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function addCustom(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name, category };
      const v = newVideoUrl.trim();
      if (v) body.videoUrl = v;
      await api.post('/exercises', body);
      setName('');
      setNewVideoUrl('');
      load();
    } catch (err) {
      await appAlert(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Could not add exercise');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/exercises/${editing._id}`, {
        name: editing.name,
        category: editing.category,
        notes: editing.notes ?? '',
        videoUrl: editing.videoUrl ?? '',
      });
      setEditing(null);
      load();
    } catch (err) {
      await appAlert(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveAdminVideo() {
    if (!adminVideo) return;
    setBusy(true);
    try {
      await api.patch(`/exercises/${adminVideo._id}`, {
        videoUrl: adminVideo.videoUrl ?? '',
      });
      setAdminVideo(null);
      load();
    } catch (err) {
      await appAlert(err.response?.data?.error || 'Could not update demo link');
    } finally {
      setBusy(false);
    }
  }

  async function remove(ex) {
    if (!ex.userId) {
      await appAlert('Built-in exercises cannot be deleted.');
      return;
    }
    if (!(await appConfirm('Delete this custom exercise?'))) return;
    await api.delete(`/exercises/${ex._id}`);
    load();
  }

  const filteredExercises = useMemo(() => {
    let list = exercises;
    if (demosOnly) {
      list = list.filter((ex) => String(ex.videoUrl || '').trim());
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((ex) => ex.name.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, demosOnly, searchQuery]);

  const grouped = useMemo(() => {
    return filteredExercises.reduce((acc, ex) => {
      acc[ex.category] = acc[ex.category] || [];
      acc[ex.category].push(ex);
      return acc;
    }, {});
  }, [filteredExercises]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Exercise library</h1>
        <p className="text-sm text-slate-400">
          Browse by category or add your own. Use the search field and the “With demo” filter to find exercises that include a technique video.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('')}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === '' ? 'bg-accent text-white' : 'bg-surface-card text-slate-400'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${
                filter === c ? 'bg-accent text-white' : 'bg-surface-card text-slate-400'
              }`}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDemosOnly((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs ${
              demosOnly ? 'bg-emerald-700 text-white' : 'bg-surface-card text-slate-400'
            }`}
          >
            With demo
          </button>
        </div>
        <div>
          <label className="sr-only" htmlFor="lib-search">
            Search exercises by name
          </label>
          <input
            id="lib-search"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search by exercise name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            {demosOnly || searchQuery.trim()
              ? `Showing ${filteredExercises.length} of ${exercises.length} loaded in this category`
              : `${exercises.length} exercises in this view`}
            {demosOnly ? ' · demo filter on' : ''}
          </p>
        </div>
      </div>

      <form onSubmit={addCustom} className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <p className="mb-2 text-sm font-medium text-white">Add custom exercise</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="flex-1 rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Add
            </button>
          </div>
          <label className="text-xs text-slate-500" htmlFor="lib-new-video">
            Demo video URL (optional, https)
          </label>
          <input
            id="lib-new-video"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </form>

      <div className="space-y-6">
        {filteredExercises.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-surface-card px-4 py-8 text-center text-sm text-slate-400">
            {exercises.length === 0
              ? 'No exercises in this category.'
              : demosOnly
                ? 'No exercises with a technique video match your search. Turn off “With demo” or clear the search.'
                : 'No exercises match your search.'}
          </p>
        ) : null}
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, list]) => (
            <div key={cat}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {cat}
              </h2>
              <ul className="space-y-2">
                {list.map((ex) => (
                  <li
                    key={ex._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-surface-elevated px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{ex.name}</p>
                      {!ex.userId ? (
                        <span className="text-xs text-slate-500">Built-in</span>
                      ) : (
                        <span className="text-xs text-accent-muted">Yours</span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {ex.videoUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setVideoModal({ title: ex.name, videoUrl: ex.videoUrl })
                          }
                          className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-accent-muted hover:bg-slate-800"
                        >
                          Demo
                        </button>
                      ) : null}
                      {ex.userId ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                ...ex,
                                notes: ex.notes ?? '',
                                videoUrl: ex.videoUrl ?? '',
                              })
                            }
                            className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(ex)}
                            className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
                          >
                            Delete
                          </button>
                        </>
                      ) : isAdmin ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAdminVideo({
                              _id: ex._id,
                              name: ex.name,
                              videoUrl: ex.videoUrl ?? '',
                            })
                          }
                          className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          {ex.videoUrl ? 'Edit demo' : 'Set demo'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-surface-card p-4 shadow-xl">
            <h3 className="mb-3 font-semibold text-white">Edit exercise</h3>
            <label className="mb-1 block text-xs text-slate-500">Name</label>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="mb-3 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
            />
            <label className="mb-1 block text-xs text-slate-500">Category</label>
            <select
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              className="mb-3 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs text-slate-500">Notes (optional)</label>
            <textarea
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              rows={2}
              className="mb-3 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
            />
            <label className="mb-1 block text-xs text-slate-500">Demo video URL (https, optional)</label>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={editing.videoUrl}
              onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
              placeholder="https://…"
              className="mb-3 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                className="flex-1 rounded-xl bg-accent py-2 font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminVideo ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-surface-card p-4 shadow-xl">
            <h3 className="mb-1 font-semibold text-white">Built-in demo video</h3>
            <p className="mb-3 text-xs text-slate-500">{adminVideo.name}</p>
            <label className="mb-1 block text-xs text-slate-500">HTTPS YouTube or Vimeo URL</label>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={adminVideo.videoUrl}
              onChange={(e) => setAdminVideo({ ...adminVideo, videoUrl: e.target.value })}
              placeholder="Leave empty to clear"
              className="mb-3 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveAdminVideo}
                disabled={busy}
                className="flex-1 rounded-xl bg-accent py-2 font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setAdminVideo(null)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {videoModal ? (
        <ExerciseVideoModal
          title={videoModal.title}
          videoUrl={videoModal.videoUrl}
          onClose={() => setVideoModal(null)}
        />
      ) : null}
    </div>
  );
}
