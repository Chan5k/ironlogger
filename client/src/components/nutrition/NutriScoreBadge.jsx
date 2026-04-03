/**
 * Nutri-Score letter (A–E) from Open Food Facts product data.
 * Letter colors follow the common public palette; not the official trademarked logo asset.
 */
const GRADE_STYLE = {
  A: { backgroundColor: '#038141', color: '#ffffff' },
  B: { backgroundColor: '#85BB2F', color: '#0f172a' },
  C: { backgroundColor: '#FECB02', color: '#0f172a' },
  D: { backgroundColor: '#EE8100', color: '#ffffff' },
  E: { backgroundColor: '#E63E11', color: '#ffffff' },
};

function normalizeGrade(g) {
  if (g == null) return null;
  const ch = String(g).trim().toUpperCase().charAt(0);
  return 'ABCDE'.includes(ch) ? ch : null;
}

export default function NutriScoreBadge({ grade, points, version, className = '' }) {
  const g = normalizeGrade(grade);
  if (!g) return null;
  const style = GRADE_STYLE[g] || { backgroundColor: '#64748b', color: '#fff' };

  const tip = [
    `Nutri-Score ${g}`,
    points != null && Number.isFinite(Number(points)) ? `score ${points} (from Open Food Facts)` : null,
    version ? `version ${version}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ${className}`.trim()}
      title={tip}
    >
      <span
        className="inline-flex min-h-[1.75rem] min-w-[1.75rem] items-center justify-center rounded-md text-sm font-bold tabular-nums shadow-sm ring-1 ring-black/10"
        style={style}
        aria-label={tip}
      >
        {g}
      </span>
      <span>
        Nutri-Score <span className="text-slate-400 dark:text-slate-500">(Open Food Facts)</span>
      </span>
    </div>
  );
}
