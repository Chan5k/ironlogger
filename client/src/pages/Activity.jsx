import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../api/client.js';

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [dayKey, setDayKey] = useState(todayKey);
  const [steps, setSteps] = useState(0);
  const [activeCalories, setActiveCalories] = useState(0);
  const [exerciseMinutes, setExerciseMinutes] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get('/activity');
    setLogs(data.logs || []);
    const today = data.logs?.find((l) => l.dayKey === dayKey);
    if (today) {
      setSteps(today.steps);
      setActiveCalories(today.activeCalories);
      setExerciseMinutes(today.exerciseMinutes);
      setNote(today.note || '');
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const log = logs.find((l) => l.dayKey === dayKey);
    if (log) {
      setSteps(log.steps);
      setActiveCalories(log.activeCalories);
      setExerciseMinutes(log.exerciseMinutes);
      setNote(log.note || '');
    } else {
      setSteps(0);
      setActiveCalories(0);
      setExerciseMinutes(0);
      setNote('');
    }
  }, [dayKey, logs]);

  async function saveDay() {
    setSaving(true);
    try {
      await api.put(`/activity/${dayKey}`, {
        steps: Number(steps) || 0,
        activeCalories: Number(activeCalories) || 0,
        exerciseMinutes: Number(exerciseMinutes) || 0,
        note,
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  const chartData = [...logs]
    .reverse()
    .slice(-14)
    .map((l) => ({
      day: l.dayKey.slice(5),
      steps: l.steps,
      kcal: Math.round(l.activeCalories),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Activity</h1>
        <p className="text-sm text-slate-400">
          Manual steps, calories, and exercise minutes.{' '}
          <span className="text-slate-500">
            HealthKit is not available to websites—only native iOS apps can read Apple Health. Use
            this screen to copy totals from the Health app if you want them here.
          </span>
        </p>
      </div>

      <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-200/90">
        <strong className="text-amber-100">Optional native integration:</strong> To sync HealthKit
        automatically you would wrap this site in a small Swift/React Native shell that uses
        HealthKit APIs and posts to the same backend—out of scope for pure Safari.
      </div>

      <div className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <label className="mb-1 block text-xs text-slate-500">Date</label>
        <input
          type="date"
          value={dayKey}
          onChange={(e) => setDayKey(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">Steps</label>
            <input
              type="number"
              inputMode="numeric"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-surface px-2 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Active kcal</label>
            <input
              type="number"
              inputMode="decimal"
              value={activeCalories}
              onChange={(e) => setActiveCalories(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-surface px-2 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Exercise min</label>
            <input
              type="number"
              inputMode="decimal"
              value={exerciseMinutes}
              onChange={(e) => setExerciseMinutes(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-surface px-2 py-2 text-white"
            />
          </div>
        </div>

        <label className="mb-1 mt-3 block text-xs text-slate-500">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
        />

        <button
          type="button"
          onClick={saveDay}
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save day'}
        </button>
      </div>

      {chartData.length > 0 ? (
        <div className="h-56 rounded-2xl border border-slate-800 bg-surface-card p-2">
          <p className="mb-1 px-2 text-xs text-slate-500">Last ~14 days — steps</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="steps" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
