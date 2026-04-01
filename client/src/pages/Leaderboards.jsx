import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { RankIcon } from '../components/ranks/RankIcon.jsx';

const METRICS = [
  { id: 'volume', label: 'Weekly volume', unit: 'kg×reps' },
  { id: 'workouts', label: 'Workouts', unit: 'sessions (7d)' },
  { id: 'streak', label: 'Streak', unit: '' },
  { id: 'seasonRank', label: 'Season rank', unit: 'monthly ladder' },
];

function formatSeasonEnd(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return '';
  }
}

function SeasonRankGuide({ ladderFromParent }) {
  const [open, setOpen] = useState(false);
  const [fetchedLadder, setFetchedLadder] = useState(null);
  const panelId = 'season-rank-guide-panel';

  useEffect(() => {
    if (ladderFromParent?.length) return;
    if (!open || fetchedLadder?.length) return;
    let cancelled = false;
    api
      .get('/public/season-rank-ladder')
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data?.ladder)) setFetchedLadder(data.ladder);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, ladderFromParent, fetchedLadder]);

  useEffect(() => {
    if (ladderFromParent?.length) setFetchedLadder(null);
  }, [ladderFromParent]);

  const ladderRows = ladderFromParent?.length ? ladderFromParent : fetchedLadder;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#121826]/80 ring-1 ring-slate-800/50">
      <button
        type="button"
        id="season-rank-guide-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-motion ease-motion-standard hover:bg-slate-800/35 motion-reduce:transition-none"
      >
        <span className="text-sm font-medium text-slate-200">How to earn points &amp; rank up</span>
        <span
          className={`shrink-0 text-slate-500 transition-transform duration-motion-out ease-motion-emphasized motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby="season-rank-guide-trigger"
        className={`grid overflow-hidden transition-[grid-template-rows] duration-motion-out ease-motion-standard motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden" aria-hidden={!open}>
          <div
            className={`space-y-4 border-t border-slate-800/80 px-4 pb-4 pt-3 text-sm text-slate-400 transition-[opacity,transform] duration-motion ease-motion-standard motion-reduce:transition-none ${
              open ? 'translate-y-0 opacity-100 delay-75 motion-reduce:delay-0' : '-translate-y-1 opacity-0 delay-0'
            }`}
          >
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Earning points</h3>
              <ul className="list-inside list-disc space-y-1.5 text-slate-400 marker:text-slate-600">
                <li>
                  <span className="text-slate-300">Complete a workout in IronLog</span> — points are granted once when you mark
                  a session finished. It must include at least one{' '}
                  <strong className="font-medium text-slate-300">non-warmup</strong> set with{' '}
                  <strong className="font-medium text-slate-300">at least one rep</strong>. Warmup-only sessions do not count.
                </li>
                <li>
                  <span className="text-slate-300">+24</span> base points per qualifying session.
                </li>
                <li>
                  <span className="text-slate-300">Volume bonus:</span> +1 point per{' '}
                  <strong className="font-medium text-slate-300">400 kg×reps</strong> of non-warmup volume in that session
                  (weights are stored in kg), up to <strong className="font-medium text-slate-300">+40</strong> per session.
                </li>
                <li>
                  <span className="text-slate-300">Daily bonus:</span> the first qualifying session on each{' '}
                  <strong className="font-medium text-slate-300">calendar day</strong> in your account timezone (Settings) earns{' '}
                  <strong className="font-medium text-slate-300">+12</strong>. Later sessions that day still get base + volume,
                  not another daily bonus.
                </li>
                <li>
                  Each session can award points <strong className="font-medium text-slate-300">at most once</strong>, even if
                  you edit it later.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hevy imports</h3>
              <ul className="list-inside list-disc space-y-1.5 text-slate-400 marker:text-slate-600">
                <li>
                  Under <strong className="font-medium text-slate-300">Settings → Import from Hevy</strong>, upload your Hevy
                  CSV export. Each <strong className="font-medium text-slate-300">new</strong> workout (by UTC date + title) is
                  saved as a completed session and earns the <strong className="font-medium text-slate-300">same</strong> season
                  points as logging it manually: base, volume bonus, and daily bonus when the rules above apply.
                </li>
                <li>
                  Imports are processed in <strong className="font-medium text-slate-300">chronological order</strong> so the
                  daily +12 lines up with each session&apos;s calendar day in your timezone.
                </li>
                <li>
                  <strong className="font-medium text-slate-300">Duplicates</strong> (same date + workout name as an import you
                  already have) are skipped and earn no points. Re-uploading the same file within 24 hours is blocked.
                </li>
                <li>
                  Points from imports go to the <strong className="font-medium text-slate-300">current UTC month</strong> season,
                  same as in-app completions.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seasons</h3>
              <p>
                Seasons use <strong className="font-medium text-slate-300">UTC calendar months</strong> (e.g. 1–31 March UTC).
                When a new month starts, your displayed season score resets to{' '}
                <strong className="font-medium text-slate-300">0</strong> until you earn points again. Leaderboards rank by
                points in the current month.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ranks (45 steps)</h3>
              <p>
                There are <strong className="font-medium text-slate-300">45 ranks</strong>:{' '}
                <strong className="font-medium text-slate-300">15 tiers</strong>, each with{' '}
                <strong className="font-medium text-slate-300">3 divisions</strong> (division 3 is the top of that tier). After
                Ultimate Champion, six prestige tiers continue the climb: Astral, Mythic, Celestial, Eternal, Transcendent, and
                Sovereign.                 Your rank follows only <strong className="font-medium text-slate-300">season points</strong> this
                month. Point thresholds are set so tiers unlock a bit sooner than before. The rank ladder below highlights
                your current step.
              </p>
            </section>

            {ladderRows?.length ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Point thresholds (lowest → highest rank)
                </h3>
                <div className="max-h-[min(22rem,60dvh)] overflow-y-auto overscroll-contain rounded-lg border border-slate-800/90 bg-slate-950/40">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="sticky top-0 z-[1] border-b border-slate-800 bg-[#121826] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2 text-right tabular-nums">Min. pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {ladderRows.map((step) => (
                        <tr key={step.index} className="hover:bg-slate-800/30">
                          <td className="px-3 py-1.5 text-slate-300">{step.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                            {step.minPoints.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : open ? (
              <p className="text-xs text-slate-600">Loading ladder…</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeasonLadderPanel({ ladder, viewerRankIndex, viewerSeasonPoints, viewerRankLabel }) {
  const youRowRef = useRef(null);
  const scrollKeyRef = useRef(null);
  const stepsDesc = useMemo(() => [...ladder].reverse(), [ladder]);

  useEffect(() => {
    const key = `${viewerRankIndex}:${ladder.length}`;
    if (scrollKeyRef.current === key) return;
    scrollKeyRef.current = key;
    const id = requestAnimationFrame(() => {
      youRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [viewerRankIndex, ladder.length]);

  if (!ladder?.length) return null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#121826]/95 ring-1 ring-slate-800/50"
      aria-label="Season rank ladder"
    >
      <div className="border-b border-slate-800/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Rank ladder</h2>
        <p className="mt-1 text-xs text-slate-500">
          Highest ranks at the top. Season points (this UTC month) must reach at least the threshold to unlock each rank.
        </p>
        {viewerRankLabel != null ? (
          <p className="mt-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Your placement:</span>{' '}
            {viewerRankLabel}
            <span className="text-slate-600"> · </span>
            {(Number(viewerSeasonPoints) || 0).toLocaleString()} pts this season
          </p>
        ) : null}
      </div>
      <div className="max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain">
        <ul className="divide-y divide-slate-800/60">
          {stepsDesc.map((step) => {
            const isYou = step.index === viewerRankIndex;
            return (
              <li
                key={step.index}
                ref={isYou ? youRowRef : null}
                aria-current={isYou ? 'step' : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-motion ease-motion-standard ${
                  isYou ? 'bg-blue-600/15 ring-1 ring-inset ring-blue-500/25' : 'bg-transparent'
                }`}
              >
                <RankIcon iconId={step.iconId} className="h-8 w-8 shrink-0" title={step.label} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${isYou ? 'text-white' : 'text-slate-200'}`}>
                    {step.label}
                    {isYou ? (
                      <span className="ml-2 rounded-md bg-blue-600/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                        You
                      </span>
                    ) : null}
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-slate-500">
                  ≥ {step.minPoints.toLocaleString()} pts
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function Leaderboards() {
  const { user } = useAuth();
  const [metric, setMetric] = useState('volume');
  const [scope, setScope] = useState('following');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: res } = await api.get('/social/leaderboards', {
        params: { metric, scope, page, limit: 20 },
      });
      setData(res);
    } catch (e) {
      if (e.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setErr(
          'Verify your email to use leaderboards. Check the banner at the top of the app or resend the link from Settings.'
        );
      } else {
        setErr(e.response?.data?.error || 'Could not load leaderboard');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metric, scope, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [metric, scope]);

  function formatValue(row) {
    if (metric === 'volume') return `${Number(row.value).toLocaleString()} kg×reps`;
    if (metric === 'workouts') return `${row.value} workout${row.value !== 1 ? 's' : ''}`;
    if (metric === 'streak') {
      if (scope === 'global') return `${row.value} day${row.value !== 1 ? 's' : ''} trained (7d)`;
      return `${row.value}-day streak`;
    }
    if (metric === 'seasonRank') {
      return `${Number(row.value).toLocaleString()} pts`;
    }
    return String(row.value);
  }

  const metricMeta = METRICS.find((m) => m.id === metric);
  const sr = user?.seasonRank;
  const isSeason = metric === 'seasonRank';
  const vl = isSeason && data?.ladder?.length ? data.viewerLadder : undefined;
  const seasonCard =
    isSeason && (sr?.rankLabel || vl?.rankLabel)
      ? {
          rankLabel: vl?.rankLabel ?? sr?.rankLabel,
          rankIconId: vl?.rankIconId ?? sr?.rankIconId,
          seasonLabel: data?.seasonLabel ?? sr?.seasonLabel,
          seasonPoints: vl?.seasonPoints ?? sr?.seasonPoints,
          seasonEndsAt: data?.seasonEndsAt ?? sr?.seasonEndsAt,
          pointsToNextRank: vl?.pointsToNextRank ?? sr?.pointsToNextRank,
          nextRankLabel: vl?.nextRankLabel ?? sr?.nextRankLabel,
          isMaxRank: vl?.isMaxRank ?? sr?.isMaxRank,
        }
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">Leaderboards</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSeason
            ? 'Season rank uses a UTC calendar month. Only signed-in athletes appear once they earn points.'
            : 'Rolling 7-day window. Following includes you and people you follow.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-motion ease-motion-standard ${
              metric === m.id
                ? 'bg-blue-600/15 text-white ring-1 ring-blue-500/30'
                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {isSeason ? <SeasonRankGuide ladderFromParent={data?.ladder ?? null} /> : null}

      {seasonCard ? (
        <div className="rounded-xl border border-slate-800/90 bg-[#121826]/95 px-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <RankIcon iconId={seasonCard.rankIconId} className="h-12 w-12" title={seasonCard.rankLabel} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your season</p>
              <p className="text-sm font-medium text-white">{seasonCard.seasonLabel ?? ''}</p>
              <p className="mt-0.5 text-sm text-slate-400">
                <span className="text-slate-200">{seasonCard.rankLabel}</span>
                <span className="mx-1.5 text-slate-600">·</span>
                {(Number(seasonCard.seasonPoints) || 0).toLocaleString()} pts
                {!seasonCard.isMaxRank && seasonCard.nextRankLabel ? (
                  <span className="text-slate-500">
                    {' '}
                    · {seasonCard.pointsToNextRank} to {seasonCard.nextRankLabel}
                  </span>
                ) : null}
              </p>
              {seasonCard.seasonEndsAt ? (
                <p className="mt-1 text-xs text-slate-600">Resets {formatSeasonEnd(seasonCard.seasonEndsAt)} (UTC)</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isSeason && !loading && !err && data?.ladder?.length ? (
        <SeasonLadderPanel
          ladder={data.ladder}
          viewerRankIndex={data.viewerLadder?.rankIndex ?? sr?.rankIndex ?? 0}
          viewerSeasonPoints={data.viewerLadder?.seasonPoints ?? sr?.seasonPoints ?? 0}
          viewerRankLabel={data.viewerLadder?.rankLabel ?? sr?.rankLabel ?? null}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'following', label: 'Following' },
          { id: 'global', label: 'Global' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-motion ease-motion-standard ${
              scope === s.id
                ? 'bg-slate-800 text-white ring-1 ring-slate-600/50'
                : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isSeason && data?.seasonLabel ? (
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-300">{data.seasonLabel}</span>
          {data.seasonEndsAt ? (
            <span className="text-slate-600"> · ends {formatSeasonEnd(data.seasonEndsAt)} UTC</span>
          ) : null}
        </p>
      ) : null}

      {!isSeason && data?.metricNote ? (
        <p className="text-xs text-slate-500">{data.metricNote}</p>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {!loading && !err && data?.entries?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/80 bg-[#0f141d]/50 px-6 py-10 text-center text-sm text-slate-500">
          {isSeason
            ? 'No season points yet in this view. Complete a workout to climb the ladder.'
            : 'No entries yet for this view. Log a workout or follow friends to compare.'}
        </div>
      ) : null}

      {!loading && data?.entries?.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#121826]/95">
          <div className="border-b border-slate-800/80 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {metricMeta?.label}
            {metricMeta?.unit ? (
              <span className="ml-2 font-normal normal-case text-slate-600">· {metricMeta.unit}</span>
            ) : null}
          </div>
          <ul className="divide-y divide-slate-800/80">
            {data.entries.map((row) => (
              <li
                key={row.userId}
                className={`flex items-center gap-3 px-4 py-3 transition-colors duration-motion ease-motion-standard ${
                  row.isViewer ? 'bg-blue-600/10' : ''
                }`}
              >
                <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500">
                  {row.rank}
                </span>
                {isSeason && row.rankIconId ? (
                  <RankIcon
                    iconId={row.rankIconId}
                    className="h-9 w-9 shrink-0"
                    title={row.rankLabel}
                  />
                ) : (
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      row.isViewer
                        ? 'bg-blue-600/30 text-blue-100 ring-1 ring-blue-500/40'
                        : 'bg-slate-700/80 text-slate-200 ring-1 ring-slate-600/50'
                    }`}
                  >
                    {row.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {row.name}
                    {row.isViewer ? (
                      <span className="ml-2 text-xs font-normal text-blue-400/90">You</span>
                    ) : null}
                  </p>
                  {isSeason && row.rankLabel ? (
                    <p className="truncate text-xs text-slate-500">{row.rankLabel}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums text-slate-300">
                  {formatValue(row)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-600">
              Page {page}
              {data?.totalUsers != null ? ` · ${data.totalUsers} athletes` : ''}
            </span>
            <button
              type="button"
              disabled={!data?.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
