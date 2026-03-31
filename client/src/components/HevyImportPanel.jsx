import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { RankIcon } from './ranks/RankIcon.jsx';

function apiErr(e) {
  const d = e?.response?.data;
  return d?.error || e?.message || 'Something went wrong';
}

function formatSeasonEnd(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export default function HevyImportPanel({ user, refreshUser }) {
  const sr = user?.seasonRank;
  const fileRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');
  const [rankFlash, setRankFlash] = useState(false);

  const runImport = useCallback(
    async (file) => {
      setErr('');
      setSummary(null);
      setPhase('uploading');
      const fd = new FormData();
      fd.append('file', file);
      const parsingTimer = window.setTimeout(() => setPhase('parsing'), 200);
      try {
        const { data } = await api.post('/import/hevy', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            const t = ev.total || 0;
            if (t > 0 && ev.loaded >= t) setPhase('parsing');
          },
        });
        setSummary(data);
        if (data.rankUp) {
          setRankFlash(true);
          window.setTimeout(() => setRankFlash(false), 1200);
        }
        await refreshUser();
      } catch (e) {
        setErr(apiErr(e));
      } finally {
        window.clearTimeout(parsingTimer);
        setPhase('idle');
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [refreshUser]
  );

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr('');
    if (!/\.csv$/i.test(f.name)) {
      setErr('Please choose a .csv file.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setErr('File must be 2 MB or smaller.');
      return;
    }
    runImport(f);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-surface-card p-4">
      <h2 className="mb-2 font-semibold text-white">Import from Hevy</h2>
      <p className="mb-4 text-sm text-slate-400">
        Upload a Hevy workout export (CSV). Each new session is saved as a completed workout and
        earns the same <span className="text-slate-300">monthly season rank</span> points as logging
        in IronLog when the session qualifies (base + volume bonus, plus the daily first-workout
        bonus when it applies). All exported sessions are stored and count toward your training-day
        streak and stats; duplicates in IronLog are skipped. Set your{' '}
        <Link to={appPath('settings')} className="text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-white">
          timezone in Settings
        </Link>{' '}
        to match where you train — CSV times without a timezone are read as local time in that zone
        so calendar days (and streaks) line up with Hevy. Older Hevy imports are adjusted automatically
        the next time you open the dashboard (consistency uses the corrected dates). If you change
        timezone, refresh the dashboard once; re-import only if something still looks wrong.
      </p>

      {sr?.rankLabel ? (
        <div
          className={`mb-6 rounded-xl border border-slate-800/90 bg-[#121826]/95 px-4 py-4 transition-transform duration-500 ${
            rankFlash ? 'scale-[1.02] ring-2 ring-amber-400/50' : ''
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <RankIcon iconId={sr.rankIconId} className="h-12 w-12 shrink-0" title={sr.rankLabel} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Your season rank
              </p>
              <p className="text-sm font-medium text-white">{sr.seasonLabel ?? ''}</p>
              <p className="mt-0.5 text-sm text-slate-400">
                <span className="text-slate-200">{sr.rankLabel}</span>
                <span className="mx-1.5 text-slate-600">·</span>
                {(Number(sr.seasonPoints) || 0).toLocaleString()} pts
                {!sr.isMaxRank && sr.nextRankLabel ? (
                  <span className="text-slate-500">
                    {' '}
                    · {sr.pointsToNextRank} to {sr.nextRankLabel}
                  </span>
                ) : null}
              </p>
              {sr.seasonEndsAt ? (
                <p className="mt-1 text-xs text-slate-600">
                  Resets {formatSeasonEnd(sr.seasonEndsAt)} (UTC)
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-slate-600 bg-surface/40 p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={phase !== 'idle'}
            onChange={onPickFile}
            className="block w-full cursor-pointer text-sm text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
          />
        </label>
        {phase === 'uploading' ? (
          <p className="mt-2 text-sm text-amber-400/90">Uploading…</p>
        ) : null}
        {phase === 'parsing' ? (
          <p className="mt-2 text-sm text-amber-400/90">Importing &amp; awarding season points…</p>
        ) : null}
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
      </div>

      {summary ? (
        <div className="mt-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
          <p className="text-sm font-semibold text-emerald-300">Import complete</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>
              Workouts imported:{' '}
              <span className="font-medium text-white">{summary.workoutsImported}</span>
            </li>
            <li>
              Skipped (already imported):{' '}
              <span className="font-medium text-white">{summary.workoutsSkipped}</span>
            </li>
            <li>
              Season points from this import:{' '}
              <span className="font-medium text-emerald-400">
                +{summary.seasonPointsGained} pts
              </span>
            </li>
            <li className="pt-1 text-slate-200">
              <span className="text-slate-500">Rank: </span>
              <span className="text-slate-300">{summary.oldRankLabel}</span>
              <span className="mx-1 text-slate-500">→</span>
              <span
                className={
                  summary.rankUp ? 'font-semibold text-amber-300' : 'font-medium text-white'
                }
              >
                {summary.newRankLabel}
              </span>
              {summary.rankUp ? (
                <span className="ml-2 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase text-amber-300">
                  Rank up!
                </span>
              ) : null}
            </li>
            <li className="text-xs text-slate-500">
              Season total: {summary.oldSeasonPoints} → {summary.newSeasonPoints} pts
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
