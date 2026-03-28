/** Epley: weight × (1 + reps/30). Brzycki: weight × 36/(37−reps), reps &lt; 37. */

export function epley1RM(weight, reps) {
  const w = Number(weight);
  const r = Math.floor(Number(reps));
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) return null;
  return w * (1 + r / 30);
}

export function brzycki1RM(weight, reps) {
  const w = Number(weight);
  const r = Math.floor(Number(reps));
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0 || r >= 37) return null;
  return w * (36 / (37 - r));
}

export function bestEstimated1RMFromSets(sets, isCountingSet) {
  let best = null;
  for (const s of sets || []) {
    if (!isCountingSet(s) || !s.completed) continue;
    const w = Number(s.weight) || 0;
    const r = Math.floor(Number(s.reps) || 0);
    if (w <= 0 || r <= 0) continue;
    const e = epley1RM(w, r);
    const b = brzycki1RM(w, r);
    if (e == null) continue;
    const combined = b != null ? (e + b) / 2 : e;
    if (!best || combined > best.combined) {
      best = {
        epley: Math.round(e * 10) / 10,
        brzycki: b != null ? Math.round(b * 10) / 10 : null,
        combined: Math.round(combined * 10) / 10,
        fromWeight: w,
        fromReps: r,
      };
    }
  }
  return best;
}
