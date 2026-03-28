/** Weights are stored in kg on the server; these helpers convert for lbs display/input. */
export const LBS_PER_KG = 2.2046226218487757;

export function normalizeWeightUnit(u) {
  return u === 'lbs' ? 'lbs' : 'kg';
}

export function kgToLbs(kg) {
  return (Number(kg) || 0) * LBS_PER_KG;
}

export function lbsToKg(lbs) {
  return (Number(lbs) || 0) / LBS_PER_KG;
}

/** Value shown in workout/template weight inputs (stored kg → display string). */
export function formatWeightInputValue(kg, unit) {
  const u = normalizeWeightUnit(unit);
  if (u === 'lbs') {
    const v = kgToLbs(kg);
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  const v = Number(kg) || 0;
  const r = Math.round(v * 100) / 100;
  return String(r);
}

/** Parse input in user's unit → kg for API/state. */
export function parseWeightInput(str, unit) {
  const n = parseFloat(String(str).replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return 0;
  return normalizeWeightUnit(unit) === 'lbs' ? lbsToKg(n) : n;
}
