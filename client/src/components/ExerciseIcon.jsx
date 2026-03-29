/** Self-hosted PNGs from Flaticon “lineal color” fitness set (thick black outlines, flat fills). License: https://www.flaticon.com/ — see Settings → Credits. */
const ICON_BASE = '/icons/flaticon-exercises';

const CAT_DEFAULT = {
  chest: 'chest',
  back: 'back',
  legs: 'legs',
  shoulders: 'shoulders',
  arms: 'arms',
  core: 'core',
  cardio: 'cardio',
  other: 'other',
};

/** [regex, icon file key] — first match wins; legs before arm “curl”; back before generic. */
const NAME_RULES = [
  [/rowing machine|row\s*erg|concept\s*2|water\s*rower/i, 'swim'],
  [/bike|bicycle|cycle|spin(ning)?\b/i, 'bike'],
  [/swim|pool|freestyle|backstroke|breaststroke/i, 'swim'],
  [
    /run|treadmill|sprint|jog|burpee|jump rope|skipping rope|elliptical|stair\s*master|stairmaster|hiit|assault|ski\s*erg|sled\s*push/i,
    'cardio',
  ],
  [
    /bench|incline press|decline press|chest press|pec deck|push[- ]?up|pushup|\bfly\b|cable crossover|dip\b|crossover/i,
    'chest',
  ],
  [
    /leg curl|leg extension|leg press|squat|lunge|calf|hack squat|glute|adductor|abductor|step[- ]?up|sissy|nordic|split squat|bulgarian|hip thrust|leg abduction|leg adduction/i,
    'legs',
  ],
  [
    /pull[- ]?up|chin[- ]?up|lat pulldown|pulldown|barbell row|bent[- ]over row|cable row|t[- ]?bar row|meadows row|seated row|inverted row|deadlift|romanian deadlift|(?:^|\s)rdl(?:\s|$)|good morning|hyperextension|shrug|face pull|lat pullover|pullover/i,
    'back',
  ],
  [
    /curl|tricep|triceps|bicep|preacher|hammer|skull|pushdown|overhead ext|rope pressdown|wrist curl/i,
    'arms',
  ],
  [/plank|crunch|ab wheel|sit[- ]?up|russian twist|woodchop|pallof|dead bug|hanging knee|toes to bar|l-sit|dragon flag|leg raise/i, 'core'],
  [
    /shoulder press|ohp|military press|arnold|lateral raise|front raise|upright row|rear delt|y[- ]raise|landmine/i,
    'shoulders',
  ],
  [/walk|hike|farmer|carry/i, 'legs'],
];

/**
 * Icon asset key for an exercise name + category (matches `/icons/flaticon-exercises/{key}.png`).
 */
export function resolveExerciseIconKey(name, category = 'other') {
  const n = (name || '').trim().toLowerCase();
  for (const [re, key] of NAME_RULES) {
    if (re.test(n)) return key;
  }
  const cat = String(category || 'other').toLowerCase();
  return CAT_DEFAULT[cat] || CAT_DEFAULT.other;
}

/**
 * @param {{ name: string, category?: string, className?: string, strokeWidth?: number, boxed?: boolean }} props
 */
export default function ExerciseIcon({
  name,
  category = 'other',
  className = 'h-4 w-4 shrink-0 object-contain opacity-[0.92]',
  strokeWidth: _ignored,
  boxed = false,
}) {
  const key = resolveExerciseIconKey(name, category);
  const src = `${ICON_BASE}/${key}.png`;
  const img = (
    <img
      src={src}
      alt=""
      decoding="async"
      loading="lazy"
      className={className}
      aria-hidden
    />
  );
  if (!boxed) return img;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-slate-700/80 [&_img]:max-h-full [&_img]:max-w-full [&_img]:opacity-100"
      aria-hidden
    >
      {img}
    </span>
  );
}
