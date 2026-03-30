import { normalizeSetType } from '../constants/setTypes.js';

/**
 * Compare one completed working set against historical baselines from the server.
 * @param {{ maxWeight?: number, maxSetVolume?: number, repsByWeight?: Record<string, number> } | undefined} baseline
 * @param {number} weight
 * @param {number} reps
 * @returns {{ kind: 'weight' | 'volume' | 'reps', headline: string } | null}
 */
export function evaluateSetPr(baseline, weight, reps) {
  const w = Number(weight) || 0;
  const r = Math.floor(Number(reps) || 0);
  if (w <= 0 && r <= 0) return null;

  const maxW = baseline?.maxWeight ?? 0;
  const maxVol = baseline?.maxSetVolume ?? 0;
  const vol = w * r;
  const rbw = baseline?.repsByWeight && typeof baseline.repsByWeight === 'object' ? baseline.repsByWeight : {};
  const key = String(w);
  const prevBestRepsAtW = rbw[key];

  if (w > maxW) {
    return {
      kind: 'weight',
      headline: maxW > 0 ? `New max — ${w} kg (+${Math.round(w - maxW)} kg)` : `New max — ${w} kg`,
    };
  }
  if (vol > maxVol) {
    return {
      kind: 'volume',
      headline:
        maxVol > 0
          ? `Best set volume — ${Math.round(vol)} kg (+${Math.round(vol - maxVol)} kg)`
          : `Best set volume — ${Math.round(vol)} kg`,
    };
  }
  if (prevBestRepsAtW != null && r > prevBestRepsAtW) {
    return {
      kind: 'reps',
      headline: `More reps at ${w} kg — ${r} (+${r - prevBestRepsAtW})`,
    };
  }
  return null;
}

/** Combine server history with in-session completed sets (same exercise). */
export function mergeTwoBaselines(serverB, sessionB) {
  const a = serverB || { maxWeight: 0, maxSetVolume: 0, repsByWeight: {} };
  const b = sessionB || { maxWeight: 0, maxSetVolume: 0, repsByWeight: {} };
  const repsByWeight = { ...(a.repsByWeight || {}) };
  for (const [k, v] of Object.entries(b.repsByWeight || {})) {
    repsByWeight[k] = Math.max(repsByWeight[k] || 0, v);
  }
  return {
    maxWeight: Math.max(a.maxWeight ?? 0, b.maxWeight ?? 0),
    maxSetVolume: Math.max(a.maxSetVolume ?? 0, b.maxSetVolume ?? 0),
    repsByWeight,
  };
}

/**
 * Merge a completed set into baselines so the same session does not re-trigger PRs.
 */
/** Map exercise `_local` id → rolling baseline from already-completed working sets in that exercise. */
export function sessionBaselineMapFromExercises(exercises) {
  const next = {};
  for (const ex of exercises || []) {
    let cum;
    for (const s of ex.sets || []) {
      const st = normalizeSetType(s.setType);
      if (st === 'warmup' || !s.completed) continue;
      cum = mergeSetIntoBaseline(cum, s.weight, s.reps);
    }
    if (
      cum &&
      (cum.maxWeight > 0 ||
        cum.maxSetVolume > 0 ||
        Object.keys(cum.repsByWeight || {}).length > 0)
    ) {
      next[ex._local] = cum;
    }
  }
  return next;
}

export function mergeSetIntoBaseline(baseline, weight, reps) {
  const w = Number(weight) || 0;
  const r = Math.floor(Number(reps) || 0);
  const vol = w * r;
  const key = String(w);
  const rbw = { ...(baseline?.repsByWeight || {}) };
  rbw[key] = Math.max(rbw[key] || 0, r);
  return {
    maxWeight: Math.max(baseline?.maxWeight ?? 0, w),
    maxSetVolume: Math.max(baseline?.maxSetVolume ?? 0, vol),
    repsByWeight: rbw,
  };
}
