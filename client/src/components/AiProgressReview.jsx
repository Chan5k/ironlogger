import { useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import api from '../api/client.js';

function ScoreBadge({ score }) {
  const s = Number(score) || 0;
  const color =
    s >= 80
      ? 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
      : s >= 60
        ? 'text-amber-400 bg-amber-500/10 ring-amber-500/20'
        : 'text-rose-400 bg-rose-500/10 ring-rose-500/20';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${color}`}
    >
      {s}/100
    </span>
  );
}

function ListSection({ title, items, color = 'text-slate-300', delay = 0 }) {
  if (!items?.length) return null;
  return (
    <div className="animate-ai-stagger-in" style={{ animationDelay: `${delay}ms` }}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-[13px] leading-snug ${color}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function modelDisplayName(id) {
  if (!id) return null;
  const clean = id.replace(/:free$/, '');
  const slash = clean.lastIndexOf('/');
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

const RANGE_OPTIONS = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
];

export default function AiProgressReview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState(false);

  async function fetchReview(d) {
    setLoading(true);
    setErr('');
    setData(null);
    setExpanded(false);
    try {
      const { data: res } = await api.post('/ai/review-progress', { days: d });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not generate progress review');
    } finally {
      setLoading(false);
    }
  }

  function changeDays(d) {
    setDays(d);
    if (data || err) fetchReview(d);
  }

  const model = data ? modelDisplayName(data._model) : null;
  const hasDetails =
    data &&
    (data.deeperInsight || data.progressWins?.length || data.concerns?.length || data.coaching?.length || data.nextFocus);

  return (
    <div className="space-y-3 rounded-xl border border-slate-800/90 bg-[#0f141d]/90 p-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            AI progress review
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeDays(opt.value)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                days === opt.value
                  ? 'bg-violet-600/20 text-violet-200 ring-1 ring-violet-500/30'
                  : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* trigger */}
      {!data && !loading && !err ? (
        <button
          type="button"
          onClick={() => fetchReview(days)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-700/50 bg-violet-950/25 px-4 py-2.5 text-sm font-medium text-violet-200 transition-all duration-200 hover:bg-violet-950/40 hover:shadow-md hover:shadow-violet-900/20 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Generate review
        </button>
      ) : null}

      {/* loading */}
      {loading ? (
        <div className="animate-ai-stagger-in flex items-center gap-3 py-3">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-violet-400"
            aria-hidden
          />
          <p className="text-sm text-slate-400">Analysing your training…</p>
        </div>
      ) : null}

      {/* error */}
      {err && !loading ? (
        <div className="animate-ai-stagger-in rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2.5">
          <p className="text-sm text-red-400">{err}</p>
          <button
            type="button"
            onClick={() => fetchReview(days)}
            className="mt-1.5 text-xs text-red-300 underline transition-colors hover:text-red-200 active:scale-[0.97]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* result */}
      {data && !loading ? (
        <div className="animate-ai-stagger-in space-y-2.5">
          {/* compact: summary + score + model */}
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 text-[13px] leading-snug text-slate-200">{data.summary}</p>
            <ScoreBadge score={data.score} />
          </div>
          {model ? (
            <p className="text-[9px] text-slate-600">
              via {model}
            </p>
          ) : null}

          {/* see more / see less */}
          {hasDetails ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-violet-200 active:scale-95"
              >
                {expanded ? 'See less' : 'See more'}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 pt-1 pb-0.5">
                    {data.deeperInsight ? (
                      <div className="animate-ai-stagger-in rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Pattern insight
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-slate-300">{data.deeperInsight}</p>
                      </div>
                    ) : null}
                    <ListSection title="Progress wins" items={data.progressWins} color="text-emerald-300/90" delay={50} />
                    <ListSection title="Areas to watch" items={data.concerns} color="text-amber-200/90" delay={120} />
                    <ListSection title="Coaching" items={data.coaching} color="text-sky-300/90" delay={190} />
                    {data.nextFocus ? (
                      <div
                        className="animate-ai-stagger-in rounded-lg border border-blue-800/40 bg-blue-950/20 px-3 py-2"
                        style={{ animationDelay: '260ms' }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next focus</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-blue-200">{data.nextFocus}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
