import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Workout, { SET_TYPES } from '../models/Workout.js';
import Exercise, { EXERCISE_CATEGORIES } from '../models/Exercise.js';
import User from '../models/User.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import { authRequired } from '../middleware/auth.js';
import { bestEstimated1RMFromSets } from '../lib/estimated1RM.js';
import { buildDashboardIntelligence } from '../lib/dashboardIntelligence.js';
import {
  addCalendarDays,
  computeCurrentStreak,
  countTrainingDaysInRollingWindow,
  dateKeyInTimeZone,
} from '../lib/trainingStreak.js';
import { totalVolumeKgNonWarmup } from '../lib/workoutVolume.js';
import { tryAwardSeasonRankPointsForWorkout } from '../lib/seasonRankPoints.js';

/** Longest run of consecutive calendar days present in `set` (YYYY-MM-DD keys). */
function bestStreakFromDaySet(trainingDays) {
  let best = 0;
  for (const day of trainingDays) {
    const prev = addCalendarDays(day, -1);
    if (trainingDays.has(prev)) continue;
    let len = 0;
    let k = day;
    while (trainingDays.has(k)) {
      len += 1;
      k = addCalendarDays(k, 1);
    }
    if (len > best) best = len;
  }
  return best;
}

function weekdayShortForDayKey(dayKey, timeZone) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const inst = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone }).format(inst);
}

const router = Router();
router.use(authRequired);

function normalizeSetType(t) {
  return SET_TYPES.includes(t) ? t : 'normal';
}

/** Sets counted toward load / PR stats (warm-ups excluded). */
function isCountingSet(s) {
  return normalizeSetType(s?.setType) !== 'warmup';
}

/** Non–warm-up volume (kg×reps) for completed workouts in [from, to]; if `exclusiveUpper`, use `to` as exclusive end. */
async function volumeNonWarmupInRange(userId, from, to, exclusiveUpper = false) {
  const range = exclusiveUpper
    ? { $gte: from, $lt: to }
    : { $gte: from, $lte: to };
  const rows = await Workout.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        completedAt: { $ne: null, ...range },
      },
    },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    {
      $match: {
        $expr: {
          $ne: [{ $ifNull: ['$exercises.sets.setType', 'normal'] }, 'warmup'],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalVolume: {
          $sum: { $multiply: ['$exercises.sets.weight', '$exercises.sets.reps'] },
        },
      },
    },
  ]);
  return Math.round(rows[0]?.totalVolume ?? 0);
}

router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 20;
    const skip = Number(req.query.skip) || 0;
    const [rows, total] = await Promise.all([
      Workout.find({ userId: req.user.id }).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      Workout.countDocuments({ userId: req.user.id }),
    ]);
    const workouts = rows.map((w) => ({
      ...w,
      totalVolumeKg: totalVolumeKgNonWarmup(w),
    }));
    res.json({ workouts, total });
  }
);

router.get('/summary', async (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const me = await User.findById(req.user.id).select('timezone').lean();
  const tz = me?.timezone || 'UTC';

  const [
    totalWorkouts,
    weekCount,
    monthCount,
    lastWorkout,
    volumeAgg,
    completedDates,
    prevWeekWorkouts,
    prevMonthWorkouts,
    volumeThis7d,
    volumePrev7d,
  ] = await Promise.all([
    Workout.countDocuments({ userId: req.user.id, completedAt: { $ne: null } }),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $gte: weekAgo },
    }),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $gte: monthAgo },
    }),
    Workout.findOne({ userId: req.user.id }).sort({ startedAt: -1 }).select('title startedAt completedAt').lean(),
    Workout.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id), completedAt: { $ne: null } } },
      { $unwind: '$exercises' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          $expr: {
            $ne: [{ $ifNull: ['$exercises.sets.setType', 'normal'] }, 'warmup'],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalVolume: {
            $sum: { $multiply: ['$exercises.sets.weight', '$exercises.sets.reps'] },
          },
        },
      },
    ]),
    Workout.find({
      userId: req.user.id,
      completedAt: { $ne: null },
    })
      .select('completedAt')
      .lean(),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $ne: null, $gte: twoWeeksAgo, $lt: weekAgo },
    }),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $ne: null, $gte: sixtyDaysAgo, $lt: monthAgo },
    }),
    volumeNonWarmupInRange(req.user.id, weekAgo, now, false),
    volumeNonWarmupInRange(req.user.id, twoWeeksAgo, weekAgo, true),
  ]);

  const totalVolume = volumeAgg[0]?.totalVolume ?? 0;
  const trainingDays = new Set(
    (completedDates || []).map((w) => dateKeyInTimeZone(new Date(w.completedAt), tz))
  );
  const todayKey = dateKeyInTimeZone(now, tz);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const currentStreak = computeCurrentStreak(trainingDays, todayKey, yesterdayKey);
  const trainingDaysLast7 = countTrainingDaysInRollingWindow(trainingDays, todayKey, 7);

  res.json({
    totalWorkouts,
    workoutsThisWeek: weekCount,
    workoutsThisMonth: monthCount,
    prevWeekWorkouts,
    prevMonthWorkouts,
    volumeThis7d,
    volumePrev7d,
    lastWorkout,
    estimatedTotalVolume: Math.round(totalVolume),
    streak: {
      currentDays: currentStreak,
      trainingDaysLast7,
      bestEver: bestStreakFromDaySet(trainingDays),
    },
  });
});

/** Volume / sets / sessions per exercise category (non-warmup sets), completed workouts only. */
router.get(
  '/stats/muscles',
  query('days').optional().isInt({ min: 1, max: 3650 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const daysRaw = req.query.days;
    const now = new Date();
    let from = null;
    if (daysRaw !== undefined && daysRaw !== '') {
      const d = new Date(now);
      d.setDate(d.getDate() - Number(daysRaw));
      from = d;
    }

    const match = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      completedAt: { $ne: null },
    };
    if (from) match.startedAt = { $gte: from };

    const rows = await Workout.aggregate([
      { $match: match },
      { $unwind: '$exercises' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          $expr: {
            $ne: [{ $ifNull: ['$exercises.sets.setType', 'normal'] }, 'warmup'],
          },
        },
      },
      {
        $group: {
          _id: {
            workout: '$_id',
            category: { $ifNull: ['$exercises.category', 'other'] },
          },
          volume: {
            $sum: {
              $multiply: [
                { $ifNull: ['$exercises.sets.weight', 0] },
                { $ifNull: ['$exercises.sets.reps', 0] },
              ],
            },
          },
          sets: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          volume: { $sum: '$volume' },
          sets: { $sum: '$sets' },
          sessions: { $sum: 1 },
        },
      },
    ]);

    const categories = Object.fromEntries(
      EXERCISE_CATEGORIES.map((c) => [c, { volume: 0, sets: 0, sessions: 0 }])
    );
    for (const row of rows) {
      const key = EXERCISE_CATEGORIES.includes(row._id) ? row._id : 'other';
      categories[key].volume += Math.round(row.volume || 0);
      categories[key].sets += row.sets || 0;
      categories[key].sessions += row.sessions || 0;
    }

    res.json({
      window: {
        days: from ? Number(daysRaw) : null,
        from: from?.toISOString() ?? null,
        to: now.toISOString(),
      },
      categories,
    });
  }
);

/** Per-calendar-day volume by exercise category (user TZ), non-warmup sets, completed workouts only. */
router.get(
  '/stats/volume-by-day',
  query('days').optional().isInt({ min: 1, max: 90 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const span = Number(req.query.days) || 7;

    const me = await User.findById(req.user.id).select('timezone').lean();
    const tz = me?.timezone || 'UTC';
    const now = new Date();
    const todayKey = dateKeyInTimeZone(now, tz);
    const startKey = addCalendarDays(todayKey, -(span - 1));

    const roughFrom = new Date(now);
    roughFrom.setUTCDate(roughFrom.getUTCDate() - span - 2);

    const workouts = await Workout.find({
      userId: req.user.id,
      completedAt: { $ne: null, $gte: roughFrom },
    })
      .select('completedAt exercises')
      .lean();

    const emptyCats = () =>
      Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c, 0]));
    const byDay = {};
    for (let i = 0; i < span; i += 1) {
      const k = addCalendarDays(startKey, i);
      byDay[k] = emptyCats();
    }

    for (const w of workouts) {
      const dk = dateKeyInTimeZone(new Date(w.completedAt), tz);
      if (!byDay[dk]) continue;
      for (const ex of w.exercises || []) {
        const cat = EXERCISE_CATEGORIES.includes(ex.category) ? ex.category : 'other';
        for (const s of ex.sets || []) {
          if (!isCountingSet(s)) continue;
          byDay[dk][cat] += Math.round((Number(s.weight) || 0) * (Number(s.reps) || 0));
        }
      }
    }

    const days = [];
    for (let i = 0; i < span; i += 1) {
      const k = addCalendarDays(startKey, i);
      const cats = byDay[k];
      const totalVolume = EXERCISE_CATEGORIES.reduce((s, c) => s + cats[c], 0);
      days.push({
        dayKey: k,
        label: weekdayShortForDayKey(k, tz),
        categories: cats,
        totalVolume,
      });
    }

    res.json({ timezone: tz, days });
  }
);

router.get('/intelligence', async (req, res) => {
  try {
    const data = await buildDashboardIntelligence(req.user.id);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load intelligence' });
  }
});

router.get('/progress/:exerciseId', param('exerciseId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const eid = req.params.exerciseId;
  const workouts = await Workout.find({
    userId: req.user.id,
    completedAt: { $ne: null },
    'exercises.exerciseId': new mongoose.Types.ObjectId(eid),
  })
    .sort({ startedAt: 1 })
    .select('startedAt exercises')
    .lean();

  const points = [];
  let best1RM = null;
  for (const w of workouts) {
    const ex = w.exercises.find((x) => x.exerciseId?.toString() === eid);
    if (!ex || !ex.sets?.length) continue;
    const countSets = ex.sets.filter(isCountingSet);
    if (!countSets.length) continue;
    const maxWeight = Math.max(...countSets.map((s) => s.weight || 0));
    const totalReps = countSets.reduce((a, s) => a + (s.reps || 0), 0);
    const volume = countSets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
    points.push({
      date: w.startedAt,
      maxWeight,
      totalReps,
      volume,
      sets: countSets.length,
    });
    const sessionBest = bestEstimated1RMFromSets(ex.sets, isCountingSet);
    if (
      sessionBest &&
      (!best1RM || sessionBest.combined > best1RM.combined)
    ) {
      best1RM = sessionBest;
    }
  }

  const estimatedOneRM = best1RM
    ? {
        ...best1RM,
        caveat:
          'Estimates from a single top set (Epley and Brzycki). Not a true max test; technique and fatigue matter.',
      }
    : null;

  res.json({ points, estimatedOneRM });
});

/**
 * Max completed weight per exercise (non-warmup sets only), from completed workouts.
 * Targets: { exerciseId?: string, name?: string } — match by exerciseId when set, else by name for custom-only exercises.
 */
router.post(
  '/pr-baselines',
  body('targets').isArray({ min: 0, max: 200 }),
  body('targets.*.exerciseId').optional().isMongoId(),
  body('targets.*.name').optional().trim(),
  body('excludeWorkoutId').optional().isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { targets, excludeWorkoutId } = req.body;

    const match = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      completedAt: { $ne: null },
    };
    if (excludeWorkoutId) {
      match._id = { $ne: new mongoose.Types.ObjectId(excludeWorkoutId) };
    }
    const workouts = await Workout.find(match).select('exercises').lean();

    const baselines = targets.map((t) => {
      const eid =
        t.exerciseId && mongoose.Types.ObjectId.isValid(t.exerciseId)
          ? String(t.exerciseId)
          : null;
      const nameKey = (t.name || '').trim().toLowerCase();
      let maxWeight = 0;
      let maxSetVolume = 0;
      const repsByWeight = {};
      for (const w of workouts) {
        for (const ex of w.exercises || []) {
          const byId = eid && ex.exerciseId?.toString() === eid;
          const byName =
            !eid &&
            nameKey &&
            (ex.exerciseId == null || ex.exerciseId === undefined) &&
            (ex.name || '').trim().toLowerCase() === nameKey;
          if (!byId && !byName) continue;
          for (const s of ex.sets || []) {
            if (!isCountingSet(s) || !s.completed) continue;
            const wv = Number(s.weight) || 0;
            const rv = Math.floor(Number(s.reps) || 0);
            if (wv > maxWeight) maxWeight = wv;
            const vol = wv * rv;
            if (vol > maxSetVolume) maxSetVolume = vol;
            const key = String(wv);
            const prevR = repsByWeight[key] ?? 0;
            if (rv > prevR) repsByWeight[key] = rv;
          }
        }
      }
      return { maxWeight, maxSetVolume, repsByWeight };
    });

    res.json({ baselines });
  }
);

router.get('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const w = await Workout.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!w) return res.status(404).json({ error: 'Workout not found' });
  res.json({ workout: w });
});

router.post(
  '/from-template/:templateId',
  param('templateId').isMongoId(),
  body('title').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const template = await WorkoutTemplate.findOne({
      _id: req.params.templateId,
      userId: req.user.id,
    }).lean();
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const exercises = template.items
      .sort((a, b) => a.order - b.order)
      .map((item, order) => ({
        exerciseId: item.exerciseId,
        name: item.exerciseName,
        category: 'other',
        order,
        sets: Array.from({ length: item.defaultSets }, () => ({
          reps: item.defaultReps,
          weight: item.defaultWeight,
          completed: false,
          setType: 'normal',
        })),
      }));

    for (let i = 0; i < exercises.length; i++) {
      const exDoc = await Exercise.findById(exercises[i].exerciseId).select('category').lean();
      if (exDoc) exercises[i].category = exDoc.category;
    }

    const workout = await Workout.create({
      userId: req.user.id,
      title: req.body.title?.trim() || template.name,
      notes: '',
      templateId: template._id,
      exercises,
    });
    res.status(201).json({ workout });
  }
);

router.post(
  '/',
  body('title').trim().notEmpty(),
  body('notes').optional().trim(),
  body('exercises').optional().isArray(),
  body('exercises.*.name').optional().trim().notEmpty(),
  body('exercises.*.exerciseId').optional().isMongoId(),
  body('exercises.*.category').optional().trim(),
  body('exercises.*.sets').optional().isArray(),
  body('exercises.*.sets.*.reps').optional().isFloat({ min: 0 }),
  body('exercises.*.sets.*.weight').optional().isFloat({ min: 0 }),
  body('exercises.*.sets.*.completed').optional().isBoolean(),
  body('exercises.*.sets.*.setType').optional().isIn(SET_TYPES),
  body('startedAt').optional().isISO8601(),
  body('completedAt')
    .optional({ nullable: true })
    .custom((v) => v === null || v === undefined || !Number.isNaN(Date.parse(v))),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title, notes, exercises: rawExercises, startedAt: bodyStarted, completedAt: bodyCompleted } =
      req.body;
    let exercises = rawExercises?.length
      ? rawExercises.map((e, order) => ({
          exerciseId: e.exerciseId ? new mongoose.Types.ObjectId(e.exerciseId) : null,
          name: e.name,
          category: e.category || 'other',
          order,
          sets: (e.sets || [{ reps: 0, weight: 0, completed: false }]).map((s) => ({
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            completed: s.completed ?? false,
            setType: normalizeSetType(s.setType),
          })),
        }))
      : [
          {
            exerciseId: null,
            name: 'New exercise',
            category: 'other',
            order: 0,
            sets: [{ reps: 0, weight: 0, completed: false, setType: 'normal' }],
          },
        ];

    for (const ex of exercises) {
      if (ex.exerciseId) {
        const doc = await Exercise.findOne({
          _id: ex.exerciseId,
          $or: [{ isGlobal: true }, { userId: req.user.id }],
        })
          .select('name category')
          .lean();
        if (doc) {
          ex.name = doc.name;
          ex.category = doc.category;
        }
      }
    }

    const createPayload = {
      userId: req.user.id,
      title,
      notes: notes || '',
      exercises,
    };
    if (bodyStarted) {
      createPayload.startedAt = new Date(bodyStarted);
    }
    if (bodyCompleted !== undefined) {
      createPayload.completedAt =
        bodyCompleted === null || bodyCompleted === '' ? null : new Date(bodyCompleted);
    }

    const workout = await Workout.create(createPayload);
    if (workout.completedAt) {
      try {
        await tryAwardSeasonRankPointsForWorkout(workout);
      } catch (e) {
        console.error('season rank award', e);
      }
    }
    res.status(201).json({ workout });
  }
);

router.put(
  '/:id',
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('notes').optional().trim(),
  body('startedAt').optional().isISO8601(),
  body('completedAt')
    .optional({ nullable: true })
    .custom((v) => v === null || v === undefined || !Number.isNaN(Date.parse(v))),
  body('exercises').optional().isArray(),
  body('exercises.*.name').optional().trim().notEmpty(),
  body('exercises.*.exerciseId').optional({ nullable: true }).isMongoId(),
  body('exercises.*.category').optional().trim(),
  body('exercises.*.sets').optional().isArray(),
  body('exercises.*.sets.*.setType').optional().isIn(SET_TYPES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user.id });
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    const { title, notes, startedAt, completedAt, exercises: rawExercises } = req.body;
    if (title !== undefined) workout.title = title;
    if (notes !== undefined) workout.notes = notes;
    if (startedAt !== undefined) workout.startedAt = new Date(startedAt);
    if (completedAt !== undefined) {
      workout.completedAt = completedAt === null ? null : new Date(completedAt);
    }

    if (rawExercises) {
      workout.exercises = rawExercises.map((e, order) => ({
        exerciseId: e.exerciseId ? new mongoose.Types.ObjectId(e.exerciseId) : null,
        name: e.name,
        category: e.category || 'other',
        order,
        sets: (e.sets || []).map((s) => ({
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          completed: s.completed ?? false,
          setType: normalizeSetType(s.setType),
        })),
      }));
    }

    await workout.save();
    if (workout.completedAt) {
      try {
        await tryAwardSeasonRankPointsForWorkout(workout);
      } catch (e) {
        console.error('season rank award', e);
      }
    }
    res.json({ workout });
  }
);

router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await Workout.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Workout not found' });
  res.status(204).send();
});

export default router;
