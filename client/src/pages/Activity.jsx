import { useEffect, useMemo, useState } from 'react';
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
import { appAlert } from '../lib/appDialogApi.js';

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

  const [syncMeta, setSyncMeta] = useState({ configured: false, createdAt: null });
  const [newSyncToken, setNewSyncToken] = useState('');
  const [syncActionLoading, setSyncActionLoading] = useState(false);

  const importUrl = useMemo(() => {
    const env = import.meta.env.VITE_API_URL;
    if (env && String(env).trim()) {
      return `${String(env).replace(/\/$/, '')}/api/activity/import`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/activity/import`;
    }
    return '/api/activity/import';
  }, []);

  const currentLog = logs.find((l) => l.dayKey === dayKey);

  async function refreshSyncMeta() {
    try {
      const { data } = await api.get('/auth/activity-sync-token');
      setSyncMeta({
        configured: !!data.configured,
        createdAt: data.createdAt || null,
      });
    } catch {
      setSyncMeta({ configured: false, createdAt: null });
    }
  }

  async function createSyncToken() {
    setSyncActionLoading(true);
    setNewSyncToken('');
    try {
      const { data } = await api.post('/auth/activity-sync-token');
      if (data.token) setNewSyncToken(data.token);
      await refreshSyncMeta();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not create token.');
    } finally {
      setSyncActionLoading(false);
    }
  }

  async function revokeSyncToken() {
    setSyncActionLoading(true);
    try {
      await api.delete('/auth/activity-sync-token');
      setNewSyncToken('');
      await refreshSyncMeta();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not revoke token.');
    } finally {
      setSyncActionLoading(false);
    }
  }

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
    refreshSyncMeta();
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

  const fieldClass =
    'w-full min-w-0 max-w-full rounded-lg border border-slate-700 bg-surface px-3 py-2.5 text-white';

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Activity</h1>
        <p className="text-[15px] leading-relaxed text-slate-400 sm:text-sm sm:leading-normal">
          Log steps, active energy, and exercise minutes. Safari cannot read Apple Health directly, but you
          can sync from the Health app using an{' '}
          <strong className="font-medium text-slate-300">iOS Shortcut</strong> and a personal token below — or
          enter values by hand.
        </p>
      </div>

      <div className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-white">Apple Health → IronLogger</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          Shortcuts on your iPhone can read step counts (and optionally active calories) from Health and POST
          them to IronLogger. Your phone must reach the same API URL the app uses in production (set{' '}
          <code className="text-slate-400">VITE_API_URL</code> when building the client so this URL is
          correct).
        </p>
        <p className="font-mono text-xs break-all text-slate-400">{importUrl}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncActionLoading}
            onClick={createSyncToken}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {syncMeta.configured ? 'Rotate token' : 'Create sync token'}
          </button>
          {syncMeta.configured ? (
            <button
              type="button"
              disabled={syncActionLoading}
              onClick={revokeSyncToken}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
            >
              Revoke token
            </button>
          ) : null}
        </div>
        {syncMeta.configured && syncMeta.createdAt ? (
          <p className="text-xs text-slate-500">
            Token active (created {new Date(syncMeta.createdAt).toLocaleString()}). Rotate if it was exposed.
          </p>
        ) : (
          <p className="text-xs text-slate-500">No token yet — create one to use in Shortcuts.</p>
        )}
        {newSyncToken ? (
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 p-3">
            <p className="text-xs font-medium text-amber-200">Copy now — shown once</p>
            <p className="mt-1 break-all font-mono text-sm text-white">{newSyncToken}</p>
            <button
              type="button"
              className="mt-2 text-xs text-blue-400 underline"
              onClick={() => navigator.clipboard?.writeText(newSyncToken)}
            >
              Copy token
            </button>
          </div>
        ) : null}
        <details className="rounded-lg border border-slate-700/80 bg-surface/50 p-3 text-xs text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-300">Shortcut setup (iOS)</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-slate-400">
            <li>
              In the Shortcuts app, add an action that reads <strong className="text-slate-300">today’s step
              count</strong> from Health (e.g. search for Health → actions that return Steps or Step Count
              for today).
            </li>
            <li>
              Add <strong className="text-slate-300">Get contents of URL</strong> — Method POST, URL: the
              import URL above.
            </li>
            <li>
              Headers: <code className="text-slate-500">Content-Type: application/json</code> and{' '}
              <code className="text-slate-500">Authorization: Bearer YOUR_TOKEN</code> (paste the token you
              created).
            </li>
            <li>
              Request body (JSON):{' '}
              <code className="block whitespace-pre-wrap break-all text-slate-500">
                {`{\n  "dayKey": "YYYY-MM-DD",\n  "steps": 12345\n}`}
              </code>
              Use a <strong className="text-slate-300">Format Date</strong> action for today as{' '}
              <code className="text-slate-500">yyyy-MM-dd</code> for <code className="text-slate-500">dayKey</code>.
              Optionally add <code className="text-slate-500">activeCalories</code> and{' '}
              <code className="text-slate-500">exerciseMinutes</code>.
            </li>
            <li>Run the shortcut daily or automate it (Automation → Time of Day) so steps stay updated.</li>
          </ol>
          <p className="mt-2 text-slate-500">
            Alternatively, put the token in the JSON body as <code className="text-slate-500">syncToken</code>{' '}
            instead of the Authorization header.
          </p>
        </details>
      </div>

      <div className="min-w-0 overflow-x-clip rounded-2xl border border-slate-800 bg-surface-card p-4">
        <label className="mb-1 block text-xs text-slate-500" htmlFor="activity-day-key">
          Date
        </label>
        {/*
          iOS WebKit: padding on type="date" + w-full overflows (WebKit #301648). Chrome is fine.
          Shell carries border/bg/padding; the input is flex-sized with zero padding.
        */}
        <div className="group mb-4 w-full min-w-0 max-w-full">
          <div className="flex min-h-[44px] w-full min-w-0 max-w-full items-center rounded-lg border border-slate-700 bg-surface px-3 py-2 transition-[border-color,box-shadow] duration-motion ease-motion-standard group-focus-within:border-slate-500 group-focus-within:shadow-[0_0_0_1px_rgba(100,116,139,0.35)]">
            <input
              id="activity-day-key"
              type="date"
              value={dayKey}
              onChange={(e) => setDayKey(e.target.value)}
              className="min-w-0 flex-1 basis-0 border-0 bg-transparent p-0 text-base text-white outline-none focus:ring-0 focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <label className="text-xs text-slate-500">Steps</label>
            <input
              type="number"
              inputMode="numeric"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs text-slate-500">Active kcal</label>
            <input
              type="number"
              inputMode="decimal"
              value={activeCalories}
              onChange={(e) => setActiveCalories(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs text-slate-500">Exercise min</label>
            <input
              type="number"
              inputMode="decimal"
              value={exerciseMinutes}
              onChange={(e) => setExerciseMinutes(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {currentLog?.source === 'apple_shortcut' ? (
          <p className="mt-2 text-xs text-slate-500">
            This day was last updated from Apple Health via Shortcut. Saving below switches it to manual.
          </p>
        ) : null}

        <label className="mb-1 mt-3 block text-xs text-slate-500">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={fieldClass}
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
