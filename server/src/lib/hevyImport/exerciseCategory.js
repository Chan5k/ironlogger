import Exercise, { EXERCISE_CATEGORIES } from '../../models/Exercise.js';

/** @param {string} s */
export function normalizeExerciseNameKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Variants to match library (e.g. strip "(Machine)"). */
function lookupKeysForName(name) {
  const raw = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const keys = new Set();
  if (raw) keys.add(raw);
  const noParen = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParen) keys.add(noParen);
  const simplified = normalizeExerciseNameKey(name);
  if (simplified) keys.add(simplified);
  return [...keys];
}

/**
 * Heuristic category from free-text exercise names (Hevy / unknown library match).
 * @param {string} name
 * @returns {string}
 */
export function inferCategoryFromExerciseName(name) {
  const s = normalizeExerciseNameKey(name);
  if (!s) return 'other';

  /** @type {Array<[string, RegExp[]]>} */
  const ordered = [
    [
      'cardio',
      [
        /^(bike|run|jog|rowing|rower|elliptical|treadmill|stair|jump rope|skipping|assault|airdyne|spin|cycle)$/i,
        /\b(treadmill|elliptical|rowing machine|stationary bike|spin class|hiit cardio|jump rope|battle rope)\b/i,
        /\b(cardio|warmup walk|incline walk)\b/i,
      ],
    ],
    [
      'core',
      [
        /\b(plank|crunch|sit[- ]?up|ab wheel|hanging leg|leg raise|russian twist|pallof|dead bug|bird dog|l sit|l-sit|cable crunch|woodchop)\b/i,
        /\b(abs?|oblique|core)\b.*\b(rotation|twist)\b/i,
      ],
    ],
    [
      'arms',
      [
        /\b(curl|bicep|tricep|triceps|skull|hammer|preacher|concentration|wrist|forearm|nordic curl arm)\b/i,
        /\b(close[- ]grip|cg)\b.*\b(bench|push)\b/i,
        /\b(overhead extension|pushdown|rope push)\b/i,
      ],
    ],
    [
      'shoulders',
      [
        /\b(shoulder|ohp|overhead press|military press|arnold|lateral raise|front raise|rear delt|face pull|upright row)\b/i,
        /\b(delt|deltoid)\b/i,
      ],
    ],
    [
      'chest',
      [
        /\b(bench|fly|pec deck|chest press|push[- ]?up|pushup|dip)\b/i,
        /\b(incline|decline)\b.*\b(press|bench)\b/i,
        /\b(crossover|cable fly)\b/i,
      ],
    ],
    [
      'legs',
      [
        /\b(squat|leg press|leg curl|leg extension|lunge|split squat|hack squat|sissy|goblet squat|front squat|box squat)\b/i,
        /\b(calf|calves|hip thrust|glute bridge|adductor|abductor|nordic hamstring|hamstring curl)\b/i,
        /\b(rdl|romanian deadlift|stiff[- ]leg)\b/i,
        /\b(smith machine)\b.*\b(squat|lunge)\b/i,
      ],
    ],
    [
      'back',
      [
        /\b(pulldown|pull[- ]?up|chin[- ]?up|lat |lat pulldown|low row|seated row|cable row|barbell row|dumbbell row|t-bar|meadows row|pendlay)\b/i,
        /\b(deadlift|sumo deadlift|rack pull|shrug|hyperextension|back extension|good morning|pullover)\b/i,
        /\b(rhomboid|trap bar row)\b/i,
      ],
    ],
  ];

  for (const [cat, patterns] of ordered) {
    if (patterns.some((p) => p.test(s))) return cat;
  }
  return 'other';
}

/**
 * Build a resolver that uses the exercise library (global + user) then heuristics.
 * @param {import('mongoose').Types.ObjectId|string} userId
 */
export async function buildHevyCategoryResolver(userId) {
  const rows = await Exercise.find({
    $or: [{ isGlobal: true }, { userId }],
  })
    .select('name category')
    .lean();

  /** @type {Map<string, string>} */
  const map = new Map();
  for (const r of rows) {
    const cat = r.category;
    if (!EXERCISE_CATEGORIES.includes(cat)) continue;
    for (const k of lookupKeysForName(r.name)) {
      if (k && !map.has(k)) map.set(k, cat);
    }
  }

  return (/** @type {string} */ exerciseName) => {
    for (const k of lookupKeysForName(exerciseName)) {
      const hit = map.get(k);
      if (hit) return hit;
    }
    return inferCategoryFromExerciseName(exerciseName);
  };
}
