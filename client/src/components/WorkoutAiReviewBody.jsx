import { useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';

export function ScoreBadge({ score }) {
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
    <div
      className="animate-ai-stagger-in"
      style={{ animationDelay: `${delay}ms` }}
    >
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

/**
 * Renders normalized workout AI review. Compact by default —
 * summary + score visible, details behind "See more".
 */
export default function WorkoutAiReviewBody({ data, showHeader = true, defaultExpanded = false, className = '' }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!data) return null;

  const well = data.whatWentWell?.length ? data.whatWentWell : data.highlights;
  const improve = data.whatToImprove?.length ? data.whatToImprove : data.risks;
  const how = data.howToImprove?.length ? data.howToImprove : data.coaching;
  const model = modelDisplayName(data._model);
  const hasDetails = well?.length || improve?.length || how?.length;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">AI recap</p>
            {model ? (
              <span className="ml-1 text-[9px] text-slate-600">
                via {model}
              </span>
            ) : null}
          </div>
          <ScoreBadge score={data.score} />
        </div>
      ) : null}

      {data.summary ? (
        <p className="text-[13px] leading-snug text-slate-200">{data.summary}</p>
      ) : null}

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
                {data.contextUsed ? (
                  <p className="animate-ai-stagger-in text-[11px] leading-relaxed text-slate-500">{data.contextUsed}</p>
                ) : null}
                <ListSection title="What went well" items={well} color="text-emerald-300/90" delay={50} />
                <ListSection title="What to improve" items={improve} color="text-amber-200/90" delay={120} />
                <ListSection title="How to improve" items={how} color="text-sky-300/90" delay={190} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
