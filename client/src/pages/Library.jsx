import { useEffect, useState } from 'react';
import api from '../api/client.js';

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
  const [exercises, setExercises] = useState([]);
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('chest');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

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
      await api.post('/exercises', { name, category });
      setName('');
      load();
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
        notes: editing.notes,
      });
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(ex) {
    if (!ex.userId) {
      alert('Built-in exercises cannot be deleted.');
      return;
    }
    if (!confirm('Delete this custom exercise?')) return;
    await api.delete(`/exercises/${ex._id}`);
    load();
  }

  const grouped = exercises.reduce((acc, ex) => {
    acc[ex.category] = acc[ex.category] || [];
    acc[ex.category].push(ex);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Exercise library</h1>
        <p className="text-sm text-slate-400">Browse by category or add your own</p>
      </div>

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
      </div>

      <form onSubmit={addCustom} className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <p className="mb-2 text-sm font-medium text-white">Add custom exercise</p>
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
      </form>

      <div className="space-y-6">
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
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-surface-elevated px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-white">{ex.name}</p>
                      {!ex.userId ? (
                        <span className="text-xs text-slate-500">Built-in</span>
                      ) : (
                        <span className="text-xs text-accent-muted">Yours</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {ex.userId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing({ ...ex })}
                            className="text-xs text-slate-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(ex)}
                            className="text-xs text-red-400"
                          >
                            Delete
                          </button>
                        </>
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
    </div>
  );
}
