/** Sum of weight × reps for non–warm-up sets (stored weights in kg). */
export function totalVolumeKgNonWarmup(workout) {
  let v = 0;
  for (const ex of workout?.exercises || []) {
    for (const s of ex.sets || []) {
      const t = s?.setType || 'normal';
      if (t === 'warmup') continue;
      v += (Number(s.weight) || 0) * (Number(s.reps) || 0);
    }
  }
  return Math.round(v);
}
