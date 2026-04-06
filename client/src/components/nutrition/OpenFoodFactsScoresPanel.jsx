/**
 * Nutri-Score, Eco-Score, and NOVA from Open Food Facts (letter colors: common public palette;
 * not official trademarked logo assets).
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

function normalizeNova(n) {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 4) return null;
  return Math.round(v);
}

const NOVA_HINT = {
  1: 'Unprocessed / minimally processed',
  2: 'Processed culinary ingredients',
  3: 'Processed foods',
  4: 'Ultra-processed foods',
};

/**
 * @param {{
 *   nutriScore?: string | null,
 *   nutriScorePoints?: number | null,
 *   nutriScoreVersion?: string | null,
 *   ecoScore?: string | null,
 *   ecoScorePoints?: number | null,
 *   novaGroup?: number | null,
 *   animated?: boolean,
 *   className?: string,
 * }} props
 */
export default function OpenFoodFactsScoresPanel({
  nutriScore,
  nutriScorePoints,
  nutriScoreVersion,
  ecoScore,
  ecoScorePoints,
  novaGroup,
  animated = false,
  className = '',
}) {
  const nutri = normalizeGrade(nutriScore);
  const eco = normalizeGrade(ecoScore);
  const nova = normalizeNova(novaGroup);

  const nutriStyle = nutri ? GRADE_STYLE[nutri] : { backgroundColor: '#475569', color: '#f8fafc' };
  const ecoStyle = eco ? GRADE_STYLE[eco] : null;

  const hasNutriLetter = nutri != null;
  const hasNutriPoints = nutriScorePoints != null && Number.isFinite(Number(nutriScorePoints));
  const hasEco = eco != null;
  const hasNova = nova != null;

  if (!hasNutriLetter && !hasNutriPoints && !hasEco && !hasNova) {
    return (
      <div
        className={`rounded-xl border border-slate-200/80 bg-slate-500/10 px-3 py-3 dark:border-slate-700/80 ${animated ? 'motion-reduce:animate-none animate-off-score-reveal' : ''} ${className}`.trim()}
      >
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Open Food Facts
        </p>
        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          No Nutri-Score, Eco-Score, or NOVA data for this product yet.
        </p>
      </div>
    );
  }

  const nutriTip = [
    nutri ? `Nutri-Score ${nutri}` : 'Nutri-Score not available',
    nutriScorePoints != null && Number.isFinite(Number(nutriScorePoints))
      ? `score ${nutriScorePoints} (Open Food Facts)`
      : null,
    nutriScoreVersion ? `version ${nutriScoreVersion}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-900/40 to-slate-900/60 px-3 py-3 shadow-inner dark:from-emerald-950/40 dark:via-slate-950/50 dark:to-slate-950/70 ${animated ? 'motion-reduce:animate-none animate-off-score-reveal' : ''} ${className}`.trim()}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90 dark:text-emerald-300/90">
        Open Food Facts
      </p>

      <div className="mt-3 flex flex-wrap items-stretch justify-center gap-3">
        {/* Nutri-Score — hero */}
        <div
          className="flex min-w-[7rem] flex-1 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/20 px-2 py-2 sm:min-w-[8rem]"
          title={nutriTip}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Nutri-Score</span>
          <span
            className={`mt-1 inline-flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-black tabular-nums shadow-lg ring-2 ring-white/10 sm:h-16 sm:w-16 sm:text-3xl ${animated ? 'motion-reduce:animate-none animate-off-nutri-pop' : ''}`}
            style={nutriStyle}
            aria-label={nutriTip}
          >
            {nutri || '—'}
          </span>
          {nutriScorePoints != null && Number.isFinite(Number(nutriScorePoints)) ? (
            <span className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-300">
              {Number(nutriScorePoints) > 0 ? '+' : ''}
              {nutriScorePoints}
            </span>
          ) : (
            <span className="mt-1.5 text-[10px] text-slate-500">{nutri ? 'points n/a' : 'not computed'}</span>
          )}
        </div>

        {ecoStyle ? (
          <div
            className={`flex min-w-[5rem] flex-col items-center justify-center rounded-lg border border-white/10 bg-black/15 px-2 py-2 ${animated ? 'motion-reduce:animate-none animate-off-chip-pop' : ''}`}
            style={{ animationDelay: animated ? '80ms' : undefined }}
            title={
              ecoScorePoints != null && Number.isFinite(Number(ecoScorePoints))
                ? `Eco-Score ${eco} · ${ecoScorePoints}`
                : `Eco-Score ${eco}`
            }
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Eco-Score</span>
            <span
              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold shadow-md ring-1 ring-black/10"
              style={ecoStyle}
            >
              {eco}
            </span>
            {ecoScorePoints != null && Number.isFinite(Number(ecoScorePoints)) ? (
              <span className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">{ecoScorePoints}</span>
            ) : null}
          </div>
        ) : null}

        {nova != null ? (
          <div
            className={`flex min-w-[5.5rem] flex-col items-center justify-center rounded-lg border border-white/10 bg-black/15 px-2 py-2 ${animated ? 'motion-reduce:animate-none animate-off-chip-pop' : ''}`}
            style={{ animationDelay: animated ? '140ms' : undefined }}
            title={NOVA_HINT[nova] || `NOVA ${nova}`}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">NOVA</span>
            <span
              className={`mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-lg font-black tabular-nums shadow-md ring-1 ring-black/10 ${
                nova === 1
                  ? 'bg-emerald-600 text-white'
                  : nova === 2
                    ? 'bg-lime-500 text-slate-900'
                    : nova === 3
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-red-600 text-white'
              }`}
            >
              {nova}
            </span>
            <span className="mt-1 max-w-[6rem] text-center text-[9px] leading-tight text-slate-500">
              {NOVA_HINT[nova]?.split(' / ')[0] ?? ''}
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-center text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Scores come from community data on Open Food Facts.
      </p>
    </div>
  );
}
