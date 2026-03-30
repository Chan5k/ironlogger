import { normalizeSetType } from '../constants/setTypes.js';
import { evaluateSetPr, mergeSetIntoBaseline } from './prBaseline.js';
import { LBS_PER_KG } from './weightUnits.js';

const CAT_LABEL = {
  chest: 'Push / chest',
  back: 'Pull / back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  other: 'Mixed',
};

/**
 * Guess workout style for share card from title + exercise categories.
 */
export function inferWorkoutKind(title, exercises) {
  const t = (title || '').toLowerCase();
  if (/\bpush\b/.test(t)) return 'Push';
  if (/\bpull\b/.test(t)) return 'Pull';
  if (/\bleg\b/.test(t)) return 'Legs';
  if (/\bppl\b|\bppp\b/.test(t)) return 'PPL';
  if (/\bupper\b/.test(t)) return 'Upper';
  if (/\blower\b/.test(t)) return 'Lower';
  if (/\bfull\b|\bwhole\b/.test(t)) return 'Full body';
  if (/\bcardio\b|\bhiit\b/.test(t)) return 'Cardio / HIIT';

  const vol = {};
  for (const ex of exercises || []) {
    const c = ex.category || 'other';
    vol[c] = (vol[c] || 0) + 1;
  }
  let best = 'other';
  let n = 0;
  for (const [k, v] of Object.entries(vol)) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return CAT_LABEL[best] || 'Workout';
}

export function computeWorkoutShareStats(exercises, prBaselines, weightUnit) {
  let volumeKg = 0;
  let setCount = 0;
  const prLines = [];
  const seenPr = new Set();
  const volByEx = [];

  for (let ei = 0; ei < (exercises || []).length; ei++) {
    const ex = exercises[ei];
    let ev = 0;
    const base = prBaselines[ei];
    let cum = {
      maxWeight: base?.maxWeight ?? 0,
      maxSetVolume: base?.maxSetVolume ?? 0,
      repsByWeight: { ...(base?.repsByWeight || {}) },
    };
    for (const s of ex.sets || []) {
      const st = normalizeSetType(s.setType);
      if (st === 'warmup') continue;
      if (s.completed) setCount += 1;
      ev += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      const wNum = Number(s.weight) || 0;
      const rNum = Math.floor(Number(s.reps) || 0);
      if (s.completed && evaluateSetPr(cum, wNum, rNum)) {
        const name = (ex.name || 'Lift').trim() || 'Lift';
        if (!seenPr.has(name)) {
          seenPr.add(name);
          prLines.push(`🔥 New PR on ${name}`);
        }
      }
      if (s.completed) {
        cum = mergeSetIntoBaseline(cum, wNum, rNum);
      }
    }
    volumeKg += ev;
    volByEx.push({ name: (ex.name || '').trim() || 'Exercise', volume: ev });
  }

  volByEx.sort((a, b) => b.volume - a.volume);
  const topRaw = volByEx.filter((x) => x.volume > 0).slice(0, 5);
  const topExercises = topRaw.map((x) => ({
    name: x.name,
    volume: weightUnit === 'lbs' ? Math.round(x.volume * LBS_PER_KG) : Math.round(x.volume),
  }));

  const displayVolume =
    weightUnit === 'lbs' ? Math.round(volumeKg * LBS_PER_KG) : Math.round(volumeKg);

  return { displayVolume, setCount, prLines, topExercises };
}
