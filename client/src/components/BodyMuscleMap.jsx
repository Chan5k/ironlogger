/**
 * Front / back silhouettes with regions keyed to exercise categories.
 * `intensity` values are 0–1 (relative training load for coloring).
 */
function fillForIntensity(t) {
  const x = Math.min(1, Math.max(0, t));
  if (x <= 0) return '#1e293b';
  const r = Math.round(30 + (59 - 30) * x);
  const g = Math.round(41 + (130 - 41) * x);
  const b = Math.round(59 + (246 - 59) * x);
  return `rgb(${r},${g},${b})`;
}

function Region({ d, intensity, title }) {
  return (
    <path
      d={d}
      fill={fillForIntensity(intensity)}
      stroke="#334155"
      strokeWidth={0.6}
      vectorEffect="non-scaling-stroke"
    >
      <title>{title}</title>
    </path>
  );
}

export default function BodyMuscleMap({ intensity = {} }) {
  const c = (key) => intensity[key] ?? 0;

  return (
    <div className="flex flex-wrap items-start justify-center gap-6 md:gap-10">
      <div className="text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Front</p>
        <svg
          viewBox="0 0 100 220"
          className="mx-auto h-[min(55vw,280px)] w-auto max-w-[200px]"
          aria-hidden
        >
          <ellipse cx="50" cy="18" rx="11" ry="13" fill="#334155" stroke="#475569" strokeWidth="0.5" />
          <rect x="46" y="30" width="8" height="7" rx="2" fill="#334155" stroke="#475569" strokeWidth="0.5" />
          <Region
            d="M 50 37 L 62 40 L 64 52 L 58 68 L 42 68 L 36 52 L 38 40 Z"
            intensity={c('chest')}
            title={`Chest — ${(c('chest') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 38 40 L 28 38 L 22 48 L 24 62 L 34 66 L 36 52 Z M 62 40 L 72 38 L 78 48 L 76 62 L 66 66 L 64 52 Z"
            intensity={c('shoulders')}
            title={`Shoulders — ${(c('shoulders') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 22 50 L 14 58 L 12 78 L 18 92 L 24 88 L 26 70 Z M 78 50 L 86 58 L 88 78 L 82 92 L 76 88 L 74 70 Z"
            intensity={c('arms')}
            title={`Arms — ${(c('arms') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 42 68 L 58 68 L 60 102 L 40 102 Z"
            intensity={c('core')}
            title={`Core — ${(c('core') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 40 102 L 48 104 L 46 168 L 38 166 Z M 52 104 L 60 102 L 62 166 L 54 168 Z"
            intensity={c('legs')}
            title={`Legs — ${(c('legs') * 100).toFixed(0)}% relative load`}
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Back</p>
        <svg
          viewBox="0 0 100 220"
          className="mx-auto h-[min(55vw,280px)] w-auto max-w-[200px]"
          aria-hidden
        >
          <ellipse cx="50" cy="18" rx="11" ry="13" fill="#334155" stroke="#475569" strokeWidth="0.5" />
          <rect x="46" y="30" width="8" height="7" rx="2" fill="#334155" stroke="#475569" strokeWidth="0.5" />
          <Region
            d="M 50 37 L 65 42 L 68 58 L 64 78 L 36 78 L 32 58 L 35 42 Z"
            intensity={c('back')}
            title={`Back — ${(c('back') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 35 42 L 24 40 L 18 52 L 22 66 L 32 70 L 32 58 Z M 65 42 L 76 40 L 82 52 L 78 66 L 68 70 L 68 58 Z"
            intensity={c('shoulders')}
            title={`Shoulders — ${(c('shoulders') * 100).toFixed(0)}% relative load`}
          />
          <Region
            d="M 18 54 L 10 64 L 8 84 L 16 96 L 22 90 L 22 70 Z M 82 54 L 90 64 L 92 84 L 84 96 L 78 90 L 78 70 Z"
            intensity={c('arms')}
            title={`Arms — ${(c('arms') * 100).toFixed(0)}% relative load`}
          />
          <path
            d="M 42 78 L 58 78 L 57 100 L 43 100 Z"
            fill="#1e293b"
            stroke="#334155"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          >
            <title>Lower torso</title>
          </path>
          <Region
            d="M 40 100 L 48 102 L 46 168 L 38 166 Z M 52 102 L 60 100 L 62 166 L 54 168 Z"
            intensity={c('legs')}
            title={`Legs — ${(c('legs') * 100).toFixed(0)}% relative load`}
          />
        </svg>
      </div>
    </div>
  );
}
