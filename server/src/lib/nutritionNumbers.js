/**
 * Safe nutrition math: no NaN/Infinity, sensible rounding, totals from logged rows.
 */

const EPS = 1e-9;

export function safeNonNegativeNumber(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Round for storage / API (1 decimal for macros, 0 for kcal is ok — use 1 for consistency). */
export function roundMacro(n) {
  const x = safeNonNegativeNumber(n, 0);
  return Math.round(x * 10 + EPS) / 10;
}

export function roundCalories(n) {
  const x = safeNonNegativeNumber(n, 0);
  return Math.round(x + EPS);
}

/**
 * Scale per-100g (or per-100ml treated like g) values to an actual portion.
 * @param {number} per100
 * @param {number} gramsOrMl amount consumed
 */
export function scalePer100ToPortion(per100, gramsOrMl) {
  const p = safeNonNegativeNumber(per100, 0);
  const g = safeNonNegativeNumber(gramsOrMl, 0);
  if (g <= 0) return 0;
  return p * (g / 100);
}

export function computeTotalsFromFoods(foods) {
  const out = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    sugar: 0,
  };
  if (!Array.isArray(foods)) return sanitizeTotals(out);
  for (const f of foods) {
    out.calories += safeNonNegativeNumber(f?.calories, 0);
    out.protein += safeNonNegativeNumber(f?.protein, 0);
    out.carbs += safeNonNegativeNumber(f?.carbs, 0);
    out.fats += safeNonNegativeNumber(f?.fats, 0);
    if (f?.fiber != null && Number.isFinite(Number(f.fiber))) out.fiber += Math.max(0, Number(f.fiber));
    if (f?.sugar != null && Number.isFinite(Number(f.sugar))) out.sugar += Math.max(0, Number(f.sugar));
  }
  return sanitizeTotals(out);
}

export function sanitizeTotals(t) {
  return {
    calories: roundCalories(t.calories),
    protein: roundMacro(t.protein),
    carbs: roundMacro(t.carbs),
    fats: roundMacro(t.fats),
    fiber: roundMacro(t.fiber),
    sugar: roundMacro(t.sugar),
  };
}

export function sanitizeFoodEntryPayload(raw) {
  const fiber =
    raw.fiber === undefined || raw.fiber === null || raw.fiber === ''
      ? null
      : roundMacro(safeNonNegativeNumber(raw.fiber, 0));
  const sugar =
    raw.sugar === undefined || raw.sugar === null || raw.sugar === ''
      ? null
      : roundMacro(safeNonNegativeNumber(raw.sugar, 0));
  return {
    amount: roundMacro(safeNonNegativeNumber(raw.amount, 0)),
    unit: String(raw.unit || '').trim().slice(0, 32),
    grams:
      raw.grams === undefined || raw.grams === null || raw.grams === ''
        ? null
        : roundMacro(safeNonNegativeNumber(raw.grams, 0)),
    calories: roundCalories(raw.calories),
    protein: roundMacro(raw.protein),
    carbs: roundMacro(raw.carbs),
    fats: roundMacro(raw.fats),
    fiber,
    sugar,
  };
}
