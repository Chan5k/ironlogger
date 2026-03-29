import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { LBS_PER_KG, formatWeightInputValue, lbsToKg } from '../utils/weightUnits.js';

const CARD_MUTED = 'rounded-xl border border-slate-800/80 bg-[#0f141d]/90 p-5';

const TYPE_LABEL = {
  strength: 'Strength',
  frequency: 'Frequency',
  volume: 'Volume',
};

function scaleVolDisplay(kgReps, weightUnit) {
  return weightUnit === 'lbs' ? Math.round(kgReps * LBS_PER_KG) : Math.round(kgReps);
}

function goalDetailLine(g, weightUnit) {
  if (g.type === 'strength') {
    return `Target max: ${formatWeightInputValue(g.targetValue, weightUnit)} ${weightUnit} · ${
      g.strengthExerciseName || 'Exercise'
    }`;
  }
  if (g.type === 'frequency') {
    return `Target: ${g.targetValue} workout${g.targetValue !== 1 ? 's' : ''} / rolling 7 days`;
  }
  return `Target volume: ${scaleVolDisplay(g.targetValue, weightUnit).toLocaleString()} (${weightUnit}×reps, rolling 7d)`;
}

function currentLine(g, weightUnit) {
  if (g.isCompleted) return 'Completed';
  if (g.type === 'strength') {
    return `Current best: ${formatWeightInputValue(g.currentValue, weightUnit)} ${weightUnit}`;
  }
  if (g.type === 'frequency') {
    return `This week: ${g.currentValue} session${g.currentValue !== 1 ? 's' : ''}`;
  }
  return `This week: ${scaleVolDisplay(g.currentValue, weightUnit).toLocaleString()} ${weightUnit}×reps`;
}

export default function Goals() {
  const weightUnit = useWeightUnit();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    type: 'frequency',
    title: '',
    targetValue: '',
    strengthExerciseName: '',
    deadline: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr('');
    try {
      const { data } = await api.get('/goals');
      setGoals(data.goals || []);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addGoal(e) {
    e.preventDefault();
    const tv = Number(form.targetValue);
    if (!form.title.trim() || !Number.isFinite(tv) || tv <= 0) {
      await appAlert('Add a title and a positive target.');
      return;
    }
    let targetPayload = tv;
    if (form.type === 'strength') {
      targetPayload = weightUnit === 'lbs' ? lbsToKg(tv) : tv;
    } else if (form.type === 'volume') {
      targetPayload = weightUnit === 'lbs' ? tv / LBS_PER_KG : tv;
    }
    setSaving(true);
    try {
      await api.post('/goals', {
        type: form.type,
        title: form.title.trim(),
        targetValue: targetPayload,
        strengthExerciseName: form.type === 'strength' ? form.strengthExerciseName.trim() : undefined,
        deadline: form.deadline.trim()
          ? `${form.deadline.trim()}T12:00:00.000Z`
          : undefined,
      });
      setForm({
        type: 'frequency',
        title: '',
        targetValue: '',
        strengthExerciseName: '',
        deadline: '',
      });
      await load();
    } catch (err0) {
      await appAlert(err0.response?.data?.error || 'Could not create goal');
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(id) {
    if (!(await appConfirm('Remove this goal?'))) return;
    try {
      await api.delete(`/goals/${id}`);
      await load();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not delete');
    }
  }

  async function reopenGoal(id) {
    try {
      await api.patch(`/goals/${id}`, { completedAt: null });
      await load();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not update');
    }
  }

  const active = goals.filter((g) => !g.completedAt);
  const done = goals.filter((g) => !!g.completedAt);

  if (loading) {
    return <p className="text-slate-500">Loading goals…</p>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Goals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Strength, weekly frequency, and rolling 7-day volume — progress updates from your logs.
          </p>
        </div>
        <Link to={appPath()} className="text-sm text-slate-500 hover:text-white">
          ← Home
        </Link>
      </div>

      {err ? (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {err}
        </p>
      ) : null}

      <section className={CARD_MUTED} aria-label="New goal">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">New goal</p>
        <form onSubmit={addGoal} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="goal-type">
              Type
            </label>
            <select
              id="goal-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="h-11 w-full rounded-xl border border-slate-700 bg-surface px-3 text-white"
            >
              <option value="frequency">Frequency (workouts / 7 days)</option>
              <option value="volume">Volume ({weightUnit}×reps / 7 days)</option>
              <option value="strength">Strength (max weight on one lift)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="goal-title">
              Title
            </label>
            <input
              id="goal-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bench 100kg, 4 sessions/week"
              className="h-11 w-full rounded-xl border border-slate-700 bg-surface px-3 text-white placeholder:text-slate-600"
            />
          </div>
          {form.type === 'strength' ? (
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="goal-ex-name">
                Exercise name (must match your log)
              </label>
              <input
                id="goal-ex-name"
                value={form.strengthExerciseName}
                onChange={(e) => setForm((f) => ({ ...f, strengthExerciseName: e.target.value }))}
                placeholder="Bench press"
                className="h-11 w-full rounded-xl border border-slate-700 bg-surface px-3 text-white placeholder:text-slate-600"
              />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="goal-target">
                Target value
              </label>
              <input
                id="goal-target"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                placeholder={form.type === 'frequency' ? '4' : form.type === 'volume' ? '50000' : '100'}
                className="h-11 w-full rounded-xl border border-slate-700 bg-surface px-3 text-white placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="goal-deadline">
                Deadline (optional)
              </label>
              <input
                id="goal-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-700 bg-surface px-3 text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add goal'}
          </button>
        </form>
      </section>

      <section className="space-y-3" aria-label="Active goals">
        <h2 className="text-sm font-semibold text-slate-300">In progress</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-600">No active goals — add one above.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((g) => (
              <li key={g._id} className={CARD_MUTED}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                      <Target className="h-5 w-5 text-blue-400" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {TYPE_LABEL[g.type] || g.type}
                      </p>
                      <p className="mt-1 font-medium text-white">{g.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{goalDetailLine(g, weightUnit)}</p>
                      <p className="mt-2 text-sm text-slate-400">{currentLine(g, weightUnit)}</p>
                      {g.deadline ? (
                        <p className={`mt-1 text-xs ${g.isOverdue ? 'text-rose-400' : 'text-slate-600'}`}>
                          Deadline {new Date(g.deadline).toLocaleDateString()}
                          {g.isOverdue ? ' · overdue' : ''}
                        </p>
                      ) : null}
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            g.isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, g.progressPct ?? 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                        {Math.min(100, Math.round(g.progressPct ?? 0))}% complete
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGoal(g._id)}
                    className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length ? (
        <section className="space-y-3" aria-label="Completed goals">
          <h2 className="text-sm font-semibold text-slate-300">Completed</h2>
          <ul className="space-y-2">
            {done.map((g) => (
              <li
                key={g._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-emerald-100">{g.title}</p>
                  <p className="text-xs text-emerald-200/70">
                    Done {g.completedAt ? new Date(g.completedAt).toLocaleDateString() : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => reopenGoal(g._id)}
                  className="text-xs text-slate-500 hover:text-white"
                >
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
