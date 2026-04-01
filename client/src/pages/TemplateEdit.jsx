import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import { appAlert } from '../lib/appDialogApi.js';
import {
  filterExercisesByQuery,
  groupExercisesByCategory,
} from '../utils/exercisePickerFilter.js';
import ExerciseIcon from '../components/ExerciseIcon.jsx';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { formatWeightInputValue, parseWeightInput } from '../utils/weightUnits.js';

export default function TemplateEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatePickerQuery, setTemplatePickerQuery] = useState('');
  const templatePickerInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/exercises');
      setLibrary(data.exercises || []);
    })();
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    setTemplatePickerQuery('');
    const id = requestAnimationFrame(() => templatePickerInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [pickerOpen]);

  const weightUnit = useWeightUnit();

  const categoryByExerciseId = useMemo(() => {
    const m = new Map();
    for (const ex of library) {
      if (ex._id) m.set(String(ex._id), ex.category || 'other');
    }
    return m;
  }, [library]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/templates/${id}`);
        if (!alive) return;
        const t = data.template;
        setName(t.name);
        setDescription(t.description || '');
        setItems(
          (t.items || []).map((i) => ({
            exerciseId: i.exerciseId,
            exerciseName: i.exerciseName,
            defaultSets: i.defaultSets,
            defaultReps: i.defaultReps,
            defaultWeight: i.defaultWeight,
            itemNotes: i.itemNotes || '',
          }))
        );
      } catch {
        navigate(appPath('templates'), { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isNew, navigate]);

  function addFromLibrary(ex) {
    setItems((prev) => [
      ...prev,
      {
        exerciseId: ex._id,
        exerciseName: ex.name,
        defaultSets: 3,
        defaultReps: 0,
        defaultWeight: 0,
        itemNotes: '',
      },
    ]);
    setPickerOpen(false);
  }

  function updateItem(idx, field, value) {
    setItems((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: value };
      return n;
    });
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim() || items.length === 0) {
      await appAlert('Add a name and at least one exercise.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description,
        items: items.map((i) => {
          const sets = Number(i.defaultSets);
          const reps = Number(i.defaultReps);
          const w = Number(i.defaultWeight);
          return {
            exerciseId: i.exerciseId,
            defaultSets: Number.isFinite(sets) && sets >= 1 ? Math.floor(sets) : 3,
            defaultReps: Number.isFinite(reps) && reps >= 0 ? Math.floor(reps) : 0,
            defaultWeight: Number.isFinite(w) && w >= 0 ? w : 0,
            itemNotes: i.itemNotes,
          };
        }),
      };
      if (isNew) {
        await api.post('/templates', body);
      } else {
        await api.put(`/templates/${id}`, body);
      }
      navigate(appPath('templates'));
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function sharePlanLink() {
    if (isNew || !id) return;
    try {
      const { data } = await api.post(`/share/templates/${id}`);
      const url = sharePageUrl(data.token);
      await offerShareLink(url, {
        shareTitle: 'Workout plan',
        successMessage:
          'Share link copied. Anyone with the link can preview; logging in lets them save a copy to their plans.',
      });
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not create share link');
    }
  }

  const filteredTemplatePicker = useMemo(
    () => filterExercisesByQuery(library, templatePickerQuery),
    [library, templatePickerQuery]
  );
  const groupedTemplatePicker = useMemo(
    () => groupExercisesByCategory(filteredTemplatePicker),
    [filteredTemplatePicker]
  );

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      <Link
        to={appPath('templates')}
        className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white active:bg-slate-800"
      >
        ← Back to plans
      </Link>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Plan name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3 text-slate-900 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3 text-slate-900 dark:text-white"
        />
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-3 text-sm text-accent-muted"
      >
        + Add exercise from library
      </button>

      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li
            key={`${item.exerciseId}-${idx}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-card p-3"
          >
            <div className="mb-2 flex justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-900 dark:text-white">
                <ExerciseIcon
                  name={item.exerciseName}
                  category={categoryByExerciseId.get(String(item.exerciseId)) || 'other'}
                  boxed
                  className="h-4 w-4 text-slate-300"
                />
                <span className="truncate">{item.exerciseName}</span>
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-red-400"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <label className="text-xs text-slate-500">Sets</label>
                <input
                  type="number"
                  value={item.defaultSets}
                  onChange={(e) => updateItem(idx, 'defaultSets', e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-surface px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Reps</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={item.defaultReps}
                  onChange={(e) => updateItem(idx, 'defaultReps', e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-surface px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Weight ({weightUnit})</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={formatWeightInputValue(item.defaultWeight, weightUnit)}
                  onChange={(e) =>
                    updateItem(idx, 'defaultWeight', parseWeightInput(e.target.value, weightUnit))
                  }
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-surface px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {!isNew ? (
          <button
            type="button"
            onClick={sharePlanLink}
            disabled={saving}
            className="rounded-xl border border-slate-300 dark:border-slate-600 py-3 font-medium text-slate-200 disabled:opacity-50 sm:shrink-0 sm:px-6"
          >
            Share link
          </button>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full flex-1 rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : isNew ? 'Create plan' : 'Save plan'}
        </button>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 dark:bg-black/60 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-surface-card">
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <div className="mb-3 flex justify-between">
                <span className="font-medium text-slate-900 dark:text-white">Pick exercise</span>
                <button type="button" onClick={() => setPickerOpen(false)} className="text-slate-400">
                  Close
                </button>
              </div>
              <label className="sr-only" htmlFor="template-exercise-search">
                Search exercises
              </label>
              <input
                id="template-exercise-search"
                ref={templatePickerInputRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder="Type to filter by name or category…"
                value={templatePickerQuery}
                onChange={(e) => setTemplatePickerQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 outline-none focus:border-accent"
              />
              {templatePickerQuery.trim() ? (
                <p className="mt-2 text-xs text-slate-500">
                  {filteredTemplatePicker.length} match
                  {filteredTemplatePicker.length !== 1 ? 'es' : ''}
                </p>
              ) : null}
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2 sm:max-h-[60vh]">
              {filteredTemplatePicker.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  No exercises match “{templatePickerQuery.trim()}”. Try fewer words or a category
                  like chest or legs.
                </p>
              ) : (
                Object.entries(groupedTemplatePicker)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, list]) => (
                    <div key={cat} className="mb-3">
                      <p className="px-2 text-xs font-semibold uppercase text-slate-500">{cat}</p>
                      {list.map((ex) => (
                        <button
                          key={ex._id}
                          type="button"
                          onClick={() => addFromLibrary(ex)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-900 dark:text-white hover:bg-surface-elevated"
                        >
                          <ExerciseIcon name={ex.name} category={ex.category} className="h-4 w-4 text-slate-500" />
                          <span>{ex.name}</span>
                        </button>
                      ))}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
