import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const DAYS = [
  { v: 0, label: 'Sun' },
  { v: 1, label: 'Mon' },
  { v: 2, label: 'Tue' },
  { v: 3, label: 'Wed' },
  { v: 4, label: 'Thu' },
  { v: 5, label: 'Fri' },
  { v: 6, label: 'Sat' },
];

let reminderTimer = null;

function clearReminderLoop() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

function scheduleLocalReminder(enabled, timeStr, daySet, userName) {
  clearReminderLoop();
  if (!enabled || !timeStr || typeof Notification === 'undefined') return;

  const tick = () => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const [hh, mm] = timeStr.split(':').map(Number);
    const today = now.getDay();
    if (daySet.size && !daySet.has(today)) return;
    if (now.getHours() !== hh || now.getMinutes() !== mm) return;

    const key = `ironlog_reminder_${now.toDateString()}_${hh}_${mm}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    new Notification('IronLog workout reminder', {
      body: userName ? `Time to train, ${userName}` : 'Time for your scheduled workout.',
      tag: 'ironlog-daily',
    });
  };

  tick();
  reminderTimer = setInterval(tick, 30_000);
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderDays, setReminderDays] = useState([1, 3, 5]);
  const [notifStatus, setNotifStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState('kg');
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;
    setReminderEnabled(!!user.reminderEnabled);
    setReminderTime(user.reminderTime || '18:00');
    setReminderDays(
      Array.isArray(user.reminderDays) && user.reminderDays.length
        ? user.reminderDays
        : [1, 3, 5]
    );
    setWeightUnit(user.weightUnit === 'lbs' ? 'lbs' : 'kg');
  }, [user]);

  useEffect(() => {
    const daySet = new Set(reminderDays);
    scheduleLocalReminder(reminderEnabled, reminderTime, daySet, user?.name);
    return () => clearReminderLoop();
  }, [reminderEnabled, reminderTime, reminderDays, user?.name]);

  async function requestNotify() {
    if (typeof Notification === 'undefined') {
      setNotifStatus('Notifications are not supported in this browser.');
      return;
    }
    const p = await Notification.requestPermission();
    setNotifStatus(p === 'granted' ? 'Permission granted.' : `Permission: ${p}`);
  }

  async function savePrefs() {
    setSaving(true);
    try {
      await api.patch('/auth/me', {
        reminderEnabled,
        reminderTime,
        reminderDays,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        weightUnit,
      });
      await refreshUser();
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(v) {
    setReminderDays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Reminders and preferences</p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-2 font-semibold text-white">Weight unit</h2>
        <p className="mb-4 text-sm text-slate-400">
          Default is <span className="text-slate-200">kilograms</span>. Workouts and templates
          always save weights as kg on the server; this only changes how numbers are shown and
          entered.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWeightUnit('kg')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              weightUnit === 'kg'
                ? 'bg-accent text-white'
                : 'border border-slate-600 text-slate-300'
            }`}
          >
            Kilograms (kg)
          </button>
          <button
            type="button"
            onClick={() => setWeightUnit('lbs')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              weightUnit === 'lbs'
                ? 'bg-accent text-white'
                : 'border border-slate-600 text-slate-300'
            }`}
          >
            Pounds (lbs)
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-2 font-semibold text-white">Workout reminders</h2>
        <p className="mb-4 text-sm text-slate-400">
          Browser notifications when this app is open (or in background on supported devices). Add
          IronLog to your Home Screen on iPhone for better background behavior. Apple does not
          expose HealthKit to Safari; see Activity for manual logging.
        </p>

        <button
          type="button"
          onClick={requestNotify}
          className="mb-4 rounded-xl border border-slate-600 px-4 py-2 text-sm text-white"
        >
          Enable browser notifications
        </button>
        {notifStatus ? <p className="mb-4 text-xs text-slate-500">{notifStatus}</p> : null}

        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          <span className="text-sm text-white">Daily reminder at chosen time</span>
        </label>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-500">Time (device local)</label>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="rounded-xl border border-slate-700 bg-surface px-3 py-2 text-white"
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-500">Days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleDay(v)}
                className={`rounded-full px-3 py-1 text-xs ${
                  reminderDays.includes(v)
                    ? 'bg-accent text-white'
                    : 'bg-surface-elevated text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={savePrefs}
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </section>
    </div>
  );
}
