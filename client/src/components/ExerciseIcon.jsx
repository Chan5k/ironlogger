import {
  Activity,
  ArrowBigDown,
  Bike,
  ChevronsUp,
  Dumbbell,
  Footprints,
  HeartPulse,
  Link2,
  StretchHorizontal,
  Target,
  Waves,
} from 'lucide-react';

const CAT_DEFAULT = {
  chest: StretchHorizontal,
  back: ArrowBigDown,
  legs: Footprints,
  shoulders: ChevronsUp,
  arms: Link2,
  core: Target,
  cardio: HeartPulse,
  other: Dumbbell,
};

/** [regex, Icon] — first match wins; legs before arm “curl”; back before generic. */
const NAME_RULES = [
  [/rowing machine|row\s*erg|concept\s*2|water\s*rower/i, Waves],
  [/bike|bicycle|cycle|spin(ning)?\b/i, Bike],
  [/swim|pool|freestyle|backstroke|breaststroke/i, Waves],
  [
    /run|treadmill|sprint|jog|burpee|jump rope|skipping rope|elliptical|stair\s*master|stairmaster|hiit|assault|ski\s*erg|sled\s*push/i,
    HeartPulse,
  ],
  [
    /bench|incline press|decline press|chest press|pec deck|push[- ]?up|pushup|\bfly\b|cable crossover|dip\b|crossover/i,
    StretchHorizontal,
  ],
  [
    /leg curl|leg extension|leg press|squat|lunge|calf|hack squat|glute|adductor|abductor|step[- ]?up|sissy|nordic|split squat|bulgarian|hip thrust|leg abduction|leg adduction/i,
    Footprints,
  ],
  [
    /pull[- ]?up|chin[- ]?up|lat pulldown|pulldown|barbell row|bent[- ]over row|cable row|t[- ]?bar row|meadows row|seated row|inverted row|deadlift|romanian deadlift|(?:^|\s)rdl(?:\s|$)|good morning|hyperextension|shrug|face pull|lat pullover|pullover/i,
    ArrowBigDown,
  ],
  [
    /curl|tricep|triceps|bicep|preacher|hammer|skull|pushdown|overhead ext|rope pressdown|wrist curl/i,
    Link2,
  ],
  [/plank|crunch|ab wheel|sit[- ]?up|russian twist|woodchop|pallof|dead bug|hanging knee|toes to bar|l-sit|dragon flag|leg raise/i, Target],
  [
    /shoulder press|ohp|military press|arnold|lateral raise|front raise|upright row|rear delt|y[- ]raise|landmine/i,
    ChevronsUp,
  ],
  [/walk|hike|farmer|carry/i, Footprints],
];

/**
 * Lucide icon component for an exercise name + category.
 */
export function resolveExerciseIcon(name, category = 'other') {
  const n = (name || '').trim().toLowerCase();
  for (const [re, Icon] of NAME_RULES) {
    if (re.test(n)) return Icon;
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
  className = 'h-4 w-4 shrink-0 text-slate-400',
  strokeWidth = 1.75,
  boxed = false,
}) {
  const Icon = resolveExerciseIcon(name, category);
  const glyph = <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
  if (!boxed) return glyph;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-slate-300 ring-1 ring-slate-200/80 dark:ring-slate-700/80"
      aria-hidden
    >
      {glyph}
    </span>
  );
}
