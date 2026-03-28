import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Dumbbell,
  Flame,
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  Weight,
} from 'lucide-react';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { LBS_PER_KG } from '../utils/weightUnits.js';
import { formatWorkoutDuration } from '../utils/workoutDuration.js';
import { useLiveClock } from '../hooks/useLiveClock.js';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const CAT_ORDER = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'other'];
const CAT_LABEL = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  other: 'Other',
};

/** Tailwind bg classes — subtle, distinct hues for stacked bar */
const CAT_BAR = {
  chest: 'bg-rose-400/75',
  back: 'bg-sky-400/70',
  shoulders: 'bg-violet-400/70',
  arms: 'bg-amber-400/70',
  legs: 'bg-emerald-400/70',
  core: 'bg-cyan-400/70',
  cardio: 'bg-fuchsia-400/65',
  other: 'bg-slate-400/65',
};

const CARD_PRIMARY =
  'rounded-[10px] border border-slate-600/35 bg-[#1c2433]/90 p-5 shadow-sm transition-[transform,background-color,border-color] duration-200 hover:border-slate-500/40 hover:bg-[#1f2839]/95 active:scale-[0.99]';
const CARD_SECONDARY =
  'rounded-[10px] border border-slate-800/80 bg-[#121820]/90 p-5 transition-[transform,background-color,border-color] duration-200 hover:border-slate-700/60 hover:bg-[#141b24]/95 active:scale-[0.99]';

function pctChange(current, previous) {
  if (previous === 0) {
    if (current === 0) return null;
    return { pct: 100, up: true };
  }
  const raw = ((current - previous) / previous) * 100;
  const pct = Math.min(999, Math.round(Math.abs(raw)));
  return { pct, up: raw >= 0 };
}

function TrendHint({ current, previous }) {
  const t = pctChange(current, previous);
  if (t == null) return <span className="text-[11px] text-slate-600">vs prior period</span>;
  const Icon = t.up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
        t.up ? 'text-emerald-400/90' : 'text-rose-400/85'
      }`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
      {t.up ? '+' : '−'}
      {t.pct}%
    </span>
  );
}

function StackedVolumeBar({ segments, total, allRows }) {
  if (total <= 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-md bg-slate-800/90 ring-1 ring-slate-800/80">
        {segments.map(({ key, volume }) => {
          if (volume <= 0) return null;
          const w = Math.max((volume / total) * 100, volume > 0 ? 0.8 : 0);
          return (
            <div
              key={key}
              className={`h-full min-w-0 ${CAT_BAR[key] || 'bg-slate-500/60'}`}
              style={{ width: `${w}%` }}
              title={`${CAT_LABEL[key]}: ${volume.toLocaleString()}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {allRows.map(({ key, label, volume }) => (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 shrink-0 rounded-sm ${volume > 0 ? CAT_BAR[key] || 'bg-slate-500' : 'bg-slate-700'}`}
              aria-hidden
            />
            <span className="text-slate-500">{label}</span>
            <span className={`font-mono tabular-nums ${volume > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
              {volume > 0 ? volume.toLocaleString() : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const weightUnit = useWeightUnit();
  const [summary, setSummary] = useState(null);
  const [muscleWeek, setMuscleWeek] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, m, w] = await Promise.all([
          api.get('/workouts/summary'),
          api.get('/workouts/stats/muscles?days=7'),
          api.get('/workouts?limit=5'),
        ]);
        if (!alive) return;
        setSummary(s.data);
        setMuscleWeek(m.data);
        setRecent(w.data.workouts || []);
      } catch (e) {
        if (alive) setErr(e.response?.data?.error || 'Failed to load');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hasOpenWorkout =
    !!summary &&
    ((summary.lastWorkout && !summary.lastWorkout.completedAt) ||
      recent.some((w) => !w.completedAt));
  const liveNow = useLiveClock(hasOpenWorkout);

  const displayVolume =
    weightUnit === 'lbs'
      ? Math.round(summary?.estimatedTotalVolume * LBS_PER_KG)
      : summary?.estimatedTotalVolume;

  const volThis7 =
    weightUnit === 'lbs'
      ? Math.round((summary?.volumeThis7d ?? 0) * LBS_PER_KG)
      : summary?.volumeThis7d ?? 0;
  const volPrev7 =
    weightUnit === 'lbs'
      ? Math.round((summary?.volumePrev7d ?? 0) * LBS_PER_KG)
      : summary?.volumePrev7d ?? 0;

  const weekVolumesAll = useMemo(() => {
    return CAT_ORDER.map((k) => {
      const raw = muscleWeek?.categories?.[k]?.volume ?? 0;
      const v = weightUnit === 'kg' ? raw : Math.round(raw * LBS_PER_KG);
      return { key: k, label: CAT_LABEL[k], volume: v };
    });
  }, [muscleWeek, weightUnit]);

  const weekVolumesNonZero = weekVolumesAll.filter((x) => x.volume > 0);
  const weekVolTotal = weekVolumesNonZero.reduce((s, x) => s + x.volume, 0);

  const streakHint = useMemo(() => {
    if (!summary?.streak) return null;
    const d = summary.streak.trainingDaysLast7;
    if (d >= 5) return 'Strong week — keep it going 💪';
    if (d >= 3) return 'Nice rhythm — stay consistent.';
    if (d >= 1) return 'Every session counts.';
    return 'Log a workout to start your streak.';
  }, [summary?.streak]);

  if (err) {
    return <p className="text-sm text-red-400">{err}</p>;
  }

  if (!summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-800/60" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-[10px] bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Dashboard</h1>
        <p className="text-sm text-slate-500">Your training at a glance</p>
      </header>

      {/* Primary stats */}
      <section aria-label="Summary statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className={CARD_PRIMARY}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total sessions</p>
              <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.totalWorkouts}
            </p>
            <p className="mt-2 text-[11px] text-slate-600">All-time completed</p>
          </div>
          <div className={CARD_PRIMARY}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">This week</p>
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.workoutsThisWeek}
            </p>
            <div className="mt-2 flex min-h-[1rem] items-center gap-2">
              <TrendHint current={summary.workoutsThisWeek} previous={summary.prevWeekWorkouts ?? 0} />
            </div>
          </div>
          <div className={CARD_PRIMARY}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">This month</p>
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.workoutsThisMonth}
            </p>
            <div className="mt-2 flex min-h-[1rem] items-center gap-2">
              <TrendHint current={summary.workoutsThisMonth} previous={summary.prevMonthWorkouts ?? 0} />
            </div>
          </div>
          <div className={CARD_PRIMARY}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Est. volume ({weightUnit}×reps)
              </p>
              <Weight className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {displayVolume.toLocaleString()}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[11px] text-slate-600">Warm-up sets excluded · all-time</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <TrendHint current={volThis7} previous={volPrev7} />
                <span className="text-[10px] text-slate-600">7d vs prior 7d</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {summary.streak ? (
        <section className={CARD_SECONDARY} aria-label="Consistency">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80">
              <Flame className="h-5 w-5 text-amber-400/90" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Consistency</p>
              <p className="mt-1 text-base font-medium text-slate-100">
                <span className="tabular-nums text-white">{summary.streak.currentDays}</span>
                <span className="text-slate-400">-day streak</span>
                {summary.streak.currentDays === 0 ? (
                  <span className="text-slate-500"> — log today or yesterday to start</span>
                ) : null}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Trained on{' '}
                <span className="font-mono text-slate-300">{summary.streak.trainingDaysLast7}</span> of the last 7
                days (your timezone).
              </p>
              {streakHint ? <p className="mt-3 text-sm text-slate-400">{streakHint}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Volume by category — stacked bar */}
      <section className={CARD_SECONDARY} aria-label="Weekly volume by category">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            This week — volume by category
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Rolling 7 days · {weightUnit}×reps · warm-ups excluded
          </p>
        </div>
        {weekVolTotal > 0 ? (
          <StackedVolumeBar
            segments={weekVolumesNonZero}
            total={weekVolTotal}
            allRows={weekVolumesAll}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/20 px-4 py-8 text-center">
            <Dumbbell className="mx-auto h-8 w-8 text-slate-600" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm text-slate-500">No category volume this week yet</p>
            <p className="mt-1 text-xs text-slate-600">Complete a workout to see your mix here.</p>
          </div>
        )}
      </section>

      <section className={CARD_SECONDARY} aria-label="Last session">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last session</p>
        {summary.lastWorkout ? (
          <div className="mt-3">
            <p className="text-lg font-semibold text-white">{summary.lastWorkout.title}</p>
            <p className="mt-1 text-sm text-slate-500">{fmtDate(summary.lastWorkout.startedAt)}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {formatWorkoutDuration(
                summary.lastWorkout.startedAt,
                summary.lastWorkout.completedAt,
                {
                  live: !summary.lastWorkout.completedAt,
                  now: liveNow,
                }
              )}
            </p>
            {summary.lastWorkout.completedAt ? (
              <span className="mt-3 inline-block rounded-md bg-emerald-950/80 px-2.5 py-1 text-[11px] font-medium text-emerald-400/95 ring-1 ring-emerald-900/50">
                Completed
              </span>
            ) : (
              <span className="mt-3 inline-block rounded-md bg-amber-950/80 px-2.5 py-1 text-[11px] font-medium text-amber-400/95 ring-1 ring-amber-900/50">
                In progress
              </span>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No workouts yet — start with a quick session below.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to={appPath('workouts/new')}
          className="inline-flex h-11 min-w-[8.5rem] flex-1 items-center justify-center rounded-[10px] bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:bg-blue-600 hover:shadow-md active:scale-[0.98] sm:flex-none"
        >
          New workout
        </Link>
        <Link
          to={appPath('templates')}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-slate-600/60 bg-transparent px-5 text-sm font-medium text-slate-300 transition-[transform,background-color,border-color] duration-200 hover:border-slate-500 hover:bg-slate-800/30 active:scale-[0.98]"
        >
          From plan
        </Link>
        <Link
          to={appPath('progress')}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-slate-600/60 bg-transparent px-5 text-sm font-medium text-slate-300 transition-[transform,background-color,border-color] duration-200 hover:border-slate-500 hover:bg-slate-800/30 active:scale-[0.98]"
        >
          View progress
        </Link>
      </div>

      <section aria-label="Recent workouts">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent workouts</h2>
        <ul className="space-y-2">
          {recent.length === 0 ? (
            <li className="rounded-[10px] border border-dashed border-slate-700/80 bg-slate-900/15 px-5 py-10 text-center">
              <p className="text-sm text-slate-500">Nothing here yet</p>
              <p className="mt-2 text-xs text-slate-600">Your latest sessions will show up after you log them.</p>
            </li>
          ) : (
            recent.map((w) => (
              <li key={w._id}>
                <Link
                  to={appPath(`workouts/${w._id}`)}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-slate-800/90 bg-[#121820]/80 px-4 py-4 transition-[transform,background-color,border-color] duration-200 hover:border-slate-700/80 hover:bg-[#151c26]/90 active:scale-[0.995]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{w.title}</p>
                    <p className="text-xs text-slate-500">{fmtDate(w.startedAt)}</p>
                    <p className="font-mono text-xs text-slate-500">
                      {formatWorkoutDuration(w.startedAt, w.completedAt, {
                        live: !w.completedAt,
                        now: liveNow,
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-slate-600" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
