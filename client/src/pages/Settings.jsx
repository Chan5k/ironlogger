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

    new Notification('IronLogger workout reminder', {
      body: userName ? `Time to train, ${userName}` : 'Time for your scheduled workout.',
      tag: 'ironlog-daily',
    });
  };

  tick();
  reminderTimer = setInterval(tick, 30_000);
}

function apiErr(e) {
  const d = e?.response?.data;
  if (Array.isArray(d?.errors)) {
    return d.errors.map((x) => x.msg || x.message).filter(Boolean).join(' ') || 'Request failed';
  }
  return d?.error || e?.message || 'Something went wrong';
}

export default function Settings() {
  const { user, refreshUser, setToken } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderDays, setReminderDays] = useState([1, 3, 5]);
  const [notifStatus, setNotifStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
  const [publicProfileSlug, setPublicProfileSlug] = useState('');
  const [publicProfileBusy, setPublicProfileBusy] = useState(false);
  const [publicProfileMsg, setPublicProfileMsg] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;
    setDisplayName(user.name || '');
    setReminderEnabled(!!user.reminderEnabled);
    setReminderTime(user.reminderTime || '18:00');
    setReminderDays(
      Array.isArray(user.reminderDays) && user.reminderDays.length
        ? user.reminderDays
        : [1, 3, 5]
    );
    setWeightUnit(user.weightUnit === 'lbs' ? 'lbs' : 'kg');
    setPublicProfileEnabled(!!user.publicProfileEnabled);
    setPublicProfileSlug(user.publicProfileSlug || '');
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

  async function saveUsername() {
    setNameMsg('');
    const n = displayName.trim();
    if (!n) {
      setNameMsg('Username cannot be empty');
      return;
    }
    setNameBusy(true);
    try {
      await api.patch('/auth/me', { name: n });
      await refreshUser();
      setNameMsg('Username updated.');
    } catch (e) {
      setNameMsg(apiErr(e));
    } finally {
      setNameBusy(false);
    }
  }

  async function saveEmailChange() {
    setEmailMsg('');
    const em = newEmail.trim().toLowerCase();
    if (!em) {
      setEmailMsg('Enter a new email address');
      return;
    }
    if (user?.email && em === user.email.toLowerCase()) {
      setEmailMsg('That is already your email');
      return;
    }
    if (!emailPw) {
      setEmailMsg('Enter your current password');
      return;
    }
    setEmailBusy(true);
    try {
      const { data } = await api.patch('/auth/me', {
        email: em,
        currentPassword: emailPw,
      });
      if (data.token) setToken(data.token, data.user);
      else await refreshUser();
      setNewEmail('');
      setEmailPw('');
      setEmailMsg('Email updated.');
    } catch (e) {
      setEmailMsg(apiErr(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePasswordChange() {
    setPwMsg('');
    if (!pwCurrent) {
      setPwMsg('Enter your current password');
      return;
    }
    if (pwNew.length < 8) {
      setPwMsg('New password must be at least 8 characters');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg('New passwords do not match');
      return;
    }
    setPwBusy(true);
    try {
      const { data } = await api.patch('/auth/me', {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });
      if (data.token) setToken(data.token, data.user);
      else await refreshUser();
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      setPwMsg('Password updated.');
    } catch (e) {
      setPwMsg(apiErr(e));
    } finally {
      setPwBusy(false);
    }
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

  async function savePublicProfile() {
    setPublicProfileMsg('');
    const slug = publicProfileSlug.trim().toLowerCase();
    if (publicProfileEnabled && !slug) {
      setPublicProfileMsg('Choose a profile URL before enabling.');
      return;
    }
    if (slug && !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
      setPublicProfileMsg(
        'URL must be 3–32 characters: lowercase letters, numbers, hyphens; no leading/trailing hyphen.'
      );
      return;
    }
    setPublicProfileBusy(true);
    try {
      const payload = { publicProfileEnabled };
      if (slug) payload.publicProfileSlug = slug;
      await api.patch('/auth/me', payload);
      await refreshUser();
      setPublicProfileMsg('Public profile saved.');
    } catch (e) {
      setPublicProfileMsg(apiErr(e));
    } finally {
      setPublicProfileBusy(false);
    }
  }

  function copyPublicLink() {
    const slug = publicProfileSlug.trim().toLowerCase();
    if (!slug || !publicProfileEnabled) return;
    const url = `${window.location.origin}/u/${encodeURIComponent(slug)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => setPublicProfileMsg('Link copied.'),
        () => setPublicProfileMsg(url)
      );
    } else {
      setPublicProfileMsg(url);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Account, reminders, and preferences</p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-2 font-semibold text-white">Account</h2>
        <p className="mb-4 text-sm text-slate-400">
          Signed in as <span className="text-slate-200">{user?.email}</span>
        </p>

        <div className="space-y-6 border-b border-slate-800 pb-6">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Username</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                type="text"
                autoComplete="username"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={saveUsername}
                disabled={nameBusy}
                className="rounded-xl bg-surface-elevated px-4 py-3 text-sm font-medium text-white ring-1 ring-slate-600/60 disabled:opacity-50"
              >
                {nameBusy ? 'Saving…' : 'Save username'}
              </button>
            </div>
            {nameMsg ? (
              <p
                className={`mt-2 text-xs ${nameMsg.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {nameMsg}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">New email</label>
            <input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              className="mb-2 w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            />
            <label className="mb-1 block text-xs text-slate-500">Current password (required)</label>
            <input
              type="password"
              autoComplete="current-password"
              value={emailPw}
              onChange={(e) => setEmailPw(e.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={saveEmailChange}
              disabled={emailBusy}
              className="w-full rounded-xl bg-surface-elevated py-2.5 text-sm font-medium text-white ring-1 ring-slate-600/60 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {emailBusy ? 'Updating…' : 'Update email'}
            </button>
            {emailMsg ? (
              <p
                className={`mt-2 text-xs ${emailMsg.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {emailMsg}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Current password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            />
            <label className="mb-1 block text-xs text-slate-500">New password (min 8)</label>
            <input
              type="password"
              autoComplete="new-password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            />
            <label className="mb-1 block text-xs text-slate-500">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-700 bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={savePasswordChange}
              disabled={pwBusy}
              className="w-full rounded-xl bg-surface-elevated py-2.5 text-sm font-medium text-white ring-1 ring-slate-600/60 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
            {pwMsg ? (
              <p
                className={`mt-2 text-xs ${pwMsg.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {pwMsg}
              </p>
            ) : null}
          </div>
        </div>
      </section>

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
        <h2 className="mb-2 font-semibold text-white">Public profile</h2>
        <p className="mb-4 text-sm text-slate-400">
          Share a read-only page with workout counts and estimated total volume. Your email and
          workout details stay private.
        </p>
        <label className="mb-3 block text-xs text-slate-500" htmlFor="public-slug">
          Profile URL
        </label>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span className="font-mono text-slate-500">{window.location.origin}/u/</span>
          <input
            id="public-slug"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={publicProfileSlug}
            onChange={(e) => setPublicProfileSlug(e.target.value.toLowerCase())}
            placeholder="your-handle"
            className="min-w-[8rem] flex-1 rounded-xl border border-slate-700 bg-surface px-3 py-2 font-mono text-white outline-none focus:border-accent"
          />
        </div>
        <label className="mt-4 flex items-center gap-3 py-2">
          <input
            type="checkbox"
            checked={publicProfileEnabled}
            onChange={(e) => setPublicProfileEnabled(e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          <span className="text-sm text-white">Make profile public</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={savePublicProfile}
            disabled={publicProfileBusy}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {publicProfileBusy ? 'Saving…' : 'Save public profile'}
          </button>
          <button
            type="button"
            onClick={copyPublicLink}
            disabled={!publicProfileEnabled || !publicProfileSlug.trim()}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 disabled:opacity-50"
          >
            Copy link
          </button>
        </div>
        {publicProfileMsg ? (
          <p
            className={`mt-3 text-xs ${
              /^Public profile saved\.|^Link copied\./i.test(publicProfileMsg) ||
              publicProfileMsg.startsWith('http')
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}
          >
            {publicProfileMsg}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
        <h2 className="mb-2 font-semibold text-white">Workout reminders</h2>
        <p className="mb-4 text-sm text-slate-400">
          Browser notifications when this app is open (or in background on supported devices). Add
          IronLogger to your Home Screen on iPhone for better background behavior. Apple does not
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
