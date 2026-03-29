import { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';

const METRICS = [
  { id: 'volume', label: 'Weekly volume', unit: 'kg×reps' },
  { id: 'workouts', label: 'Workouts', unit: 'sessions (7d)' },
  { id: 'streak', label: 'Streak', unit: '' },
];

export default function Leaderboards() {
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
      setErr(e.response?.data?.error || 'Could not load leaderboard');
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
    return String(row.value);
  }

  const metricMeta = METRICS.find((m) => m.id === metric);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">Leaderboards</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rolling 7-day window. Following includes you and people you follow.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              metric === m.id
                ? 'bg-blue-600/15 text-white ring-1 ring-blue-500/30'
                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'following', label: 'Following' },
          { id: 'global', label: 'Global' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              scope === s.id
                ? 'bg-slate-800 text-white ring-1 ring-slate-600/50'
                : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {data?.metricNote ? (
        <p className="text-xs text-slate-500">{data.metricNote}</p>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {!loading && !err && data?.entries?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/80 bg-[#0f141d]/50 px-6 py-10 text-center text-sm text-slate-500">
          No entries yet for this view. Log a workout or follow friends to compare.
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
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  row.isViewer ? 'bg-blue-600/10' : ''
                }`}
              >
                <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500">
                  {row.rank}
                </span>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    row.isViewer
                      ? 'bg-blue-600/30 text-blue-100 ring-1 ring-blue-500/40'
                      : 'bg-slate-700/80 text-slate-200 ring-1 ring-slate-600/50'
                  }`}
                >
                  {row.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {row.name}
                    {row.isViewer ? (
                      <span className="ml-2 text-xs font-normal text-blue-400/90">You</span>
                    ) : null}
                  </p>
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
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
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
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
