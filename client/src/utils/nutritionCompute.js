export function safeNonNeg(n, fallback = 0) {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return fallback;
  return x;
}

export function roundCal(n) {
  return Math.round(safeNonNeg(n, 0));
}

export function roundMacro(n) {
  return Math.round(safeNonNeg(n, 0) * 10) / 10;
}

/**
 * Scale per-100g (/100ml approximated as g) nutrition to a portion.
 * @returns {{ calories: number, protein: number, carbs: number, fats: number, fiber: number | null, sugar: number | null, incomplete: boolean }}
 */
export function previewFromPer100g(row, gramsOrMl) {
  const g = safeNonNeg(gramsOrMl, 0);
  if (g <= 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: null,
      sugar: null,
      incomplete: true,
    };
  }
  const scale = g / 100;
  const hasKcal = row?.caloriesPer100g != null && Number.isFinite(Number(row.caloriesPer100g));
  const hasP = row?.proteinPer100g != null && Number.isFinite(Number(row.proteinPer100g));
  const hasC = row?.carbsPer100g != null && Number.isFinite(Number(row.carbsPer100g));
  const hasF = row?.fatsPer100g != null && Number.isFinite(Number(row.fatsPer100g));
  const incomplete = !hasKcal || !hasP || !hasC || !hasF;

  const fiberRaw = row?.fiberPer100g;
  const sugarRaw = row?.sugarPer100g;
  return {
    calories: roundCal(hasKcal ? Number(row.caloriesPer100g) * scale : 0),
    protein: roundMacro(hasP ? Number(row.proteinPer100g) * scale : 0),
    carbs: roundMacro(hasC ? Number(row.carbsPer100g) * scale : 0),
    fats: roundMacro(hasF ? Number(row.fatsPer100g) * scale : 0),
    fiber:
      fiberRaw != null && Number.isFinite(Number(fiberRaw)) ? roundMacro(Number(fiberRaw) * scale) : null,
    sugar:
      sugarRaw != null && Number.isFinite(Number(sugarRaw)) ? roundMacro(Number(sugarRaw) * scale) : null,
    incomplete,
  };
}

export function progressPct(current, target) {
  const t = safeNonNeg(target, 0);
  if (t <= 0) return null;
  return Math.min(100, Math.round((safeNonNeg(current, 0) / t) * 1000) / 10);
}
