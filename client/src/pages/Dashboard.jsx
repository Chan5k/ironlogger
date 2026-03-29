import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Lightbulb,
  Sparkles,
  Target,
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

/** Stacked bar / legend — blue-forward palette (mock). */
const CHART_FILL = {
  chest: '#3b82f6',
  back: '#0ea5e9',
  shoulders: '#6366f1',
  arms: '#8b5cf6',
  legs: '#14b8a6',
  core: '#06b6d4',
  cardio: '#64748b',
  other: '#475569',
};

const CARD =
  'rounded-xl border border-slate-800/90 bg-[#121826]/95 p-5 shadow-sm shadow-black/20';
const CARD_MUTED = 'rounded-xl border border-slate-800/80 bg-[#0f141d]/90 p-5';

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
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        t.up ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
      {t.up ? '+' : '−'}
      {t.pct}%
    </span>
  );
}

function streakRecordLine(streak) {
  if (!streak || streak.currentDays === 0) return null;
  if (streak.bestEver == null) return null;
  const best = streak.bestEver;
  if (streak.currentDays < best) {
    const n = best - streak.currentDays;
    return `${n} more day${n === 1 ? '' : 's'} to beat your record!`;
  }
  if (streak.currentDays === best && best > 0) {
    return 'Matched your best streak — keep going!';
  }
  return null;
}

export default function Dashboard() {
  const weightUnit = useWeightUnit();
  const [summary, setSummary] = useState(null);
  const [muscleWeek, setMuscleWeek] = useState(null);
  const [volumeByDay, setVolumeByDay] = useState(null);
  const [recent, setRecent] = useState([]);
  const [intel, setIntel] = useState(null);
  const [goalsPreview, setGoalsPreview] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/workouts/intelligence')
      .then(({ data }) => {
        if (alive) setIntel(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get('/goals')
      .then(({ data }) => {
        if (!alive) return;
        const g = data.goals || [];
        setGoalsPreview(g.filter((x) => !x.completedAt).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, m, v, w] = await Promise.all([
          api.get('/workouts/summary'),
          api.get('/workouts/stats/muscles?days=7'),
          api.get('/workouts/stats/volume-by-day?days=7'),
          api.get('/workouts?limit=5'),
        ]);
        if (!alive) return;
        setSummary(s.data);
        setMuscleWeek(m.data);
        setVolumeByDay(v.data);
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
      recent.some((rw) => !rw.completedAt));
  const liveNow = useLiveClock(hasOpenWorkout);

  const scaleVol = (kgVol) =>
    weightUnit === 'lbs' ? Math.round(kgVol * LBS_PER_KG) : kgVol;

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
      const v = scaleVol(raw);
      return { key: k, label: CAT_LABEL[k], volume: v };
    });
  }, [muscleWeek, weightUnit]);

  const weekVolumesNonZero = weekVolumesAll.filter((x) => x.volume > 0);
  const weekVolTotal = weekVolumesNonZero.reduce((s, x) => s + x.volume, 0);

  const chartCategories = useMemo(() => {
    if (!volumeByDay?.days?.length) return [];
    const used = new Set();
    for (const row of volumeByDay.days) {
      for (const k of CAT_ORDER) {
        if (scaleVol(row.categories[k] ?? 0) > 0) used.add(k);
      }
    }
    const ordered = CAT_ORDER.filter((k) => used.has(k));
    return ordered.length ? ordered : CAT_ORDER.slice(0, 3);
  }, [volumeByDay, weightUnit]);

  const barChartData = useMemo(() => {
    if (!volumeByDay?.days) return [];
    return volumeByDay.days.map((row) => {
      const o = {
        name: row.label,
        dayKey: row.dayKey,
        total: scaleVol(row.totalVolume),
      };
      for (const k of chartCategories) {
        o[k] = scaleVol(row.categories[k] ?? 0);
      }
      return o;
    });
  }, [volumeByDay, chartCategories, weightUnit]);

  const lineChartData = useMemo(() => {
    if (!volumeByDay?.days) return [];
    return volumeByDay.days.map((row) => ({
      name: row.label,
      total: scaleVol(row.totalVolume),
    }));
  }, [volumeByDay, weightUnit]);

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  };

  if (err) {
    return <p className="text-sm text-red-400">{err}</p>;
  }

  const recordHint = summary?.streak ? streakRecordLine(summary.streak) : null;

  if (!summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-800/60" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">Dashboard</h1>
        <p className="text-sm text-slate-500">Your training at a glance</p>
      </header>

      <section aria-label="Summary statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Total sessions
              </p>
              <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.totalWorkouts}
            </p>
            <p className="mt-2 text-[11px] text-slate-600">All-time completed</p>
          </div>
          <div className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This week</p>
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.workoutsThisWeek}
            </p>
            <div className="mt-2 flex min-h-[1rem] items-center gap-2">
              <TrendHint current={summary.workoutsThisWeek} previous={summary.prevWeekWorkouts ?? 0} />
            </div>
          </div>
          <div className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This month</p>
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {summary.workoutsThisMonth}
            </p>
            <div className="mt-2 flex min-h-[1rem] items-center gap-2">
              <TrendHint current={summary.workoutsThisMonth} previous={summary.prevMonthWorkouts ?? 0} />
            </div>
          </div>
          <div className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Est. volume ({weightUnit}×reps)
              </p>
              <Weight className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {displayVolume.toLocaleString()}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[11px] text-slate-600">Warm-up sets excluded · All-time</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <TrendHint current={volThis7} previous={volPrev7} />
                <span className="text-[10px] text-slate-600">7d vs prior 7d</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {intel?.coachingTips?.length > 0 ? (
        <section className={CARD_MUTED} aria-label="Coaching">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/25">
              <Sparkles className="h-5 w-5 text-sky-400" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coaching</p>
              <ul className="mt-3 space-y-2.5">
                {intel.coachingTips.map((text, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 shrink-0 text-sky-400" aria-hidden>
                      →
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className={CARD_MUTED} aria-label="Goals">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
              <Target className="h-5 w-5 text-blue-400" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Goals</p>
              <p className="mt-1 text-sm text-slate-500">Track strength, weekly frequency, or volume.</p>
            </div>
          </div>
          <Link
            to={appPath('goals')}
            className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            Manage
          </Link>
        </div>
        {goalsPreview.length === 0 ? (
          <Link
            to={appPath('goals')}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800/60"
          >
            Add a goal
          </Link>
        ) : (
          <ul className="mt-4 space-y-3">
            {goalsPreview.map((g) => (
              <li key={g._id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-white">{g.title}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {Math.min(100, Math.round(g.progressPct ?? 0))}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/90">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-motion-progress ease-motion-standard"
                    style={{ width: `${Math.min(100, g.progressPct ?? 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {intel &&
      (intel.insights?.length > 0 || intel.suggestion || intel.muscleBalance?.distribution?.some((d) => d.pct > 0)) ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          {intel.insights?.length > 0 ? (
            <section className={`${CARD_MUTED} flex flex-col`} aria-label="Smart insights">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Insights</p>
              <ul className="mt-3 flex flex-1 flex-col gap-2">
                {intel.insights.map((text, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/85"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {intel.suggestion ? (
            <section className={`${CARD_MUTED} flex flex-col`} aria-label="Suggested workout">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Suggested workout
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-200">{intel.suggestion.message}</p>
              {intel.suggestion.exercises?.length ? (
                <p className="mt-3 text-xs text-slate-500">
                  Ideas: {intel.suggestion.exercises.join(' · ')}
                </p>
              ) : null}
              <Link
                to={appPath('workouts/new')}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600/90 px-4 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500"
              >
                Start workout
              </Link>
            </section>
          ) : null}
        </div>
      ) : null}

      {intel?.muscleBalance?.distribution?.some((d) => d.pct > 0) ? (
        <section className={CARD_MUTED} aria-label="Muscle balance">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Muscle balance</p>
          <p className="mt-1 text-xs text-slate-600">
            Last {intel.muscleBalance.windowDays} days · share of volume (kg×reps)
          </p>
          {intel.muscleBalance.hints?.length ? (
            <ul className="mt-3 space-y-1.5">
              {intel.muscleBalance.hints.map((h, i) => (
                <li
                  key={i}
                  className={`text-xs leading-snug ${
                    h.type === 'high' ? 'text-amber-400/95' : 'text-sky-400/95'
                  }`}
                >
                  {h.text}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-2.5">
            {[...intel.muscleBalance.distribution]
              .filter((d) => d.pct > 0)
              .sort((a, b) => b.pct - a.pct)
              .map((d) => (
                <div key={d.key}>
                  <div className="mb-0.5 flex justify-between gap-2 text-xs">
                    <span className="text-slate-500">{d.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">{d.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800/90">
                    <div
                      className="h-full rounded-full transition-[width] duration-motion-progress ease-motion-standard"
                      style={{
                        width: `${Math.min(100, d.pct)}%`,
                        backgroundColor: CHART_FILL[d.key] || '#64748b',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {summary.streak ? (
        <section className={CARD_MUTED} aria-label="Consistency">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <Flame className="h-5 w-5 text-amber-400" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Consistency</p>
              <p className="mt-1 text-lg font-semibold text-white">
                <span className="tabular-nums text-blue-400">{summary.streak.currentDays}</span>
                <span className="font-medium text-slate-400">-day streak</span>
                {summary.streak.currentDays === 0 ? (
                  <span className="text-slate-500"> — log today or yesterday to start</span>
                ) : null}
              </p>
              {recordHint ? <p className="mt-2 text-sm font-medium text-slate-300">{recordHint}</p> : null}
              <p className="mt-2 text-sm text-slate-500">
                Trained on{' '}
                <span className="font-mono text-slate-400">{summary.streak.trainingDaysLast7}</span> of the last 7
                days (your timezone).
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className={CARD_MUTED} aria-label="Weekly volume by category">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              This week — volume by category
            </p>
            <p className="text-xs text-slate-600">Rolling 7 days · {weightUnit}×reps · warm-ups excluded</p>
          </div>
        </div>
        {barChartData.some((d) => d.total > 0) ? (
          <div className="min-h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                  formatter={(value, name) => [Number(value).toLocaleString(), CAT_LABEL[name] || name]}
                />
                {chartCategories.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="vol"
                    fill={CHART_FILL[k]}
                    radius={[0, 0, 0, 0]}
                    name={k}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800/80 pt-3">
              {weekVolumesAll.map(({ key, label, volume }) => (
                <li key={key} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: CHART_FILL[key] }}
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
        ) : weekVolTotal > 0 ? (
          <p className="text-sm text-slate-500">Chart data is loading or unavailable — category totals below.</p>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/20 px-4 py-10 text-center">
            <Dumbbell className="mx-auto h-8 w-8 text-slate-600" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm text-slate-500">No volume this week yet</p>
            <p className="mt-1 text-xs text-slate-600">Complete a workout to see your mix here.</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5 lg:items-stretch">
        <section className={`${CARD_MUTED} flex flex-col`} aria-label="Last session">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last session</p>
          {summary.lastWorkout ? (
            <div className="mt-3 flex-1">
              <p className="text-xl font-semibold text-white">{summary.lastWorkout.title}</p>
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
                <span className="mt-3 inline-block rounded-md bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                  Completed
                </span>
              ) : (
                <span className="mt-3 inline-block rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                  In progress
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 flex-1 text-sm text-slate-500">
              No workouts yet — start with a quick session below.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2">
            <Link
              to={appPath('workouts/new')}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors duration-motion ease-motion-standard hover:bg-blue-500 sm:min-h-11 sm:w-auto sm:min-w-[9rem] sm:py-0"
            >
              New workout
            </Link>
            <Link
              to={appPath('templates')}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-lg border border-slate-600/70 bg-transparent px-4 py-3 text-sm font-medium text-slate-300 transition-colors duration-motion ease-motion-standard hover:border-slate-500 hover:bg-slate-800/40 sm:min-h-11 sm:w-auto sm:py-0"
            >
              From plan
            </Link>
            <Link
              to={appPath('progress')}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-lg border border-slate-600/70 bg-transparent px-4 py-3 text-sm font-medium text-slate-300 transition-colors duration-motion ease-motion-standard hover:border-slate-500 hover:bg-slate-800/40 sm:min-h-11 sm:w-auto sm:py-0"
            >
              View progress
            </Link>
          </div>
        </section>

        <section className={CARD_MUTED} aria-label="Volume trend">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Volume trend</p>
          <p className="mt-1 text-xs text-slate-600">Rolling 7 days · {weightUnit}×reps</p>
          <div className="mt-4 min-h-[200px] w-full min-w-0 flex-1">
            {lineChartData.some((d) => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={lineChartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                    formatter={(value) => [`${Number(value).toLocaleString()} ${weightUnit}×reps`, 'Volume']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#2dd4bf"
                    strokeWidth={2}
                    fill="url(#volFill)"
                    dot={{ r: 3, fill: '#5eead4', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-800/80 text-sm text-slate-600">
                No volume logged this week
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
